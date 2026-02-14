/**
 * FLARE STACK — Scan Command (Scavenger Bot)
 *
 * `flare scan [ticketId]` — Run the Scavenger Bot blast radius scanner.
 *
 * The Scavenger Bot traces your changed files, builds the blast radius
 * (connected files up to N levels deep), and uses AI to find collateral
 * damage — broken contracts, stale references, missing error handling.
 *
 * Phase 4 of 5 in the combustion cycle:
 *   Plan → Verify → Implement → **Scan** → Audit
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import { runScavengerBot, printScavengerReport } from "../quality/scavenger.js";
import { selectModel, logModelSelection } from "../core/model-router.js";
import {
  markPhaseStarted,
  markPhaseCompleted,
  loadPipelineState,
} from "../core/pipeline-state.js";
import { listWorktrees } from "../core/worktree-manager.js";
import { existsSync } from "fs";
import { writeFile } from "fs/promises";
import { join } from "path";

export const scanCommand = new Command("scan")
  .description("🔎 Scavenger Bot — blast radius scan for collateral damage")
  .argument("[ticketId]", "Ticket ID (auto-detects from CWD)")
  .option("-r, --repo <repo>", "Target repo")
  .option("--strict", "Exit with code 1 if findings found")
  .action(async (ticketId: string | undefined, options) => {
    const config = await loadConfig();

    console.log(
      chalk.cyan.bold(
        "\n🔎 FLARE STACK — Scavenger Bot (Blast Radius Scanner)\n",
      ),
    );

    // --- Auto-detect or pick ticket ---
    let resolvedTicketId = ticketId;

    if (!resolvedTicketId) {
      const cwd = process.cwd();
      if (cwd.includes("flare-chambers")) {
        const parts = cwd.split("/");
        const chambersIdx = parts.indexOf("flare-chambers");
        if (chambersIdx >= 0 && parts[chambersIdx + 1]) {
          resolvedTicketId = parts[chambersIdx + 1];
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
        message: "Pick a ticket to scan:",
        choices: active.map((wt) => {
          const ticket = wt.branch.replace(/^feat\//, "");
          return {
            name: `${ticket}  ${chalk.gray(`(${wt.repo} → ${wt.branch})`)}`,
            value: ticket,
          };
        }),
      });
    }

    console.log(chalk.white(`   Ticket: ${resolvedTicketId}`));

    // Resolve worktree
    const worktreePath = join(config.workspacesDir, resolvedTicketId!);

    if (!existsSync(worktreePath)) {
      console.error(chalk.red(`\n❌ Worktree not found: ${worktreePath}`));
      console.error(chalk.yellow("   Run `flare ignite` first.\n"));
      process.exit(1);
    }

    // Show model for scanning phase
    const model = selectModel("scanning", config);
    console.log("");
    logModelSelection("scanning", model);

    // Check current state
    const state = await loadPipelineState(worktreePath);
    if (state && state.completedPhases.includes("scanning")) {
      console.log(
        chalk.gray("   ℹ️  This phase was already completed previously."),
      );
    }

    // Mark phase as started
    await markPhaseStarted(worktreePath, resolvedTicketId!, "scanning");

    // Run the Scavenger Bot
    console.log(chalk.cyan("\n" + "═".repeat(60)));
    console.log(chalk.white.bold("\n   🚀 Launching Scavenger Bot...\n"));

    try {
      const modelConfig = config.models.scanning;
      const report = await runScavengerBot(worktreePath, config, modelConfig);

      // Print report
      printScavengerReport(report);

      // Save output
      const outputPath = join(worktreePath, "OUTPUT_SCANNING.md");
      const outputContent = [
        "# Scavenger Bot — Blast Radius Report",
        "",
        `**Changed files:** ${report.changedFiles.length}`,
        `**Blast radius:** ${report.blastRadiusFiles.length} connected files`,
        `**Total analyzed:** ${report.totalFilesAnalyzed}`,
        `**Model:** ${report.aiModel}`,
        `**Duration:** ${(report.duration / 1000).toFixed(1)}s`,
        "",
        report.clean
          ? "## ✅ ALL CLEAR — No collateral damage detected."
          : `## ⚠️ ${report.findings.length} Finding(s)`,
        "",
        ...report.findings.map(
          (f) =>
            `- **[${f.severity.toUpperCase()}]** \`${f.file}\`${f.lineRange ? `:${f.lineRange}` : ""} — [${f.category}] ${f.description}${f.suggestion ? ` 💡 ${f.suggestion}` : ""}`,
        ),
      ].join("\n");

      await writeFile(outputPath, outputContent, "utf-8");
      console.log(chalk.green("   💾 Output saved: OUTPUT_SCANNING.md"));

      // Mark phase as completed
      await markPhaseCompleted(worktreePath, resolvedTicketId!, "scanning");

      console.log(chalk.cyan("\n" + "═".repeat(60)));
      if (report.clean) {
        console.log(
          chalk.green.bold("\n   ✅ SCANNING COMPLETE — All clear!\n"),
        );
      } else {
        console.log(
          chalk.yellow.bold(
            `\n   ⚠️ SCANNING COMPLETE — ${report.findings.length} finding(s). Review before audit.\n`,
          ),
        );
      }

      if (options.strict && !report.clean) {
        process.exit(1);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n   ❌ SCANNING FAILED: ${message}`));

      const { select } = await import("@inquirer/prompts");
      const action = await select({
        message: "Scavenger Bot scan failed. What do you want to do?",
        choices: [
          { name: "🔄 Retry scan", value: "retry" },
          { name: "🛑 Stop", value: "stop" },
        ],
      });

      if (action === "retry") {
        console.log(
          chalk.yellow(`\n   🔄 Re-run: flare scan ${resolvedTicketId}\n`),
        );
        return;
      }

      process.exit(1);
    }
  });
