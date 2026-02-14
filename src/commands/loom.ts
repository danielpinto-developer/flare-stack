/**
 * FLARE STACK — Loom Command
 *
 * `flare loom <ticketId>` — Record a Loom video walkthrough of your worktree.
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import {
  runLoomGenerator,
  printLoomReport,
  type DemoStep,
} from "../extras/loom-generator.js";

export const loomCommand = new Command("loom")
  .description("🎬 Record a Loom video walkthrough of your worktree")
  .argument("<ticketId>", "Ticket ID to demo")
  .option("-u, --urls <urls...>", "Specific URLs to capture")
  .option("-p, --port <port>", "Dev server port", "3000")
  .option("-n, --narrate", "AI-narrated walkthrough with voice")
  .action(async (ticketId: string, options) => {
    const config = await loadConfig();

    let steps: DemoStep[] | undefined;

    if (options.urls) {
      steps = options.urls.map((url: string) => ({
        url,
        description: `Page: ${url}`,
        waitMs: 2000,
      }));
    }

    const report = await runLoomGenerator(ticketId, config, steps, {
      narrate: options.narrate,
    });
    printLoomReport(report);
  });
