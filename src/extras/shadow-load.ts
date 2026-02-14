/**
 * FLARE STACK — Shadow Load Tester
 *
 * Concurrency stress tester for worktree dev servers.
 * Fires parallel HTTP requests at configurable rates to surface:
 *   - Race conditions
 *   - Memory leaks under load
 *   - Timeout/connection failures
 *   - 5xx rate under pressure
 *
 * Uses Node.js native fetch — no external load testing tools needed.
 */

import chalk from "chalk";

export interface LoadTestConfig {
  /** Target URL to bombard */
  url: string;
  /** Total number of requests to fire */
  totalRequests: number;
  /** Concurrent connections */
  concurrency: number;
  /** Request timeout in ms */
  timeout: number;
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** Request body (for POST/PUT) */
  body?: string;
  /** Headers */
  headers?: Record<string, string>;
}

export interface RequestResult {
  status: number;
  duration: number;
  error?: string;
}

export interface LoadTestReport {
  config: LoadTestConfig;
  results: RequestResult[];
  totalTime: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  requestsPerSecond: number;
  successRate: number;
  statusCodes: Record<number, number>;
  errors: number;
}

/**
 * Fire a single HTTP request and measure timing.
 */
async function fireRequest(config: LoadTestConfig): Promise<RequestResult> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    const response = await fetch(config.url, {
      method: config.method,
      headers: config.headers,
      body: config.method !== "GET" ? config.body : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return {
      status: response.status,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 0,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run a shadow load test.
 */
export async function runShadowLoad(
  config: LoadTestConfig,
): Promise<LoadTestReport> {
  console.log(chalk.cyan.bold("\n🔥 FLARE STACK — Shadow Load Tester\n"));
  console.log(chalk.gray(`   Target: ${config.url}`));
  console.log(chalk.gray(`   Requests: ${config.totalRequests}`));
  console.log(chalk.gray(`   Concurrency: ${config.concurrency}`));
  console.log(chalk.gray(`   Method: ${config.method}`));
  console.log(chalk.gray(`   Timeout: ${config.timeout}ms\n`));

  const results: RequestResult[] = [];
  const startTime = Date.now();
  let completed = 0;

  // Process requests in batches of `concurrency`
  for (let i = 0; i < config.totalRequests; i += config.concurrency) {
    const batch = Math.min(config.concurrency, config.totalRequests - i);
    const promises: Promise<RequestResult>[] = [];

    for (let j = 0; j < batch; j++) {
      promises.push(fireRequest(config));
    }

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    completed += batch;

    // Progress
    const pct = ((completed / config.totalRequests) * 100).toFixed(0);
    process.stdout.write(
      `\r   Progress: ${completed}/${config.totalRequests} (${pct}%)`,
    );
  }

  console.log("");

  const totalTime = Date.now() - startTime;

  // Calculate stats
  const durations = results.map((r) => r.duration).sort((a, b) => a - b);
  const successResults = results.filter(
    (r) => r.status >= 200 && r.status < 400,
  );
  const errors = results.filter((r) => r.status === 0 || r.status >= 500);

  // Status code distribution
  const statusCodes: Record<number, number> = {};
  for (const r of results) {
    statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
  }

  const p95Index = Math.floor(durations.length * 0.95);
  const p99Index = Math.floor(durations.length * 0.99);

  return {
    config,
    results,
    totalTime,
    avgResponseTime:
      durations.reduce((a, b) => a + b, 0) / durations.length || 0,
    p95ResponseTime: durations[p95Index] || 0,
    p99ResponseTime: durations[p99Index] || 0,
    maxResponseTime: durations[durations.length - 1] || 0,
    minResponseTime: durations[0] || 0,
    requestsPerSecond: (results.length / totalTime) * 1000,
    successRate:
      results.length > 0 ? (successResults.length / results.length) * 100 : 0,
    statusCodes,
    errors: errors.length,
  };
}

/**
 * Print load test report.
 */
export function printLoadTestReport(report: LoadTestReport): void {
  console.log(chalk.cyan.bold("\n📊 LOAD TEST RESULTS\n"));

  // Timing
  console.log(chalk.white.bold("   ⏱  Timing:"));
  console.log(
    chalk.gray(`      Total time: ${(report.totalTime / 1000).toFixed(2)}s`),
  );
  console.log(
    chalk.gray(`      Avg response: ${report.avgResponseTime.toFixed(0)}ms`),
  );
  console.log(
    chalk.gray(`      Min response: ${report.minResponseTime.toFixed(0)}ms`),
  );
  console.log(
    chalk.gray(`      Max response: ${report.maxResponseTime.toFixed(0)}ms`),
  );
  console.log(
    chalk.yellow(`      P95: ${report.p95ResponseTime.toFixed(0)}ms`),
  );
  console.log(
    chalk.yellow(`      P99: ${report.p99ResponseTime.toFixed(0)}ms`),
  );

  // Throughput
  console.log(chalk.white.bold("\n   🚀 Throughput:"));
  console.log(
    chalk.gray(
      `      Requests/sec: ${report.requestsPerSecond.toFixed(1)} req/s`,
    ),
  );

  // Success rate
  const rateColor =
    report.successRate >= 99
      ? chalk.green
      : report.successRate >= 95
        ? chalk.yellow
        : chalk.red;
  console.log(chalk.white.bold("\n   ✅ Success:"));
  console.log(
    rateColor(`      Success rate: ${report.successRate.toFixed(1)}%`),
  );
  console.log(chalk.gray(`      Errors: ${report.errors}`));

  // Status codes
  console.log(chalk.white.bold("\n   📬 Status Codes:"));
  for (const [code, count] of Object.entries(report.statusCodes)) {
    const color =
      Number(code) >= 500
        ? chalk.red
        : Number(code) >= 400
          ? chalk.yellow
          : chalk.green;
    console.log(color(`      ${code}: ${count}`));
  }

  // Verdict
  console.log("");
  if (report.successRate >= 99 && report.p95ResponseTime < 1000) {
    console.log(
      chalk.green.bold("   🟢 HEALTHY — Server handles load well.\n"),
    );
  } else if (report.successRate >= 95) {
    console.log(
      chalk.yellow.bold(
        "   🟡 DEGRADED — Some errors or slow responses under load.\n",
      ),
    );
  } else {
    console.log(
      chalk.red.bold("   🔴 FAILING — Server buckles under this load.\n"),
    );
  }
}
