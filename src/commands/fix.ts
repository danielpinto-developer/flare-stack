/**
 * FLARE STACK — Fix Command
 *
 * `flare fix "change the migration name to XYZ"`
 * `flare fix` (interactive — prompts for correction)
 *
 * Re-runs the last completed phase with the user's natural language
 * correction appended. Like talking to an AI agent in the terminal.
 *
 * The AI gets:
 *   - Original prompt for that phase
 *   - All existing context (Jira ticket, project config, etc.)
 *   - Previous output of that phase
 *   - The user's correction as a top-priority instruction
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import {
  selectModel,
  logModelSelection,
  type WorkflowPhase,
} from "../core/model-router.js";
import { executePrompt, logAIResponse } from "../core/ai-executor.js";
import { listWorktrees } from "../core/worktree-manager.js";
import { loadPipelineState } from "../core/pipeline-state.js";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join, basename } from "path";

const PHASE_META: Record<string, string> = {
  planning: "1_PLAN.md",
  verification: "2_VERIFY.md",
  implementation: "3_IMPLEMENT.md",
  forging: "5_FORGE.md",
  scanning: "5_SCAN.md",
  audit: "4_AUDIT.md",
};

export const fixCommand = new Command("fix")
  .description("Give natural language corrections to re-run the last phase")
  .argument(
    "[correction...]",
    'Correction text (e.g. "change the table name to foo_bar")',
  )
  .option(
    "-p, --phase <phase>",
    "Override which phase to fix (planning, verification, etc.)",
  )
  .option("-r, --repo <repo>", "Target repo override")
  .action(async (correctionParts: string[], options) => {
    const config = await loadConfig();

    console.log(chalk.cyan.bold("\n✏️  FLARE STACK — Fix Mode\n"));

    // Resolve worktree
    const cwd = process.cwd();
    const dirName = basename(cwd);
    const worktrees = await listWorktrees(config);
    const wt = worktrees.find(
      (w) => basename(w.path) === dirName || w.repo === dirName,
    );
    const worktreePath = wt?.path || cwd;
    const ticketId = dirName.match(/^[A-Z]+-\d+$/)?.[0] || dirName;

    console.log(chalk.gray(`   📂 Worktree: ${worktreePath}`));
    console.log(chalk.gray(`   🎫 Ticket: ${ticketId}`));

    // Load pipeline state to find last completed phase
    const state = await loadPipelineState(worktreePath);
    if (!state || state.completedPhases.length === 0) {
      console.log(
        chalk.red("\n   ❌ No completed phases found. Run a phase first.\n"),
      );
      console.log(chalk.yellow("   Try: flare plan"));
      return;
    }

    // Determine which phase to fix
    let targetPhase: WorkflowPhase;
    if (options.phase) {
      targetPhase = options.phase as WorkflowPhase;
    } else {
      // Use the last completed phase
      targetPhase = state.completedPhases[
        state.completedPhases.length - 1
      ] as WorkflowPhase;
    }

    console.log(chalk.cyan(`   🔧 Fixing phase: ${targetPhase.toUpperCase()}`));

    // Get the correction text
    let correction = correctionParts.join(" ").trim();
    if (!correction) {
      // Interactive mode — ask for correction
      const { editor } = await import("@inquirer/prompts");
      correction = await editor({
        message: chalk.yellow("What needs to change? (opens editor)"),
        default:
          "# Describe your correction below\n# Be specific about what to change:\n\n",
        postfix: ".md",
      });
    }

    if (!correction.trim()) {
      console.log(chalk.yellow("\n   ⚠️  No correction provided. Aborting."));
      return;
    }

    console.log(
      chalk.green(`\n   📝 Correction received (${correction.length} chars)`),
    );

    // Load the original prompt for this phase
    const promptFile = PHASE_META[targetPhase];
    if (!promptFile) {
      console.log(chalk.red(`\n   ❌ Unknown phase: ${targetPhase}`));
      return;
    }

    const promptPath = join(worktreePath, promptFile);
    if (!existsSync(promptPath)) {
      console.log(chalk.red(`\n   ❌ Prompt file not found: ${promptFile}`));
      return;
    }

    const promptContent = await readFile(promptPath, "utf-8");

    // Build context (same as phases.ts)
    let context = "";

    // Jira ticket data
    if (config.jira?.cloudId) {
      try {
        const { JiraMcpSource } = await import("../sources/jira-mcp-source.js");
        const firstRepo = Object.keys(config.repos)[0]!;
        const firstBranch = config.repos[firstRepo]?.branches?.[0] || "develop";
        const source = new JiraMcpSource(
          config.jira.mcpServer,
          config.jira.cloudId,
          config.jira.projectKeys,
          firstRepo,
          firstBranch,
          config.jira.queueStatus,
          config.jira.siteUrl,
        );
        const ticket = await source.fetchIssue(ticketId);
        if (ticket?.rawContent) {
          console.log(chalk.green(`   ✅ Fetched live ticket data from Jira`));
          context += `JIRA TICKET:\n${ticket.rawContent}\n`;
        }
      } catch (err) {
        console.log(
          chalk.yellow(
            `   ⚠️  Could not fetch Jira ticket: ${err instanceof Error ? err.message : err}`,
          ),
        );
      }
    }

    // Project configuration
    context += "\n\nPROJECT CONFIGURATION:\n";
    context += `Ticket: ${ticketId}\n`;
    context += `Branching Pattern: ${config.branching.pattern}\n`;
    context += `Repositories:\n`;
    for (const [name, repo] of Object.entries(config.repos)) {
      context += `  - ${name}: ${repo.path}\n`;
      context += `    Active branches: ${repo.branches.join(", ")}\n`;
    }

    // Load the PREVIOUS output for this phase (what we're correcting)
    const prevOutputPath = join(
      worktreePath,
      `OUTPUT_${targetPhase.toUpperCase()}.md`,
    );
    let prevOutput = "";
    if (existsSync(prevOutputPath)) {
      prevOutput = await readFile(prevOutputPath, "utf-8");
      context += `\n\n═══ YOUR PREVIOUS OUTPUT (THIS IS WHAT YOU'RE CORRECTING) ═══\n${prevOutput}`;
    }

    // Code review prompt
    const codeReviewPath = join(worktreePath, "CODE_REVIEW_PROMPT.md");
    if (existsSync(codeReviewPath)) {
      const codeReview = await readFile(codeReviewPath, "utf-8");
      context += `\n\nCODE REVIEW STANDARDS:\n${codeReview}`;
    }

    // THE KEY PART — inject the user's correction as a top-priority instruction
    context += `\n\n${"═".repeat(60)}\n`;
    context += `🔥 DEVELOPER CORRECTION — THIS OVERRIDES EVERYTHING ABOVE 🔥\n`;
    context += `${"═".repeat(60)}\n\n`;
    context += `The developer has reviewed your previous output and wants the following changes:\n\n`;
    context += `${correction}\n\n`;
    context += `Re-generate the COMPLETE output for this phase with these corrections applied.\n`;
    context += `Keep everything else that was correct. Only change what the developer asked for.\n`;
    context += `Output the full document — not just the changed parts.\n`;

    // Execute AI
    console.log(chalk.cyan("\n" + "═".repeat(60)));
    console.log(
      chalk.white.bold(
        `\n   🔧 Re-running ${targetPhase.toUpperCase()} with corrections...\n`,
      ),
    );

    const modelConfig = config.models[targetPhase];
    const selection = selectModel(targetPhase, config);
    logModelSelection(targetPhase, selection);

    try {
      const response = await executePrompt(promptContent, context, modelConfig);
      logAIResponse(response);

      // Save output (overwrite previous)
      await writeFile(prevOutputPath, response.content);
      console.log(
        chalk.green(`   💾 Updated: OUTPUT_${targetPhase.toUpperCase()}.md`),
      );

      // Save correction to a log
      const fixLogPath = join(worktreePath, "FIX_LOG.md");
      const timestamp = new Date().toISOString();
      const logEntry = `\n---\n## Fix: ${targetPhase.toUpperCase()} — ${timestamp}\n\n**Correction:**\n${correction}\n\n**Response length:** ${response.content.length} chars\n`;

      let existingLog = "";
      if (existsSync(fixLogPath)) {
        existingLog = await readFile(fixLogPath, "utf-8");
      } else {
        existingLog =
          "# FLARE FIX LOG\n\nHistory of corrections applied during this ticket.\n";
      }
      await writeFile(fixLogPath, existingLog + logEntry);
      console.log(chalk.gray(`   📋 Fix logged to FIX_LOG.md`));

      console.log(chalk.cyan("\n" + "═".repeat(60)));
      console.log(
        chalk.green.bold(`\n   ✅ ${targetPhase.toUpperCase()} CORRECTED\n`),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(chalk.red(`\n   ❌ Fix failed: ${message}\n`));
    }
  });
