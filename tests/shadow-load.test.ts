/**
 * FLARE STACK — Shadow Load Tester Tests
 *
 * Mocks fetch to verify stats calculation.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  runShadowLoad,
  printLoadTestReport,
  type LoadTestConfig,
  type LoadTestReport,
} from "../src/extras/shadow-load.js";

describe("Shadow Load Tester", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const baseConfig: LoadTestConfig = {
    url: "http://localhost:3000",
    totalRequests: 10,
    concurrency: 2,
    timeout: 5000,
    method: "GET",
  };

  it("should fire correct number of requests", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      return new Response("OK", { status: 200 });
    }) as any;

    const report = await runShadowLoad(baseConfig);
    expect(callCount).toBe(10);
    expect(report.results.length).toBe(10);
  });

  it("should calculate correct success rate", async () => {
    let reqIndex = 0;
    globalThis.fetch = vi.fn(async () => {
      reqIndex++;
      // 8 succeed, 2 fail
      if (reqIndex <= 8) {
        return new Response("OK", { status: 200 });
      }
      return new Response("Error", { status: 500 });
    }) as any;

    const report = await runShadowLoad(baseConfig);
    expect(report.successRate).toBe(80);
    expect(report.errors).toBe(2);
  });

  it("should track status code distribution", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("OK", { status: 200 });
    }) as any;

    const report = await runShadowLoad(baseConfig);
    expect(report.statusCodes[200]).toBe(10);
  });

  it("should calculate timing metrics", async () => {
    globalThis.fetch = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return new Response("OK", { status: 200 });
    }) as any;

    const report = await runShadowLoad(baseConfig);
    expect(report.avgResponseTime).toBeGreaterThan(0);
    expect(report.p95ResponseTime).toBeGreaterThan(0);
    expect(report.p99ResponseTime).toBeGreaterThan(0);
    expect(report.maxResponseTime).toBeGreaterThanOrEqual(
      report.minResponseTime,
    );
    expect(report.requestsPerSecond).toBeGreaterThan(0);
    expect(report.totalTime).toBeGreaterThan(0);
  });

  it("should handle connection errors", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("Connection refused");
    }) as any;

    const report = await runShadowLoad(baseConfig);
    expect(report.errors).toBe(10);
    expect(report.successRate).toBe(0);
    expect(report.results[0].error).toBe("Connection refused");
  });

  it("printLoadTestReport should not throw", () => {
    const report: LoadTestReport = {
      config: baseConfig,
      results: [],
      totalTime: 1000,
      avgResponseTime: 50,
      p95ResponseTime: 100,
      p99ResponseTime: 150,
      maxResponseTime: 200,
      minResponseTime: 10,
      requestsPerSecond: 10,
      successRate: 100,
      statusCodes: { 200: 10 },
      errors: 0,
    };
    expect(() => printLoadTestReport(report)).not.toThrow();
  });
});
