/**
 * FLARE STACK — Proxy Router
 *
 * Routes HTTP requests to the correct worktree's dev server based on ticket ID.
 * Access any worktree's running app at: http://PROJ-001.localhost:9000
 *
 * Uses Node.js native HTTP server — no external proxy deps needed.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { request as httpRequest } from "http";
import chalk from "chalk";
import type { FlareConfig } from "../config/schema.js";
import { listWorktrees } from "./worktree-manager.js";

interface RouteTarget {
  ticketId: string;
  repo: string;
  port: number;
}

export interface ProxyRouterResult {
  port: number;
  baseDomain: string;
  routeCount: number;
  routes: Map<string, RouteTarget>;
  server: ReturnType<typeof createServer>;
}

/**
 * Start the proxy router server.
 * Routes `PROJ-001.localhost:9000` → `localhost:<worktree-port>`
 */
export async function startProxyRouter(
  config: FlareConfig,
): Promise<ProxyRouterResult | null> {
  if (!config.proxy.enabled) {
    console.log(chalk.yellow("⚠️  Proxy router is disabled in config."));
    return null;
  }

  const port = config.proxy.port;
  const baseDomain = config.proxy.baseDomain;

  // Build routing table
  const routes = await buildRouteTable(config);

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const host = req.headers.host || "";
    const ticketId = host.split(".")[0]; // Extract PROJ-001 from PROJ-001.localhost:9000

    const target = routes.get(ticketId.toUpperCase());

    if (!target) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(
        `FLARE STACK — No route for ticket: ${ticketId}\n\nActive routes:\n${Array.from(
          routes.entries(),
        )
          .map(
            ([id, t]) => `  ${id}.${baseDomain}:${port} → localhost:${t.port}`,
          )
          .join("\n")}`,
      );
      return;
    }

    // Proxy the request
    const proxyReq = httpRequest(
      {
        hostname: "localhost",
        port: target.port,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          host: `localhost:${target.port}`,
          "x-flare-ticket": target.ticketId,
          "x-flare-repo": target.repo,
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on("error", (err) => {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end(
        `FLARE STACK — Backend unreachable for ${target.ticketId}\n\nMake sure the dev server is running:\n  cd ${target.ticketId}\n  ${config.repos[target.repo]?.startCommand || "npm run dev"}\n\nError: ${err.message}`,
      );
    });

    req.pipe(proxyReq);
  });

  server.listen(port, () => {
    console.log(chalk.cyan.bold("\n🌐 FLARE STACK — Proxy Router\n"));
    console.log(chalk.green(`   Listening on port ${port}\n`));

    if (routes.size === 0) {
      console.log(
        chalk.yellow("   No active worktrees found. Spawn some first.\n"),
      );
    } else {
      console.log(chalk.white("   Routes:"));
      for (const [ticketId, target] of routes) {
        console.log(
          chalk.cyan(`   ${ticketId}.${baseDomain}:${port}`) +
            chalk.gray(" → ") +
            chalk.green(`localhost:${target.port}`) +
            chalk.gray(` (${target.repo})`),
        );
      }
      console.log("");
    }

    console.log(chalk.gray("   Press Ctrl+C to stop.\n"));
  });

  return {
    port,
    baseDomain,
    routeCount: routes.size,
    routes,
    server,
  };
}

/**
 * Build a routing table from active worktrees.
 * Maps ticket IDs to ports based on repo config.
 */
async function buildRouteTable(
  config: FlareConfig,
): Promise<Map<string, RouteTarget>> {
  const routes = new Map<string, RouteTarget>();
  const worktrees = await listWorktrees(config);

  for (const wt of worktrees) {
    // Extract ticket ID from branch name (e.g., feat/PROJ-001-slug → PROJ-001)
    const ticketMatch = wt.branch.match(/([A-Z]+-\d+)/);
    if (!ticketMatch) continue;

    const ticketId = ticketMatch[1];
    const repoConfig = config.repos[wt.repo];
    if (!repoConfig?.ports) continue;

    // Use the first port defined
    const firstPort = Object.values(repoConfig.ports)[0];
    if (!firstPort) continue;

    routes.set(ticketId, {
      ticketId,
      repo: wt.repo,
      port: firstPort,
    });
  }

  return routes;
}

/**
 * Print the current routing table.
 */
export async function printRouteTable(config: FlareConfig): Promise<void> {
  const routes = await buildRouteTable(config);

  if (routes.size === 0) {
    console.log(
      chalk.yellow(
        "   No routes. Spawn worktrees with port-configured repos first.",
      ),
    );
    return;
  }

  for (const [ticketId, target] of routes) {
    console.log(
      chalk.cyan(
        `   ${ticketId}.${config.proxy.baseDomain}:${config.proxy.port}`,
      ) +
        chalk.gray(" → ") +
        chalk.green(`localhost:${target.port}`) +
        chalk.gray(` (${target.repo})`),
    );
  }
}
