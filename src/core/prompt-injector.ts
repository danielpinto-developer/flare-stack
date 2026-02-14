/**
 * FLARE STACK — Prompt Injector
 *
 * Copies prompt files and context (Jira ticket, code review rules)
 * into a worktree so the AI agent has everything it needs.
 *
 * This is the "Neural Link" — the bridge between Human Intent and AI Execution.
 */

import { copyFile, readFile, writeFile, access, readdir } from "fs/promises";
import { join, resolve, dirname } from "path";
import { existsSync, cpSync } from "fs";
import { homedir } from "os";
import chalk from "chalk";
import type { FlareConfig, RepoConfig } from "../config/schema.js";
import type { Ticket } from "../sources/types.js";
import { fileURLToPath } from "url";

/**
 * Inject all required context files into a worktree.
 *
 * Injects:
 * 1. 1_PLAN.md through 4_AUDIT.md — Prompt lifecycle
 * 2. CODE_REVIEW_PROMPT.md — Repo-specific quality gate
 * 3. Images (if available) — Figma/screenshot references
 */
export interface InjectionResult {
  ticketId: string;
  worktreePath: string;
  filesInjected: string[];
  hasImages: boolean;
}

export async function injectPrompts(
  ticket: Ticket,
  worktreePath: string,
  config: FlareConfig,
): Promise<InjectionResult> {
  console.log(chalk.cyan("   📡 Injecting Neural Links..."));

  const repoConfig = config.repos[ticket.targetRepo];
  const filesInjected: string[] = [];
  let hasImages = false;

  // 1. Copy prompt lifecycle files (ticket data fetched live at phase time)

  // 2. Copy prompt lifecycle files
  const promptFiles = [
    { configKey: "plan" as const, filename: "1_PLAN.md" },
    { configKey: "verify" as const, filename: "2_VERIFY.md" },
    { configKey: "implement" as const, filename: "3_IMPLEMENT.md" },
    { configKey: "audit" as const, filename: "4_AUDIT.md" },
  ];

  const promptsDir = getPromptsDir();

  for (const prompt of promptFiles) {
    const sourcePath = config.prompts[prompt.configKey];
    const absoluteSource = sourcePath.startsWith("/")
      ? sourcePath
      : join(promptsDir, sourcePath);

    if (!existsSync(absoluteSource)) {
      throw new Error(
        `❌ Missing prompt file: ${absoluteSource}\n   Run 'flare init' or check your prompts/ directory.`,
      );
    }
    let promptContent = await readFile(absoluteSource, "utf-8");

    // Replace template variables — only if branch is known.
    // If not known, leave [SOURCE_BRANCH] as-is so the AI asks the user.
    const sourceBranch = ticket.sourceBranch || repoConfig?.branches?.[0];
    if (sourceBranch) {
      promptContent = promptContent.replaceAll("[SOURCE_BRANCH]", sourceBranch);
    }

    await writeFile(
      join(worktreePath, prompt.filename),
      promptContent,
      "utf-8",
    );
    filesInjected.push(prompt.filename);
  }

  // 2b. Write TICKET.md — Jira ticket context for the AI pipeline
  const ticketMd = [
    `# ${ticket.id} — ${ticket.summary || ""}`,
    "",
    `**Assignee:** ${ticket.assignee || "Unassigned"}`,
    `**Target Repo:** ${ticket.targetRepo || "Unknown"}`,
    `**Source Branch:** ${ticket.sourceBranch || "Unknown"}`,
    "",
    "---",
    "",
    ticket.rawContent || ticket.summary || "(No description available)",
  ].join("\n");
  await writeFile(join(worktreePath, "TICKET.md"), ticketMd, "utf-8");
  filesInjected.push("TICKET.md");

  // 3. Copy repo-specific Code Review Prompt
  if (repoConfig?.codeReviewPrompt && existsSync(repoConfig.codeReviewPrompt)) {
    await copyFile(
      repoConfig.codeReviewPrompt,
      join(worktreePath, "CODE_REVIEW_PROMPT.md"),
    );
    filesInjected.push("CODE_REVIEW_PROMPT.md");
  }

  // 4. Copy images if available (Figma screenshots, etc.)
  const imagesDir = join(config.workspacesDir, "..", "jira_images", ticket.id);
  if (existsSync(imagesDir)) {
    try {
      cpSync(imagesDir, join(worktreePath, "images"), { recursive: true });
      console.log(chalk.cyan("   🖼️  Images transferred."));
      hasImages = true;
    } catch {
      // Non-critical
    }
  }

  // 5. Copy .agent/workflows/ — Agent Manager AI command definitions
  //    Strategy: enterprise workflows first (baseline), then personal overrides on top.
  //    Personal overrides live in ~/.flare/workflows/ and are never committed.
  //    This lets power users (Google AI Ultra, Claude, etc.) use their own model
  //    via direct-mode workflows while everyone else gets the CLI-based enterprise flow.
  const targetWorkflows = join(worktreePath, ".agent", "workflows");

  // 5a. Enterprise baseline — bundled with flare-stack
  const workflowsSource = getWorkflowsDir();
  if (workflowsSource) {
    try {
      cpSync(workflowsSource, targetWorkflows, { recursive: true });
      filesInjected.push(".agent/workflows/");
    } catch {
      // Non-critical
    }
  }

  // 5b. Personal overrides — ~/.flare/workflows/ (if present, overlay on top)
  const personalWorkflows = getPersonalWorkflowsDir();
  if (personalWorkflows) {
    try {
      cpSync(personalWorkflows, targetWorkflows, { recursive: true });
      filesInjected.push(".agent/workflows/ (personal overrides)");
      console.log(chalk.magenta("   🔮 Personal workflow overrides detected."));
    } catch {
      // Non-critical — fall back to enterprise workflows silently
    }
  }

  // 6. Copy flare.config.ts into the chamber — so flare CLI works from CWD
  const repoPath = repoConfig?.path;
  if (repoPath) {
    const configNames = [
      "flare.config.ts",
      "flare.config.js",
      "flare.config.json",
    ];
    for (const name of configNames) {
      const configSrc = join(repoPath, name);
      if (existsSync(configSrc)) {
        await copyFile(configSrc, join(worktreePath, name));
        filesInjected.push(name);
        break;
      }
    }
  }

  console.log(chalk.green("   ✅ Neural Links injected."));

  return {
    ticketId: ticket.id,
    worktreePath,
    filesInjected,
    hasImages,
  };
}

/**
 * Get the path to the bundled prompts directory.
 * Works both in development (src/) and production (dist/).
 */
function getPromptsDir(): string {
  // Try to find prompts relative to the package root
  const possiblePaths = [
    resolve(dirname(fileURLToPath(import.meta.url)), "../prompts"),
    resolve(dirname(fileURLToPath(import.meta.url)), "../../prompts"),
    resolve(process.cwd(), "prompts"),
    resolve(process.cwd(), "flare_toolkit"),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) return p;
  }

  throw new Error(
    `❌ Prompts directory not found. Checked:\n${possiblePaths.map((p) => `   - ${p}`).join("\n")}\n   Run 'flare init' or ensure prompts/ exists in your Flare Stack installation.`,
  );
}

/**
 * Get the path to the bundled workflows directory.
 * Returns null if not found (non-critical).
 */
function getWorkflowsDir(): string | null {
  const possiblePaths = [
    resolve(dirname(fileURLToPath(import.meta.url)), "../workflows"),
    resolve(dirname(fileURLToPath(import.meta.url)), "../../workflows"),
    resolve(process.cwd(), "workflows"),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) return p;
  }

  return null;
}

/**
 * Get the path to personal workflow overrides.
 * Lives in ~/.flare/workflows/ — never committed, never pushed.
 * Power users can override enterprise workflows with direct-mode versions
 * that use the AI agent's own model instead of the CLI pipeline.
 */
function getPersonalWorkflowsDir(): string | null {
  try {
    const personalDir = join(homedir(), ".flare", "workflows");
    if (existsSync(personalDir)) return personalDir;
  } catch {
    // homedir() can throw on exotic systems — fail silently
  }
  return null;
}
