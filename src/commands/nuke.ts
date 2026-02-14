/**
 * FLARE STACK — Nuke Command
 *
 * `flare nuke` — Remove finished/stale chambers without full re-init.
 *
 * Designed for routine housekeeping:
 * - Keeps the flare-chambers directory intact
 * - Interactive picker: choose which chambers to remove
 * - `--stale <days>` auto-selects chambers older than N days
 * - `--all` removes all chambers (but keeps the directory)
 * - Properly removes git worktrees and prunes
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import { destroyWorktree, listWorktrees } from "../core/worktree-manager.js";
import { existsSync, readdirSync, statSync, mkdirSync } from "fs";
import { join } from "path";

export const nukeCommand = new Command("nuke")
  .description(
    "💣 Nuke finished/stale chambers — keeps flare-chambers dir intact",
  )
  .option(
    "-s, --stale <days>",
    "Auto-select chambers not modified in N days",
    parseInt,
  )
  .option("-a, --all", "Remove all chambers (keeps flare-chambers dir)")
  .option("-y, --yes", "Skip confirmation")
  .action(async (options) => {
    const config = await loadConfig();

    console.log(chalk.cyan.bold("\n🧹 FLARE STACK — Chamber Cleanup\n"));

    const chambersDir = config.workspacesDir;

    if (!existsSync(chambersDir)) {
      console.log(
        chalk.gray("   No chambers directory found. Nothing to nuke.\n"),
      );
      return;
    }

    const entries = readdirSync(chambersDir).filter((entry) => {
      const fullPath = join(chambersDir, entry);
      return statSync(fullPath).isDirectory();
    });

    if (entries.length === 0) {
      console.log(chalk.gray("   No chambers found. Already nuked! ✨\n"));
      return;
    }

    // Gather info about each chamber
    const chamberInfo = entries.map((entry) => {
      const fullPath = join(chambersDir, entry);
      const stat = statSync(fullPath);
      const daysSinceModified = Math.floor(
        (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24),
      );
      const hasOutput = existsSync(join(fullPath, "OUTPUT_AUDIT.md"));
      const hasPlan = existsSync(join(fullPath, "OUTPUT_PLANNING.md"));

      return {
        name: entry,
        path: fullPath,
        daysSinceModified,
        hasOutput,
        hasPlan,
        status: hasOutput
          ? "✅ Complete"
          : hasPlan
            ? "🔄 In Progress"
            : "📋 Not Started",
      };
    });

    // Show current chambers table
    console.log(chalk.white.bold("   📦 Current Chambers:\n"));
    for (const chamber of chamberInfo) {
      const age =
        chamber.daysSinceModified === 0
          ? chalk.green("today")
          : chamber.daysSinceModified === 1
            ? chalk.yellow("1 day ago")
            : chamber.daysSinceModified > 7
              ? chalk.red(`${chamber.daysSinceModified} days ago`)
              : chalk.yellow(`${chamber.daysSinceModified} days ago`);

      console.log(
        `   ${chamber.status}  ${chalk.white.bold(chamber.name)}  ${chalk.gray("—")}  ${age}`,
      );
    }
    console.log("");

    // Determine which chambers to remove
    let toRemove: string[] = [];

    if (options.all) {
      toRemove = entries;
    } else if (options.stale) {
      const staleDays = options.stale;
      toRemove = chamberInfo
        .filter((c) => c.daysSinceModified >= staleDays)
        .map((c) => c.name);

      if (toRemove.length === 0) {
        console.log(
          chalk.gray(
            `   No chambers older than ${staleDays} days. Nothing to nuke.\n`,
          ),
        );
        return;
      }

      console.log(
        chalk.yellow(
          `   Found ${toRemove.length} chamber(s) older than ${staleDays} days:`,
        ),
      );
      for (const name of toRemove) {
        console.log(chalk.gray(`      - ${name}`));
      }
      console.log("");
    } else {
      // Interactive mode: checkbox picker
      const { checkbox } = await import("@inquirer/prompts");

      const selected = await checkbox({
        message: "Select chambers to remove:",
        choices: chamberInfo.map((c) => ({
          name: `${c.status}  ${c.name}  (${c.daysSinceModified}d ago)`,
          value: c.name,
          checked: false,
        })),
      });

      if (selected.length === 0) {
        console.log(chalk.gray("\n   Nothing selected. Chambers untouched.\n"));
        return;
      }

      toRemove = selected;
    }

    // Confirm
    if (!options.yes) {
      const { confirm } = await import("@inquirer/prompts");
      const sure = await confirm({
        message: `Nuke ${toRemove.length} chamber(s)? (worktrees + branches will be removed)`,
        default: false,
      });

      if (!sure) {
        console.log(chalk.yellow("\n   Cancelled. Chambers untouched.\n"));
        return;
      }
    }

    // Remove selected chambers
    console.log(chalk.cyan("\n" + "═".repeat(50)));

    for (const name of toRemove) {
      console.log(chalk.cyan(`\n   🧹 Cleaning ${name}...`));
      try {
        await destroyWorktree(name, config);
        console.log(chalk.green(`   ✅ ${name} removed`));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(
          chalk.yellow(
            `   ⚠️  ${name}: ${message} (folder may need manual removal)`,
          ),
        );
      }
    }

    // Ensure flare-chambers directory still exists
    if (!existsSync(chambersDir)) {
      mkdirSync(chambersDir, { recursive: true });
    }

    console.log(chalk.cyan("\n" + "═".repeat(50)));
    console.log(
      chalk.green.bold(
        `\n   🧹 Cleaned ${toRemove.length} chamber(s). ${entries.length - toRemove.length} remaining.`,
      ),
    );
    console.log(
      chalk.gray(
        `   flare-chambers dir preserved — run \`flare ignite\` to spawn new chambers.\n`,
      ),
    );
  });
