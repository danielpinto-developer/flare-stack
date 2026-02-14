/**
 * FLARE STACK — TTS Narrator
 *
 * Script-first narrated video walkthrough pipeline:
 *   1. AI reads Jira ticket AC/DoD → generates narration script
 *   2. User reviews/edits the script interactively
 *   3. Stagehand agent follows the approved script (Playwright records)
 *   4. Kokoro TTS speaks the approved script (local neural voice)
 *   5. ffmpeg merges audio + video
 *
 * Dependencies:
 *   - @browserbasehq/stagehand (AI browser agent, Playwright under the hood)
 *   - kokoro-js (82M neural TTS, 100% local via WASM)
 *   - ffmpeg (system dep for audio/video merge — graceful fallback)
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import chalk from "chalk";
import { callLLM, detectProvider } from "../core/llm.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NarrationScene {
  /** What to tell the Stagehand agent to do */
  agentInstruction: string;
  /** What the narrator says while this happens */
  narrationText: string;
  /** Estimated duration in seconds */
  durationSec: number;
}

export interface NarrationResult {
  /** Path to the final narrated video */
  videoPath: string;
  /** Path to the narration audio track */
  audioPath: string;
  /** Whether audio was successfully merged with video */
  merged: boolean;
  /** The approved script that was used */
  scenes: NarrationScene[];
}

// ─── Script Generation ────────────────────────────────────────────────────────

/**
 * Generate a narration script from a Jira ticket's acceptance criteria
 * and definition of done. Uses callLLM() (cheapest model tier).
 */
export async function generateScript(
  ticketDescription: string,
  acceptanceCriteria: string,
  baseUrl: string,
): Promise<NarrationScene[]> {
  const provider = detectProvider();
  if (!provider) {
    console.log(
      chalk.yellow(
        "   ⚠️  No AI provider detected. Using fallback script from ticket description.",
      ),
    );
    return createFallbackScript(ticketDescription, baseUrl);
  }

  const prompt = `You are generating a narration script for a video demo of a web application feature.

The video will demo a feature described by this Jira ticket:

DESCRIPTION:
${ticketDescription}

ACCEPTANCE CRITERIA / DEFINITION OF DONE:
${acceptanceCriteria}

BASE URL: ${baseUrl}

Generate a JSON array of scenes. Each scene has:
- "agentInstruction": a clear, specific instruction for a browser agent to execute (e.g., "Navigate to ${baseUrl}/dashboard", "Click the 'Submit' button", "Type 'test@example.com' into the email field")
- "narrationText": a natural, professional sentence the narrator says during this action (e.g., "Here we can see the dashboard with all active metrics displayed")
- "durationSec": estimated seconds this scene takes (3-8 seconds per scene)

Rules:
- Start by navigating to the base URL or the relevant page
- Cover each acceptance criterion with at least one scene
- Keep narration natural and conversational, like a senior engineer demoing to stakeholders
- 5-15 scenes total
- Agent instructions must be specific: include URLs, button text, or form field names
- Return ONLY the JSON array, no other text

Example:
[
  {
    "agentInstruction": "Navigate to ${baseUrl}/ingest",
    "narrationText": "Let's start by opening the data upload interface.",
    "durationSec": 4
  }
]`;

  try {
    console.log(chalk.cyan("   🤖 Generating narration script from ticket..."));
    const response = await callLLM(provider, prompt);

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("LLM response did not contain a valid JSON array");
    }

    const scenes: NarrationScene[] = JSON.parse(jsonMatch[0]);

    // Validate structure
    for (const scene of scenes) {
      if (
        !scene.agentInstruction ||
        !scene.narrationText ||
        !scene.durationSec
      ) {
        throw new Error("Invalid scene structure in LLM response");
      }
    }

    console.log(
      chalk.green(`   ✅ Generated ${scenes.length} scenes from ticket`),
    );
    return scenes;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(chalk.yellow(`   ⚠️  Script generation failed: ${message}`));
    console.log(
      chalk.yellow("   ⚠️  Using fallback script from ticket description."),
    );
    return createFallbackScript(ticketDescription, baseUrl);
  }
}

/**
 * Fallback script when LLM is unavailable — creates basic scenes
 * from the ticket description.
 */
function createFallbackScript(
  description: string,
  baseUrl: string,
): NarrationScene[] {
  const lines = description
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 10);

  const scenes: NarrationScene[] = [
    {
      agentInstruction: `Navigate to ${baseUrl}`,
      narrationText: "Let's start by opening the application.",
      durationSec: 4,
    },
  ];

  for (const line of lines.slice(0, 5)) {
    scenes.push({
      agentInstruction: `Look at the page and identify elements related to: ${line}`,
      narrationText: line,
      durationSec: 5,
    });
  }

  return scenes;
}

// ─── Interactive Review ───────────────────────────────────────────────────────

/**
 * Present the narration script to the user for interactive review.
 * Returns the approved (possibly edited) scenes.
 */
export async function presentScriptForReview(
  scenes: NarrationScene[],
): Promise<NarrationScene[]> {
  console.log(chalk.cyan.bold("\n📝 NARRATION SCRIPT REVIEW\n"));
  console.log(
    chalk.gray(
      "   Review the script below. The agent will follow these instructions\n" +
        "   while the narrator speaks the narration text.\n",
    ),
  );

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    console.log(chalk.white.bold(`   Scene ${i + 1}:`));
    console.log(chalk.cyan(`     🤖 Agent: ${scene.agentInstruction}`));
    console.log(chalk.green(`     🗣️  Voice: "${scene.narrationText}"`));
    console.log(chalk.gray(`     ⏱️  Duration: ${scene.durationSec}s`));
    console.log();
  }

  const totalDuration = scenes.reduce((sum, s) => sum + s.durationSec, 0);
  console.log(
    chalk.gray(
      `   Total: ${scenes.length} scenes, ~${totalDuration}s estimated\n`,
    ),
  );

  try {
    const { confirm } = await import("@inquirer/prompts");
    const approved = await confirm({
      message: "Approve this narration script?",
      default: true,
    });

    if (!approved) {
      console.log(
        chalk.yellow(
          "\n   ⚠️  Script rejected. Edit the script in the generated file and re-run.\n",
        ),
      );
      // Save script to file for manual editing
      const scriptPath = join(process.cwd(), ".flare-narration-script.json");
      writeFileSync(scriptPath, JSON.stringify(scenes, null, 2));
      console.log(chalk.gray(`   📄 Script saved to: ${scriptPath}`));
      console.log(
        chalk.gray("   Edit the file and re-run with --narrate to use it.\n"),
      );
      throw new Error("Script rejected by user");
    }

    console.log(chalk.green("\n   ✅ Script approved!\n"));
    return scenes;
  } catch (error) {
    // If inquirer is not available or user rejects, throw
    if (error instanceof Error && error.message === "Script rejected by user") {
      throw error;
    }
    // If inquirer fails, auto-approve with warning
    console.log(
      chalk.yellow(
        "\n   ⚠️  Interactive prompts unavailable. Auto-approving script.\n",
      ),
    );
    return scenes;
  }
}

// ─── Agent Execution ──────────────────────────────────────────────────────────

/**
 * Execute the narration script using Stagehand's AI browser agent.
 * Playwright records the video under the hood.
 * Returns the video path.
 */
export async function executeScriptWithAgent(
  scenes: NarrationScene[],
  baseUrl: string,
  outputDir: string,
): Promise<string> {
  mkdirSync(outputDir, { recursive: true });

  let Stagehand;
  try {
    const stagehandModule = await import("@browserbasehq/stagehand");
    Stagehand = stagehandModule.Stagehand;
  } catch {
    console.error(
      chalk.red(
        "❌ Stagehand not installed. Run: npm install @browserbasehq/stagehand",
      ),
    );
    return "";
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(
      chalk.red("❌ GEMINI_API_KEY not set. Required for AI browser agent."),
    );
    return "";
  }

  console.log(chalk.cyan("   🤖 Launching AI browser agent...\n"));

  const stagehand = new Stagehand({
    env: "LOCAL" as const,
    localBrowserLaunchOptions: {
      headless: true,
      viewport: { width: 1280, height: 720 },
    },
  });

  await stagehand.init();

  // Access the Playwright page for video recording setup
  const page = stagehand.context.pages()[0];

  // Navigate to base URL first (best practice: start on the right page)
  await page.goto(baseUrl, { waitUntil: "networkidle", timeoutMs: 15000 });

  let videoPath = "";

  try {
    // Execute each scene sequentially with the agent
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      console.log(
        chalk.cyan(
          `   🎬 Scene ${i + 1}/${scenes.length}: ${scene.agentInstruction}`,
        ),
      );

      try {
        await stagehand.act(scene.agentInstruction);

        // Wait for the scene duration to let content render
        const waitMs = scene.durationSec * 1000;
        await new Promise((r) => setTimeout(r, waitMs));

        console.log(chalk.green(`      ✅ Done`));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(chalk.yellow(`      ⚠️  Scene failed: ${message}`));
        // Continue with remaining scenes
      }
    }

    // Close page to finalize video — Stagehand wraps Playwright,
    // so we access the underlying context for video path
    await page.close();
    const videoFiles = (await import("fs"))
      .readdirSync(outputDir)
      .filter((f: string) => f.endsWith(".webm"));
    if (videoFiles.length > 0) {
      const rawVideoPath = join(outputDir, videoFiles[0]);
      videoPath = join(outputDir, "agent-recording.webm");
      if (rawVideoPath !== videoPath && existsSync(rawVideoPath)) {
        const { renameSync } = await import("fs");
        renameSync(rawVideoPath, videoPath);
      }
    }
  } finally {
    await stagehand.close();
  }

  if (videoPath) {
    console.log(chalk.green(`\n   ✅ Video recorded: ${videoPath}\n`));
  }

  return videoPath;
}

// ─── TTS Synthesis ────────────────────────────────────────────────────────────

/**
 * Synthesize narration audio from scenes using Kokoro TTS.
 * Generates one WAV file per scene, then concatenates them.
 * Returns path to the final concatenated audio.
 */
export async function synthesizeNarration(
  scenes: NarrationScene[],
  outputDir: string,
): Promise<string> {
  mkdirSync(outputDir, { recursive: true });

  let KokoroTTS;
  try {
    const kokoroModule = await import("kokoro-js");
    KokoroTTS = kokoroModule.KokoroTTS;
  } catch {
    console.error(
      chalk.red("❌ kokoro-js not installed. Run: npm install kokoro-js"),
    );
    return "";
  }

  console.log(
    chalk.cyan(
      "   🔊 Initializing Kokoro TTS (first run downloads model)...\n",
    ),
  );

  const tts = await KokoroTTS.from_pretrained(
    "onnx-community/Kokoro-82M-v1.0-ONNX",
    { dtype: "q8" },
  );

  const wavPaths: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const wavPath = join(outputDir, `scene-${i + 1}.wav`);

    console.log(
      chalk.cyan(
        `   🗣️  Generating audio ${i + 1}/${scenes.length}: "${scene.narrationText.slice(0, 50)}..."`,
      ),
    );

    try {
      const audio = await tts.generate(scene.narrationText, {
        voice: "af_heart",
      });
      audio.save(wavPath);
      wavPaths.push(wavPath);
      console.log(chalk.green(`      ✅ ${wavPath}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(
        chalk.yellow(`      ⚠️  TTS failed for scene ${i + 1}: ${message}`),
      );
    }
  }

  if (wavPaths.length === 0) {
    console.log(chalk.yellow("   ⚠️  No audio segments generated."));
    return "";
  }

  // Concatenate audio segments with ffmpeg
  const concatenatedPath = join(outputDir, "narration.wav");
  const concatResult = concatAudioSegments(wavPaths, concatenatedPath);

  if (!concatResult) {
    // If ffmpeg concat fails, return the first segment as fallback
    return wavPaths[0];
  }

  console.log(chalk.green(`\n   ✅ Narration audio: ${concatenatedPath}\n`));
  return concatenatedPath;
}

/**
 * Concatenate multiple WAV files using ffmpeg.
 * Returns true if successful, false if ffmpeg is not available.
 */
export function concatAudioSegments(
  wavPaths: string[],
  outputPath: string,
): boolean {
  if (wavPaths.length === 1) {
    // Single file, just copy it
    const { copyFileSync } = require("fs");
    copyFileSync(wavPaths[0], outputPath);
    return true;
  }

  try {
    // Create concat list file for ffmpeg
    const listPath = outputPath.replace(".wav", "-list.txt");
    const listContent = wavPaths.map((p) => `file '${p}'`).join("\n");
    writeFileSync(listPath, listContent);

    execFileSync("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      outputPath,
    ]);

    return true;
  } catch {
    console.log(
      chalk.yellow(
        "   ⚠️  ffmpeg not found. Cannot concatenate audio segments.",
      ),
    );
    console.log(
      chalk.gray("      Install ffmpeg: brew install ffmpeg (macOS)"),
    );
    return false;
  }
}

// ─── Audio/Video Merge ────────────────────────────────────────────────────────

/**
 * Merge audio and video using ffmpeg.
 * Falls back gracefully if ffmpeg is not installed.
 */
export function mergeAudioVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): boolean {
  try {
    execFileSync("ffmpeg", [
      "-y",
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-c:v",
      "copy",
      "-c:a",
      "libopus",
      "-shortest",
      outputPath,
    ]);

    console.log(chalk.green(`   ✅ Narrated video: ${outputPath}`));
    return true;
  } catch {
    console.log(
      chalk.yellow(
        "   ⚠️  ffmpeg not installed. Cannot merge audio with video.",
      ),
    );
    console.log(chalk.gray("      Install: brew install ffmpeg (macOS)"));
    console.log(chalk.gray(`      Video: ${videoPath}`));
    console.log(chalk.gray(`      Audio: ${audioPath}`));
    console.log(
      chalk.gray(
        "      Merge manually: ffmpeg -i video.webm -i audio.wav -c:v copy -c:a libopus output.webm",
      ),
    );
    return false;
  }
}

// ─── Full Orchestrator ────────────────────────────────────────────────────────

/**
 * Full narration pipeline:
 *   1. Generate script from ticket AC/DoD
 *   2. Present to user for review
 *   3. Execute with Stagehand agent (record video)
 *   4. Synthesize with Kokoro TTS (generate audio)
 *   5. Merge audio + video with ffmpeg
 */
export async function generateNarration(
  ticketDescription: string,
  acceptanceCriteria: string,
  baseUrl: string,
  outputDir: string,
): Promise<NarrationResult> {
  mkdirSync(outputDir, { recursive: true });

  // Check for a pre-edited script file
  const scriptPath = join(process.cwd(), ".flare-narration-script.json");
  let scenes: NarrationScene[];

  if (existsSync(scriptPath)) {
    console.log(chalk.cyan("   📄 Found edited script file. Using it.\n"));
    scenes = JSON.parse(readFileSync(scriptPath, "utf-8"));
  } else {
    // Step 1: Generate script from ticket
    scenes = await generateScript(
      ticketDescription,
      acceptanceCriteria,
      baseUrl,
    );
  }

  // Step 2: User reviews the script
  scenes = await presentScriptForReview(scenes);

  // Step 3: Execute with agent (record video)
  console.log(chalk.cyan.bold("\n🎬 RECORDING VIDEO\n"));
  const videoPath = await executeScriptWithAgent(scenes, baseUrl, outputDir);

  if (!videoPath) {
    return {
      videoPath: "",
      audioPath: "",
      merged: false,
      scenes,
    };
  }

  // Step 4: Generate narration audio
  console.log(chalk.cyan.bold("\n🔊 GENERATING NARRATION AUDIO\n"));
  const audioPath = await synthesizeNarration(scenes, outputDir);

  if (!audioPath) {
    return {
      videoPath,
      audioPath: "",
      merged: false,
      scenes,
    };
  }

  // Step 5: Merge audio + video
  console.log(chalk.cyan.bold("\n🔗 MERGING AUDIO + VIDEO\n"));
  const mergedPath = join(outputDir, "narrated-recording.webm");
  const merged = mergeAudioVideo(videoPath, audioPath, mergedPath);

  // Clean up the script file if it existed
  if (existsSync(scriptPath)) {
    const { unlinkSync } = await import("fs");
    try {
      unlinkSync(scriptPath);
    } catch {
      // ignore cleanup errors
    }
  }

  return {
    videoPath: merged ? mergedPath : videoPath,
    audioPath,
    merged,
    scenes,
  };
}
