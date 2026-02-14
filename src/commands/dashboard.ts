/**
 * FLARE STACK — Dashboard Command
 *
 * `flare dashboard` — Launch Ink TUI dashboard.
 * `flare dashboard --chalk` — Fallback chalk-only output.
 */

import { Command } from "commander";
import { loadConfig } from "../config/loader.js";
import { listWorktrees } from "../core/worktree-manager.js";
import { launchDashboard, printChalkStatus } from "../ui/Dashboard.js";

export const dashboardCommand = new Command("dashboard")
  .description("🖥️  Launch the real-time TUI dashboard")
  .option("--chalk", "Use chalk fallback instead of Ink TUI")
  .option("--models", "Show model configuration table")
  .action(async (options) => {
    const config = await loadConfig();

    if (options.chalk) {
      const worktrees = await listWorktrees(config);
      printChalkStatus(config, worktrees, options.models);
    } else {
      await launchDashboard(config, options.models);
    }
  });
