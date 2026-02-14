/**
 * FLARE STACK — Loom Generator
 *
 * Records a Loom video walkthrough of your running app.
 * Uses Playwright to navigate your dev server while recording video,
 * then uploads the recording to Loom via their SDK.
 *
 * Workflow:
 *   1. Detect running dev server for the ticket's worktree
 *   2. Launch browser with Playwright video recording
 *   3. Navigate through configured pages/routes, interacting as configured
 *   4. Stop recording → .webm file
 *   5. Upload to Loom → shareable Loom URL
 *   6. Generate a summary report with the Loom link
 *
 * Requires: LOOM_API_KEY in .env (get one at https://www.loom.com/developer)
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, basename } from "path";
import chalk from "chalk";
import type { FlareConfig } from "../config/schema.js";

export interface DemoStep {
  /** URL or path to navigate to */
  url: string;
  /** Description of what this step shows */
  description: string;
  /** Wait time in ms before moving to next step */
  waitMs?: number;
  /** CSS selector to click */
  click?: string;
  /** Text to type into a focused element */
  type?: string;
  /** Custom narration text for this step (used when --narrate is active) */
  narration?: string;
}

export interface DemoRecording {
  step: DemoStep;
  success: boolean;
  error?: string;
}

export interface DemoReport {
  ticketId: string;
  videoPath: string;
  loomUrl: string;
  recordings: DemoRecording[];
  reportPath: string;
  generatedAt: string;
}

/**
 * Default demo steps — captures common pages.
 */
function getDefaultSteps(baseUrl: string): DemoStep[] {
  return [
    {
      url: baseUrl,
      description: "Homepage / Landing Page",
      waitMs: 2000,
    },
    {
      url: `${baseUrl}/login`,
      description: "Login Page",
      waitMs: 1000,
    },
    {
      url: `${baseUrl}/dashboard`,
      description: "Dashboard",
      waitMs: 2000,
    },
  ];
}

/**
 * Record a video walkthrough using Playwright's video recording.
 * Returns the local video path and step results.
 */
export async function recordLoomVideo(
  steps: DemoStep[],
  outputDir: string,
): Promise<{ recordings: DemoRecording[]; videoPath: string }> {
  mkdirSync(outputDir, { recursive: true });

  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    console.error(
      chalk.red("❌ Playwright not installed. Run: npm install -D playwright"),
    );
    return {
      recordings: steps.map((step) => ({
        step,
        success: false,
        error: "Playwright not installed",
      })),
      videoPath: "",
    };
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const recordings: DemoRecording[] = [];
  let videoPath = "";

  try {
    // Create context with video recording enabled
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: outputDir,
        size: { width: 1280, height: 720 },
      },
    });

    const page = await context.newPage();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      try {
        console.log(chalk.cyan(`   🎬 Step ${i + 1}: ${step.description}`));
        console.log(chalk.gray(`      URL: ${step.url}`));

        await page.goto(step.url, {
          waitUntil: "networkidle",
          timeout: 10000,
        });

        if (step.waitMs) {
          await new Promise((r) => setTimeout(r, step.waitMs));
        }

        if (step.click) {
          await page.click(step.click);
          await new Promise((r) => setTimeout(r, 500));
        }

        if (step.type) {
          await page.keyboard.type(step.type);
          await new Promise((r) => setTimeout(r, 500));
        }

        recordings.push({ step, success: true });
        console.log(chalk.green(`      ✅ Recorded`));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        recordings.push({ step, success: false, error: message });
        console.log(chalk.yellow(`      ⚠️  Skipped: ${message}`));
      }
    }

    // Close page to finalize video
    await page.close();
    const video = page.video();
    if (video) {
      const rawVideoPath = await video.path();
      videoPath = join(outputDir, "loom-recording.webm");
      const { renameSync } = await import("fs");
      if (existsSync(rawVideoPath)) {
        renameSync(rawVideoPath, videoPath);
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }

  return { recordings, videoPath };
}

/**
 * Upload a video file to Loom and return the shareable URL.
 *
 * Uses the Loom Developer API to create a video upload.
 * Requires LOOM_API_KEY environment variable.
 */
export async function uploadToLoom(
  videoPath: string,
  title: string,
): Promise<string> {
  const apiKey = process.env.LOOM_API_KEY;
  if (!apiKey) {
    console.log(
      chalk.yellow(
        "   ⚠️  LOOM_API_KEY not set. Video saved locally — upload to Loom manually.",
      ),
    );
    console.log(
      chalk.gray(
        "      Set LOOM_API_KEY in your .env to enable direct Loom uploads.",
      ),
    );
    console.log(
      chalk.gray("      Get your API key at: https://www.loom.com/developer"),
    );
    return "";
  }

  try {
    console.log(chalk.cyan("   📤 Uploading to Loom..."));

    // Step 1: Request an upload URL from Loom
    const initResponse = await fetch(
      "https://www.loom.com/v1/videos/upload-link",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          source: "flare-stack",
        }),
      },
    );

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      throw new Error(`Loom API error (${initResponse.status}): ${errorText}`);
    }

    const { upload_url, id, share_url } = (await initResponse.json()) as {
      upload_url: string;
      id: string;
      share_url: string;
    };

    // Step 2: Upload the video file
    const videoBuffer = readFileSync(videoPath);
    const uploadResponse = await fetch(upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": "video/webm",
      },
      body: videoBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed (${uploadResponse.status})`);
    }

    // Step 3: Finalize the upload
    const finalizeResponse = await fetch(
      `https://www.loom.com/v1/videos/${id}/finalize`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!finalizeResponse.ok) {
      console.log(
        chalk.yellow("   ⚠️  Video uploaded but finalization pending."),
      );
    }

    console.log(chalk.green(`   ✅ Uploaded to Loom!`));
    console.log(chalk.cyan(`   🔗 ${share_url}`));
    return share_url;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(chalk.yellow(`   ⚠️  Loom upload failed: ${message}`));
    console.log(chalk.gray("      Video saved locally. Upload manually."));
    return "";
  }
}

/**
 * Generate a report for the Loom video recording.
 */
export function generateDemoReport(
  ticketId: string,
  recordings: DemoRecording[],
  videoPath: string,
  loomUrl: string,
  outputDir: string,
): DemoReport {
  const reportPath = join(outputDir, "loom-report.md");
  const generatedAt = new Date().toISOString();

  const stepLines = recordings
    .map((r, i) => {
      const status = r.success ? "✅" : `⚠️ ${r.error || "Failed"}`;
      return `| ${i + 1} | ${r.step.description} | ${r.step.url} | ${status} |`;
    })
    .join("\n");

  const videoSection = loomUrl
    ? `**Loom:** [Watch on Loom](${loomUrl})`
    : `**Local Video:** [${basename(videoPath)}](${basename(videoPath)})`;

  const markdown = `# 🎬 FLARE STACK — Loom Video Report

**Ticket:** ${ticketId}
**Generated:** ${generatedAt}
${videoSection}

## Stats

- **Total Steps:** ${recordings.length}
- **Recorded:** ${recordings.filter((r) => r.success).length}
- **Failed:** ${recordings.filter((r) => !r.success).length}

## Steps

| # | Description | URL | Status |
|---|-------------|-----|--------|
${stepLines}

---
*Generated by FLARE STACK*
`;

  writeFileSync(reportPath, markdown);
  return { ticketId, videoPath, loomUrl, recordings, reportPath, generatedAt };
}

/**
 * Run the full Loom video recording pipeline.
 *
 * 1. Records video with Playwright
 * 2. Uploads to Loom (if LOOM_API_KEY is set)
 * 3. Generates a report with the Loom link
 */
export async function runLoomGenerator(
  ticketId: string,
  config: FlareConfig,
  steps?: DemoStep[],
  options?: {
    narrate?: boolean;
    ticketDescription?: string;
    acceptanceCriteria?: string;
  },
): Promise<DemoReport> {
  console.log(chalk.cyan.bold("\n🎬 FLARE STACK — Loom Generator\n"));
  console.log(chalk.white(`   Ticket: ${ticketId}`));

  // Determine dev server URL from repo config
  const repoName = Object.keys(config.repos)[0];
  const repoConfig = config.repos[repoName];
  const port = repoConfig?.ports ? Object.values(repoConfig.ports)[0] : 3000;
  const baseUrl = `http://localhost:${port}`;

  console.log(chalk.gray(`   Base URL: ${baseUrl}`));

  const outputDir = join(config.workspacesDir, ticketId, ".loom");

  // ── Narrated pipeline (--narrate) ───────────────────────────────────────
  if (options?.narrate) {
    console.log(chalk.cyan.bold("   🎙️  Narrated walkthrough mode\n"));

    const { generateNarration } = await import("./tts-narrator.js");

    const ticketDesc =
      options.ticketDescription || `Demo walkthrough for ${ticketId}`;
    const ac =
      options.acceptanceCriteria ||
      "Navigate through the main features of the application.";

    const narrationResult = await generateNarration(
      ticketDesc,
      ac,
      baseUrl,
      outputDir,
    );

    // Upload narrated video to Loom
    let loomUrl = "";
    if (narrationResult.videoPath && existsSync(narrationResult.videoPath)) {
      loomUrl = await uploadToLoom(
        narrationResult.videoPath,
        `${ticketId} — Narrated Flare Stack Demo`,
      );
    }

    // Generate report with narration info
    const recordings: DemoRecording[] = narrationResult.scenes.map((scene) => ({
      step: {
        url: baseUrl,
        description: scene.agentInstruction,
        narration: scene.narrationText,
      },
      success: true,
    }));

    const report = generateDemoReport(
      ticketId,
      recordings,
      narrationResult.videoPath,
      loomUrl,
      outputDir,
    );

    console.log(chalk.green.bold(`\n   ✅ Narrated Loom video recorded!`));
    if (narrationResult.merged) {
      console.log(chalk.green("   🔊 Audio narration merged with video"));
    }
    if (loomUrl) {
      console.log(chalk.cyan(`   🔗 ${loomUrl}`));
    }
    console.log(chalk.cyan(`   🎬 ${report.videoPath}`));
    console.log(chalk.cyan(`   📄 ${report.reportPath}\n`));

    return report;
  }

  // ── Standard pipeline (no narration) ────────────────────────────────────
  const demoSteps = steps || getDefaultSteps(baseUrl);
  console.log(chalk.gray(`   Steps: ${demoSteps.length}\n`));

  // Step 1: Record video with Playwright
  const { recordings, videoPath } = await recordLoomVideo(demoSteps, outputDir);

  // Step 2: Upload to Loom
  let loomUrl = "";
  if (videoPath && existsSync(videoPath)) {
    loomUrl = await uploadToLoom(videoPath, `${ticketId} — Flare Stack Demo`);
  }

  // Step 3: Generate report
  const report = generateDemoReport(
    ticketId,
    recordings,
    videoPath,
    loomUrl,
    outputDir,
  );

  console.log(chalk.green.bold(`\n   ✅ Loom video recorded!`));
  if (loomUrl) {
    console.log(chalk.cyan(`   🔗 ${loomUrl}`));
  }
  console.log(chalk.cyan(`   🎬 ${report.videoPath}`));
  console.log(chalk.cyan(`   📄 ${report.reportPath}\n`));

  return report;
}

/**
 * Print loom report summary.
 */
export function printLoomReport(report: DemoReport): void {
  console.log(chalk.cyan.bold("\n🎬 LOOM GENERATOR REPORT\n"));
  console.log(chalk.gray(`   Ticket: ${report.ticketId}`));
  console.log(chalk.gray(`   Generated: ${report.generatedAt}`));
  console.log(
    chalk.gray(
      `   Steps: ${report.recordings.filter((r) => r.success).length}/${report.recordings.length}`,
    ),
  );
  if (report.loomUrl) {
    console.log(chalk.cyan(`   Loom: ${report.loomUrl}`));
  }
  console.log(chalk.cyan(`   Video: ${report.videoPath}`));
  console.log(chalk.cyan(`   Report: ${report.reportPath}\n`));
}
