/**
 * FLARE STACK — Vision Command
 *
 * `flare vision baseline <ticketId>` — Capture reference screenshots
 * `flare vision check <ticketId>` — Compare current vs baseline
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import {
  captureScreenshots,
  runVisionQA,
  printVisionReport,
} from "../quality/vision-qa.js";
import { join } from "path";

export const visionCommand = new Command("vision")
  .description("👁️ Visual regression testing with screenshots")
  .argument("<action>", "Action: baseline or check")
  .argument("[ticketId]", "Ticket ID")
  .option("-u, --urls <urls...>", "URLs to capture")
  .option("-p, --port <port>", "Dev server port", "3000")
  .action(async (action: string, ticketId: string | undefined, options) => {
    const config = await loadConfig();

    if (!config.visionQA.enabled) {
      console.log(
        chalk.yellow("⚠️  Vision QA is disabled. Enable it in flare.config.ts"),
      );
      console.log(chalk.gray("   visionQA: { enabled: true }"));
      return;
    }

    const urls = options.urls || [`http://localhost:${options.port}`];

    console.log(chalk.cyan.bold("\n👁️  FLARE STACK — Vision QA\n"));

    if (action === "baseline") {
      console.log(chalk.white("   Mode: Capture baselines"));
      const screenshotDir = join(config.visionQA.screenshotDir, "baselines");
      await captureScreenshots(urls, screenshotDir);
      console.log(chalk.green.bold("\n   ✅ Baselines saved.\n"));
    } else if (action === "check") {
      console.log(chalk.white("   Mode: Compare against baselines"));
      const report = await runVisionQA(urls, config, ticketId);
      printVisionReport(report);
    } else {
      console.error(
        chalk.red(`❌ Unknown action: ${action}. Use 'baseline' or 'check'.`),
      );
      process.exit(1);
    }
  });
