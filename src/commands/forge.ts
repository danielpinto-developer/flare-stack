/**
 * FLARE STACK — Forge Command
 *
 * `flare forge [ticketId]` — Iteratively refine frontend UI.
 *
 * Interactive loop:
 *   1. User provides feedback (text + optional screenshot + optional Figma URL)
 *   2. AI generates targeted code fixes using Gemini 3 Pro (multimodal)
 *   3. User reviews, applies fixes, checks UI
 *   4. Repeat until "done"
 *
 * Sits between implement and scan in the pipeline.
 * Only needed for frontend/UI tickets — backend skips to scan.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import { listWorktrees } from "../core/worktree-manager.js";
import { executePrompt, logAIResponse } from "../core/ai-executor.js";
import {
  markPhaseStarted,
  markPhaseCompleted,
  loadPipelineState,
} from "../core/pipeline-state.js";
import { existsSync } from "fs";
import { readFile, writeFile, appendFile } from "fs/promises";
import { join } from "path";
import type { FlareConfig } from "../config/schema.js";

export const forgeCommand = new Command("forge")
  .description("🔨 Iteratively refine frontend UI against design specs")
  .argument("[ticketId]", "Ticket ID (auto-detects from CWD)")
  .option("-r, --repo <repo>", "Target repo")
  .option("-s, --screenshot <path>", "Screenshot of current UI state")
  .option("-f, --figma <url>", "Figma URL for design reference")
  .action(async (ticketId: string | undefined, options) => {
    const config = await loadConfig();

    console.log(chalk.cyan.bold("\n🔨 FLARE STACK — Forge\n"));
    console.log(
      chalk.gray(
        "   Iteratively refine your frontend UI. Type 'done' when satisfied.\n",
      ),
    );

    // --- Auto-detect ticket from CWD ---
    let resolvedTicketId = ticketId;

    if (!resolvedTicketId) {
      const cwd = process.cwd();
      if (cwd.startsWith(config.workspacesDir)) {
        const relative = cwd.slice(config.workspacesDir.length + 1);
        const parts = relative.split("/");
        if (parts[0]) {
          resolvedTicketId = parts[0];
          console.log(
            chalk.gray(`   Auto-detected ticket from CWD: ${resolvedTicketId}`),
          );
        }
      }
    }

    if (!resolvedTicketId) {
      const worktrees = await listWorktrees(config);
      const active = worktrees.filter(
        (wt) => wt.path !== config.repos[wt.repo]?.path,
      );

      if (active.length === 0) {
        console.log(
          chalk.yellow(
            "   No active worktrees found. Run `flare ignite` first.\n",
          ),
        );
        process.exit(1);
      }

      const { select } = await import("@inquirer/prompts");
      resolvedTicketId = await select({
        message: "Pick a ticket to forge:",
        choices: active.map((wt) => {
          const ticket = wt.branch.replace(/^feat\//, "");
          return {
            name: `${ticket}  ${chalk.gray(`(${wt.repo} → ${wt.branch})`)}`,
            value: ticket,
          };
        }),
      });
    }

    // Resolve worktree path
    const worktreePath = join(config.workspacesDir, resolvedTicketId!);

    if (!existsSync(worktreePath)) {
      console.error(chalk.red(`\n❌ Worktree not found: ${worktreePath}`));
      console.error(chalk.yellow("   Run `flare ignite` first.\n"));
      process.exit(1);
    }

    // Read forge prompt
    const promptPath = join(worktreePath, "5_FORGE.md");
    if (!existsSync(promptPath)) {
      // Copy from bundled prompts
      const { resolve, dirname } = await import("path");
      const { fileURLToPath } = await import("url");
      const possiblePaths = [
        resolve(
          dirname(fileURLToPath(import.meta.url)),
          "../prompts/5_FORGE.md",
        ),
        resolve(
          dirname(fileURLToPath(import.meta.url)),
          "../../prompts/5_FORGE.md",
        ),
        resolve(process.cwd(), "prompts/5_FORGE.md"),
      ];
      let found = false;
      for (const p of possiblePaths) {
        if (existsSync(p)) {
          const content = await readFile(p, "utf-8");
          await writeFile(promptPath, content, "utf-8");
          found = true;
          break;
        }
      }
      if (!found) {
        console.error(
          chalk.red("❌ 5_FORGE.md prompt not found. Rebuild flare-stack."),
        );
        process.exit(1);
      }
    }

    const promptContent = await readFile(promptPath, "utf-8");

    // Build static context (ticket + implementation output + config)
    let staticContext = "";

    // Fetch live ticket details from Jira MCP
    if (config.jira.cloudId && resolvedTicketId) {
      try {
        const { JiraMcpSource } = await import("../sources/jira-mcp-source.js");
        const firstRepo = Object.keys(config.repos)[0] || "";
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
        const ticket = await source.fetchIssue(resolvedTicketId);
        if (ticket?.rawContent) {
          console.log(chalk.green(`   ✅ Fetched live ticket data from Jira`));
          staticContext += `JIRA TICKET:\n${ticket.rawContent}\n`;
        }
      } catch (err) {
        console.log(
          chalk.yellow(
            `   ⚠️  Could not fetch Jira ticket: ${err instanceof Error ? err.message : err}`,
          ),
        );
      }
    }

    // Read implementation output if available
    const implOutputPath = join(worktreePath, "OUTPUT_IMPLEMENTATION.md");
    if (existsSync(implOutputPath)) {
      const implOutput = await readFile(implOutputPath, "utf-8");
      staticContext += `\n\nIMPLEMENTATION OUTPUT:\n${implOutput}\n`;
    }

    // Project config
    staticContext += "\n\nPROJECT CONFIGURATION:\n";
    staticContext += `Ticket: ${resolvedTicketId}\n`;
    staticContext += `Branching Pattern: ${config.branching.pattern}\n`;
    staticContext += `Repositories:\n`;
    for (const [name, repo] of Object.entries(config.repos)) {
      staticContext += `  - ${name}: ${repo.path}\n`;
      staticContext += `    Source of truth: ${repo.branches[0]}\n`;
    }

    // Forge log for persistence across iterations
    const forgeLogPath = join(worktreePath, "FORGE_LOG.md");
    let iterationCount = 0;

    // Mark phase started
    await markPhaseStarted(worktreePath, resolvedTicketId!, "forging");

    const modelConfig =
      (config.models as any).forging || config.models.implementation;

    console.log(
      chalk.cyan(`🔨 Phase: FORGING`),
      chalk.white("→"),
      chalk.bold(
        `${modelConfig.provider}/${modelConfig.model} (${modelConfig.tier})`,
      ),
      chalk.red(`[${modelConfig.tier.toUpperCase()}]`),
      chalk.gray(`temp=${modelConfig.temperature}`),
    );

    // ─── Interactive Forge Loop ───
    const { input: inputPrompt } = await import("@inquirer/prompts");

    while (true) {
      console.log(chalk.cyan("\n" + "─".repeat(60)));
      iterationCount++;
      console.log(
        chalk.white.bold(`\n   🔨 Forge Iteration #${iterationCount}\n`),
      );

      // Get user feedback
      const feedback = await inputPrompt({
        message: chalk.yellow('💬 What needs fixing? (or "done" to finish):'),
      });

      if (
        feedback.trim().toLowerCase() === "done" ||
        feedback.trim().toLowerCase() === "ship it" ||
        feedback.trim().toLowerCase() === "exit"
      ) {
        break;
      }

      // Optional screenshot from flag or prompt
      let screenshotPath = options.screenshot || "";
      if (!screenshotPath) {
        const ssAnswer = await inputPrompt({
          message: chalk.gray(
            "📸 Screenshot path (drag file here, or press Enter to skip):",
          ),
        });
        screenshotPath = ssAnswer.trim();
      }

      // Optional Figma URL from flag or prompt
      let figmaUrl = options.figma || "";
      if (!figmaUrl) {
        const figmaAnswer = await inputPrompt({
          message: chalk.gray(
            "🎨 Figma URL (paste URL, or press Enter to skip):",
          ),
        });
        figmaUrl = figmaAnswer.trim();
      }

      // Build iteration context
      let iterationContext = staticContext;

      // Add forge log (previous iterations)
      if (existsSync(forgeLogPath)) {
        const forgeLog = await readFile(forgeLogPath, "utf-8");
        iterationContext += `\n\nPREVIOUS FORGE ITERATIONS:\n${forgeLog}\n`;
      }

      // Add user feedback
      iterationContext += `\n\nUSER FEEDBACK (Iteration #${iterationCount}):\n${feedback}\n`;

      // Add screenshot context
      if (screenshotPath && existsSync(screenshotPath)) {
        iterationContext += `\n\nSCREENSHOT PROVIDED: ${screenshotPath}\n`;
        iterationContext += `(The screenshot shows the current state of the UI that needs fixing)\n`;
        // TODO: When multimodal API support is wired in, pass the image directly
        console.log(
          chalk.green(`   📸 Screenshot referenced: ${screenshotPath}`),
        );
      }

      // Add Figma context
      if (figmaUrl) {
        iterationContext += `\n\nFIGMA DESIGN REFERENCE: ${figmaUrl}\n`;
        iterationContext += `(This is the target design the UI should match)\n`;
        console.log(chalk.green(`   🎨 Figma reference: ${figmaUrl}`));
      }

      // Execute AI
      console.log(chalk.cyan("\n" + "═".repeat(60)));
      console.log(
        chalk.white.bold(`\n   🔨 Forging Iteration #${iterationCount}...\n`),
      );

      try {
        const response = await executePrompt(
          promptContent,
          iterationContext,
          modelConfig,
        );
        logAIResponse(response);

        // Save iteration output
        const outputPath = join(
          worktreePath,
          `OUTPUT_FORGE_${iterationCount}.md`,
        );
        await writeFile(outputPath, response.content, "utf-8");
        console.log(
          chalk.gray(`   💾 Output saved: OUTPUT_FORGE_${iterationCount}.md`),
        );

        // Append to forge log
        const logEntry = `\n## Iteration #${iterationCount}\n**Feedback:** ${feedback}\n**Response:**\n${response.content}\n\n---\n`;
        await appendFile(forgeLogPath, logEntry, "utf-8");
      } catch (err) {
        console.error(
          chalk.red(
            `\n❌ Forge failed: ${err instanceof Error ? err.message : err}`,
          ),
        );
        const retry = await inputPrompt({
          message: chalk.yellow("Retry? (y/n):"),
        });
        if (retry.trim().toLowerCase() !== "y") {
          break;
        }
      }

      // Clear screenshot/figma for next iteration (user can provide new ones)
      options.screenshot = undefined;
      options.figma = undefined;
    }

    // Mark phase complete
    await markPhaseCompleted(worktreePath, resolvedTicketId!, "forging");

    console.log(chalk.cyan.bold("\n" + "═".repeat(60)));
    console.log(
      chalk.green.bold(
        `\n   ✅ Forge complete! ${iterationCount - 1} iteration(s) applied.`,
      ),
    );
    console.log(chalk.gray(`   📄 Forge log: ${forgeLogPath}`));
    console.log(chalk.cyan(`\n   ⏭️  Next: flare scan ${resolvedTicketId}\n`));
  });
