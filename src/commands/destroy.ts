/**
 * FLARE STACK — Destroy Command
 *
 * `flare extinguish <ticketId>` — Remove a single worktree.
 * `flare extinguish --all` — Clean slate. Remove everything.
 *
 * Interactive mode (no args): Arrow-key picker for single worktree
 * or confirm prompt for destroy all.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import {
  destroyWorktree,
  destroyAllWorktrees,
  listWorktrees,
} from "../core/worktree-manager.js";

export const destroyCommand = new Command("destroy")
  .description("Destroy worktree realities")
  .argument("[ticketId]", "Ticket ID to destroy")
  .option("-a, --all", "Destroy ALL worktrees (clean slate)")
  .option("-y, --yes", "Skip confirmation")
  .action(async (ticketId: string | undefined, options) => {
    const config = await loadConfig();

    console.log(chalk.red.bold("\n💥 FLARE STACK — Destroying Realities\n"));

    // --- Interactive mode: no args ---
    if (!ticketId && !options.all) {
      const { select, confirm } = await import("@inquirer/prompts");

      const mode = await select({
        message: "What do you want to destroy?",
        choices: [
          {
            name: "🎯 Destroy a single worktree",
            value: "single",
          },
          {
            name: "💀 Destroy ALL worktrees (clean slate)",
            value: "all",
          },
        ],
      });

      if (mode === "all") {
        const worktrees = await listWorktrees(config);
        const active = worktrees.filter(
          (wt) => wt.path !== config.repos[wt.repo]?.path,
        );

        const sure = await confirm({
          message: `⚠️  This will destroy ${active.length} worktree(s). Are you sure?`,
          default: false,
        });

        if (sure) {
          await destroyAllWorktrees(config);
        } else {
          console.log(chalk.yellow("\n   Cancelled.\n"));
        }
        return;
      }

      // Single mode: show picker
      const worktrees = await listWorktrees(config);
      const active = worktrees.filter(
        (wt) => wt.path !== config.repos[wt.repo]?.path,
      );

      if (active.length === 0) {
        console.log(
          chalk.yellow(
            "   No active worktrees to destroy. Run `flare ignite` first.\n",
          ),
        );
        return;
      }

      const chosen = await select({
        message: "Pick a reality to destroy:",
        choices: active.map((wt) => {
          // Extract ticket ID from branch name (e.g., feat/IW-6050 → IW-6050)
          const ticket = wt.branch.replace(/^feat\//, "");
          return {
            name: `${ticket}  ${chalk.gray(`(${wt.repo} → ${wt.branch})`)}`,
            value: ticket,
          };
        }),
      });

      console.log(chalk.cyan(`>> Destroying [${chosen}]`));
      await destroyWorktree(chosen, config);
      console.log(chalk.green(`\n✅ Reality [${chosen}] collapsed.\n`));
      return;
    }

    // --- Flag/arg mode (backwards compatible) ---
    if (options.all) {
      if (!options.yes) {
        console.log(chalk.yellow("⚠️  This will remove ALL worktrees."));
        console.log(chalk.yellow("   Run with --yes to confirm."));
        return;
      }

      await destroyAllWorktrees(config);
    } else if (ticketId) {
      console.log(chalk.cyan(`>> Destroying [${ticketId}]`));
      await destroyWorktree(ticketId, config);
      console.log(chalk.green(`\n✅ Reality [${ticketId}] collapsed.\n`));
    } else {
      console.error(chalk.red("❌ Provide a ticket ID or use --all"));
      process.exit(1);
    }
  });
