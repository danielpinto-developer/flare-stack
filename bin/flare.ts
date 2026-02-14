/**
 * FLARE STACK — CLI Entry Point
 *
 * The Parallel Reality OS for Engineers.
 * In Special Relativity, Flare Stack incinerates backlog pressure.
 * Standard Git is linear. Flare burns parallel.
 */

// Load .env from project root (before any other imports use env vars)
import "dotenv/config";

import { Command } from "commander";
import chalk from "chalk";
import { spawnCommand } from "../src/commands/spawn.js";
import { destroyCommand } from "../src/commands/destroy.js";
import { statusCommand } from "../src/commands/status.js";
import { initCommand } from "../src/commands/init.js";
import { burnCommand } from "../src/commands/greenlight.js";
import { greenlightCommand } from "../src/commands/greenlight-approval.js";
import { tryCommand } from "../src/commands/try.js";
import { scanCommand } from "../src/commands/scan.js";
import {
  planCommand,
  verifyCommand,
  implementCommand,
  auditCommand,
} from "../src/commands/phases.js";
import { nextCommand } from "../src/commands/next.js";
import { forgeCommand } from "../src/commands/forge.js";
import { fixCommand } from "../src/commands/fix.js";
import { proxyCommand } from "../src/commands/proxy.js";
import { visionCommand } from "../src/commands/vision.js";
import { holodeckCommand } from "../src/commands/holodeck.js";
import { mirrorCommand } from "../src/commands/mirror.js";
import { entropyCommand } from "../src/commands/entropy.js";
import { shadowCommand } from "../src/commands/shadow.js";
import { loomCommand } from "../src/commands/loom.js";
import { dashboardCommand } from "../src/commands/dashboard.js";
import { testRoutingCommand } from "../src/commands/test-routing.js";
import { nukeCommand } from "../src/commands/nuke.js";

const BANNER = `
${chalk.cyan.bold("╔═══════════════════════════════════════════════╗")}
${chalk.cyan.bold("║")}  ${chalk.white.bold("🔥 FLARE STACK")}  ${chalk.gray("— Parallel Reality OS")}        ${chalk.cyan.bold("║")}
${chalk.cyan.bold("║")}  ${chalk.gray("Incinerate the Backlog.")}              ${chalk.cyan.bold("║")}
${chalk.cyan.bold("║")}  ${chalk.gray("Standard Git is linear. Flare burns parallel.")}  ${chalk.cyan.bold("║")}
${chalk.cyan.bold("╚═══════════════════════════════════════════════╝")}
`;

const program = new Command();

program
  .name("flare")
  .version("1.0.0")
  .description(
    "Parallel Reality OS — Git Worktree orchestration + AI quality gates",
  )
  // Core commands
  .addCommand(initCommand)
  .addCommand(spawnCommand)
  .addCommand(destroyCommand)
  .addCommand(statusCommand)
  .addCommand(burnCommand)
  .addCommand(greenlightCommand)
  // Phase commands
  .addCommand(planCommand)
  .addCommand(verifyCommand)
  .addCommand(implementCommand)
  .addCommand(auditCommand)
  .addCommand(forgeCommand)
  .addCommand(fixCommand)
  .addCommand(nextCommand)
  // Quality
  .addCommand(scanCommand)
  .addCommand(visionCommand)
  .addCommand(entropyCommand)
  // Infrastructure
  .addCommand(proxyCommand)
  .addCommand(mirrorCommand)
  .addCommand(shadowCommand)
  // Context management
  .addCommand(holodeckCommand)
  // Demo & recording
  .addCommand(loomCommand)
  .addCommand(dashboardCommand)
  // Onboarding
  .addCommand(tryCommand)
  // Testing
  .addCommand(testRoutingCommand)
  // Housekeeping
  .addCommand(nukeCommand)
  .hook("preAction", () => {
    console.log(BANNER);
  });

// Default: show help
if (process.argv.length <= 2) {
  program.outputHelp();
}

program.parse();
