/**
 * FLARE STACK — Shadow Load Command
 *
 * `flare shadow <url>` — Run load test against a URL.
 */

import { Command } from "commander";
import chalk from "chalk";
import {
  runShadowLoad,
  printLoadTestReport,
  type LoadTestConfig,
} from "../extras/shadow-load.js";

export const shadowCommand = new Command("shadow")
  .description("🔥 Shadow load tester — stress test your dev servers")
  .argument("<url>", "Target URL to load test")
  .option("-n, --requests <n>", "Total requests", "100")
  .option("-c, --concurrency <n>", "Concurrent connections", "10")
  .option("-t, --timeout <ms>", "Request timeout in ms", "5000")
  .option("-m, --method <method>", "HTTP method", "GET")
  .action(async (url: string, options) => {
    const config: LoadTestConfig = {
      url,
      totalRequests: parseInt(options.requests, 10),
      concurrency: parseInt(options.concurrency, 10),
      timeout: parseInt(options.timeout, 10),
      method: options.method.toUpperCase() as LoadTestConfig["method"],
    };

    const report = await runShadowLoad(config);
    printLoadTestReport(report);
  });
