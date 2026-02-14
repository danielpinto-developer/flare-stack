/**
 * FLARE STACK — Holodeck Command
 *
 * `flare holodeck freeze <ticketId>` — Save current context
 * `flare holodeck restore <ticketId>` — Restore saved context
 * `flare holodeck list` — List all saved contexts
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import {
  freezeContext,
  restoreContext,
  listContexts,
} from "../core/holodeck.js";

export const holodeckCommand = new Command("holodeck")
  .description("🎭 Save and restore working contexts between tickets")
  .argument("<action>", "Action: freeze, restore, or list")
  .argument("[ticketId]", "Ticket ID")
  .action(async (action: string, ticketId: string | undefined) => {
    const config = await loadConfig();

    console.log(chalk.cyan.bold("\n🎭 FLARE STACK — Context Holodeck\n"));

    switch (action) {
      case "freeze":
        if (!ticketId) {
          console.error(
            chalk.red(
              "❌ Ticket ID required. Usage: flare holodeck freeze PROJ-001",
            ),
          );
          process.exit(1);
        }
        await freezeContext(ticketId, config);
        break;

      case "restore":
        if (!ticketId) {
          console.error(
            chalk.red(
              "❌ Ticket ID required. Usage: flare holodeck restore PROJ-001",
            ),
          );
          process.exit(1);
        }
        await restoreContext(ticketId, config);
        break;

      case "list": {
        const contexts = listContexts(config);
        if (contexts.length === 0) {
          console.log(
            chalk.yellow(
              "   No saved contexts. Run `flare holodeck freeze <ticketId>` first.\n",
            ),
          );
          return;
        }

        console.log(chalk.white(`   ${contexts.length} saved context(s):\n`));
        console.log(
          chalk.gray("   ") +
            chalk.bold.white("TICKET".padEnd(15)) +
            chalk.bold.white("BRANCH".padEnd(35)) +
            chalk.bold.white("SAVED AT"),
        );
        console.log(chalk.gray("   " + "─".repeat(70)));

        for (const ctx of contexts) {
          console.log(
            chalk.gray("   ") +
              chalk.cyan(ctx.ticketId.padEnd(15)) +
              chalk.yellow(ctx.branch.padEnd(35)) +
              chalk.gray(new Date(ctx.savedAt).toLocaleString()),
          );
        }
        console.log("");
        break;
      }

      default:
        console.error(
          chalk.red(
            `❌ Unknown action: ${action}. Use 'freeze', 'restore', or 'list'.`,
          ),
        );
        process.exit(1);
    }
  });
