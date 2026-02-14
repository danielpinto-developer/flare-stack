/**
 * FLARE STACK — Mirror Command
 *
 * `flare mirror` — Query production logs and surface anomalies.
 * `flare mirror --watch` — Continuous monitoring.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import {
  queryProductionLogs,
  printMirrorReport,
} from "../core/production-mirror.js";

export const mirrorCommand = new Command("mirror")
  .description("📡 Query production logs and surface anomalies via BigQuery")
  .option("-w, --watch", "Continuous monitoring (polls every 5 minutes)")
  .action(async (options) => {
    const config = await loadConfig();

    if (!config.productionMirror.enabled) {
      console.log(
        chalk.yellow(
          "⚠️  Production mirror is disabled. Enable it in flare.config.ts:",
        ),
      );
      console.log(
        chalk.gray("   productionMirror: { enabled: true, bigquery: { ... } }"),
      );
      return;
    }

    console.log(chalk.cyan.bold("\n📡 FLARE STACK — Production Mirror\n"));

    if (options.watch) {
      console.log(
        chalk.gray(
          "   Continuous mode — polling every 5 minutes. Ctrl+C to stop.\n",
        ),
      );
      while (true) {
        try {
          const report = await queryProductionLogs(config);
          printMirrorReport(report);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(chalk.red(`   ❌ Error: ${message}`));
        }
        await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
      }
    } else {
      try {
        const report = await queryProductionLogs(config);
        printMirrorReport(report);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`   ❌ ${message}\n`));
        process.exit(1);
      }
    }
  });
