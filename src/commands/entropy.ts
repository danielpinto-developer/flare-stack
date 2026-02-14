/**
 * FLARE STACK — Entropy Command
 *
 * `flare entropy <ticketId>` — Run mutation testing on a worktree.
 * `flare entropy --dir <path>` — Run against any directory.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import {
  runEntropyHunter,
  printEntropyReport,
} from "../quality/entropy-hunter.js";
import { existsSync } from "fs";
import { join, resolve } from "path";

export const entropyCommand = new Command("entropy")
  .description("🧬 Mutation testing — find blind spots in your test suite")
  .argument("[ticketId]", "Ticket ID to test")
  .option("-r, --repo <repo>", "Target repo")
  .option("-d, --dir <path>", "Test a specific directory instead")
  .option("-c, --cmd <command>", "Test command to run", "npm test")
  .action(async (ticketId: string | undefined, options) => {
    const config = await loadConfig();

    console.log(chalk.cyan.bold("\n🧬 FLARE STACK — Entropy Hunter\n"));

    let targetDir: string;

    if (options.dir) {
      targetDir = resolve(options.dir);
    } else if (ticketId) {
      targetDir = join(config.workspacesDir, ticketId);
    } else {
      targetDir = process.cwd();
    }

    if (!existsSync(targetDir)) {
      console.error(chalk.red(`❌ Directory not found: ${targetDir}`));
      process.exit(1);
    }

    console.log(chalk.gray(`   Target: ${targetDir}`));
    console.log(chalk.gray(`   Test command: ${options.cmd}\n`));

    const report = await runEntropyHunter(targetDir, options.cmd);
    printEntropyReport(report);
  });
