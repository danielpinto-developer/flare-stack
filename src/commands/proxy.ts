/**
 * FLARE STACK — Proxy Command
 *
 * `flare proxy` — Start the proxy router server.
 * Routes PROJ-001.localhost:9000 → localhost:<worktree-port>
 */

import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../config/loader.js";
import { startProxyRouter, printRouteTable } from "../core/proxy-router.js";

export const proxyCommand = new Command("proxy")
  .description("🌐 Start the proxy router for worktree dev servers")
  .option("--routes", "Show routing table without starting server")
  .action(async (options) => {
    const config = await loadConfig();

    if (options.routes) {
      console.log(chalk.cyan.bold("\n🌐 FLARE STACK — Route Table\n"));
      await printRouteTable(config);
      console.log("");
      return;
    }

    await startProxyRouter(config);
  });
