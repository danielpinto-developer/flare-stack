/**
 * FLARE STACK — Status Command
 *
 * `flare status` — Shows all active worktrees with pipeline progress.
 * Shows every worktree except the main repo root.
 * Includes which phases are complete, current phase, and readiness.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import { listWorktrees } from "../core/worktree-manager.js";
import {
  getFullPipelineModels,
  logModelSelection,
} from "../core/model-router.js";
import {
  loadPipelineState,
  isPipelineComplete,
} from "../core/pipeline-state.js";

export const statusCommand = new Command("status")
  .description("Show all active worktrees with pipeline progress")
  .option("-m, --models", "Show model routing configuration")
  .action(async (options) => {
    const config = await loadConfig();

    console.log(chalk.cyan.bold("\n📊 FLARE STACK — Status\n"));

    const worktrees = await listWorktrees(config);

    // Filter out the main repo worktree (the repo root itself)
    const activeWorktrees = worktrees.filter(
      (wt) => wt.path !== config.repos[wt.repo]?.path,
    );

    if (activeWorktrees.length === 0) {
      console.log(
        chalk.yellow("  No active worktrees. Run `flare ignite` to begin.\n"),
      );
      return;
    }

    // Table header
    console.log(
      chalk.gray("  ") +
        chalk.bold.white("REPO".padEnd(18)) +
        chalk.bold.white("BRANCH".padEnd(30)) +
        chalk.bold.white("STATUS".padEnd(20)) +
        chalk.bold.white("PIPELINE"),
    );
    console.log(chalk.gray("  " + "─".repeat(90)));

    // Table rows — with pipeline state
    for (const wt of activeWorktrees) {
      const repoColor =
        config.repos[wt.repo]?.stack === "react-node"
          ? chalk.blue
          : chalk.magenta;

      // Load pipeline state for this worktree
      const state = await loadPipelineState(wt.path);
      const complete = isPipelineComplete(state);

      let statusText: string;
      let pipelineText: string;

      if (!state) {
        statusText = chalk.gray("Not started");
        pipelineText = chalk.gray("—");
      } else if (complete) {
        statusText = chalk.green("🟢 Ready");
        pipelineText = chalk.green("✅ All phases done → `flare greenlight`");
      } else if (state.currentPhase) {
        statusText = chalk.yellow(`🔥 ${state.currentPhase}`);
        pipelineText = chalk.yellow(
          state.completedPhases.join(" → ") || "(starting)",
        );
      } else {
        const done = state.completedPhases.length;
        statusText = chalk.yellow(`⏸️  Paused (${done})`);
        pipelineText = chalk.yellow(
          state.completedPhases.join(" → ") + " → ⏸️",
        );
      }

      console.log(
        chalk.gray("  ") +
          repoColor(wt.repo.padEnd(18)) +
          chalk.yellow(wt.branch.padEnd(30)) +
          statusText.padEnd(30) +
          pipelineText,
      );
    }

    console.log(chalk.gray("  " + "─".repeat(90)));
    console.log(
      chalk.cyan(`\n  Total: ${activeWorktrees.length} active worktrees\n`),
    );

    // Optionally show model routing
    if (options.models) {
      console.log(chalk.cyan.bold("🧠 Model Routing Configuration\n"));
      const models = getFullPipelineModels(config);
      for (const [phase, selection] of Object.entries(models)) {
        logModelSelection(phase as any, selection);
      }
      console.log("");
    }
  });
