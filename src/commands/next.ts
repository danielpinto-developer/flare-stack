/**
 * FLARE STACK — Next Command
 *
 * `flare next [ticketId]` — Auto-advance to the next phase.
 *
 * Reads .flare-state.json to know where you left off,
 * then runs the next uncompleted phase automatically.
 * Auto-detects ticket from CWD when inside a worktree.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import { listWorktrees } from "../core/worktree-manager.js";
import {
  loadPipelineState,
  getNextPhase,
  isPipelineComplete,
} from "../core/pipeline-state.js";
import { existsSync } from "fs";
import { join } from "path";

export const nextCommand = new Command("next")
  .description("⏭️  Auto-advance to the next pipeline phase")
  .argument("[ticketId]", "Ticket ID (auto-detects from CWD)")
  .option("-r, --repo <repo>", "Target repo")
  .action(async (ticketId: string | undefined, options) => {
    const config = await loadConfig();

    console.log(chalk.cyan.bold("\n⏭️  FLARE STACK — Next Phase\n"));

    // --- Auto-detect or pick ticket ---
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
        message: "Pick a ticket to advance:",
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

    // Load state
    const state = await loadPipelineState(worktreePath);

    // Check if complete
    if (isPipelineComplete(state)) {
      console.log(chalk.green.bold("   ✅ All phases complete!"));
      console.log(
        chalk.gray(`   Completed: ${state!.completedPhases.join(" → ")}\n`),
      );
      console.log(
        chalk.gray("   Use `flare greenlight --restart` to re-run.\n"),
      );
      return;
    }

    // Get next phase
    const next = getNextPhase(state);

    if (!next) {
      console.log(chalk.green.bold("   ✅ Pipeline already complete!\n"));
      return;
    }

    // Auto-skip forge for backend-only tickets
    if (next === "forging" && state?.ticketType === "backend") {
      console.log(
        chalk.gray(
          "   ⏭️  Skipping forge (backend-only ticket — no UI work)\n",
        ),
      );
      // Auto-complete the forging phase
      const { markPhaseCompleted } = await import("../core/pipeline-state.js");
      await markPhaseCompleted(worktreePath, resolvedTicketId!, "forging");
      // Recurse to get the actual next phase (scanning)
      const updatedState = await loadPipelineState(worktreePath);
      const actualNext = getNextPhase(updatedState);
      if (!actualNext) {
        console.log(chalk.green.bold("   ✅ Pipeline already complete!\n"));
        return;
      }
      // Continue with actual next phase (scanning)
      console.log(
        chalk.cyan.bold(`   ⏭️  Next phase: ${actualNext.toUpperCase()}\n`),
      );
      const {
        planCommand: pc,
        verifyCommand: vc,
        implementCommand: ic,
        auditCommand: ac,
      } = await import("./phases.js");
      const { scanCommand: sc } = await import("./scan.js");
      const skipCmdMap: Record<string, import("commander").Command> = {
        planning: pc,
        verification: vc,
        implementation: ic,
        scanning: sc,
        audit: ac,
      };
      const skipCmd = skipCmdMap[actualNext];
      if (skipCmd) {
        await skipCmd.parseAsync([
          "node",
          "flare",
          resolvedTicketId!,
          ...(options.repo ? ["-r", options.repo] : []),
        ]);
      }
      return;
    }

    // Show progress
    if (state && state.completedPhases.length > 0) {
      console.log(
        chalk.green(`   ✅ Completed: ${state.completedPhases.join(" → ")}`),
      );
    }

    const phaseCmd =
      next === "planning"
        ? "plan"
        : next === "verification"
          ? "verify"
          : next === "implementation"
            ? "implement"
            : next === "forging"
              ? "forge"
              : next === "scanning"
                ? "scan"
                : "audit";

    console.log(chalk.cyan.bold(`   ⏭️  Next phase: ${next.toUpperCase()}\n`));
    console.log(
      chalk.white(`   Running: flare ${phaseCmd} ${resolvedTicketId}\n`),
    );

    // Execute the phase command directly by importing and triggering
    // We use the same import that the CLI uses
    const { planCommand, verifyCommand, implementCommand, auditCommand } =
      await import("./phases.js");
    const { scanCommand: scanCmd } = await import("./scan.js");
    const { forgeCommand: forgeCmd } = await import("./forge.js");

    const cmdMap: Record<string, import("commander").Command> = {
      planning: planCommand,
      verification: verifyCommand,
      implementation: implementCommand,
      forging: forgeCmd,
      scanning: scanCmd,
      audit: auditCommand,
    };

    const cmd = cmdMap[next];
    await cmd.parseAsync([
      "node",
      "flare",
      resolvedTicketId!,
      ...(options.repo ? ["-r", options.repo] : []),
    ]);
  });
