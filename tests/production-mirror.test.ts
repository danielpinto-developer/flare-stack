/**
 * FLARE STACK — Production Mirror Tests
 */

import { describe, it, expect } from "vitest";
import {
  queryProductionLogs,
  printMirrorReport,
  type AnomalyReport,
} from "../src/core/production-mirror.js";

describe("Production Mirror", () => {
  it("should throw when mirror is disabled", async () => {
    const config = {
      productionMirror: {
        enabled: false,
        bigquery: {
          projectId: "test-project",
          dataset: "logs",
          table: "requests",
          windowMinutes: 60,
        },
        alertThresholds: {
          errorRatePercent: 5,
          p95LatencyMs: 1000,
        },
      },
    } as any;

    await expect(queryProductionLogs(config)).rejects.toThrow(
      "Production mirror is disabled",
    );
  });

  it("should throw when BigQuery config missing", async () => {
    const config = {
      productionMirror: {
        enabled: true,
        bigquery: undefined,
      },
    } as any;

    await expect(queryProductionLogs(config)).rejects.toThrow(
      "BigQuery config is required",
    );
  });

  it("printMirrorReport should not throw with valid report", () => {
    const report: AnomalyReport = {
      patterns: [
        {
          endpoint: "/api/test",
          method: "GET",
          statusCode: 200,
          avgResponseTime: 50,
          count: 100,
          errorRate: 0.01,
        },
      ],
      anomalies: [],
      suggestions: ["No anomalies detected. Production looks healthy."],
      queriedAt: new Date().toISOString(),
    };
    expect(() => printMirrorReport(report)).not.toThrow();
  });

  it("printMirrorReport should handle anomalies", () => {
    const report: AnomalyReport = {
      patterns: [],
      anomalies: [
        {
          type: "error_spike",
          endpoint: "POST /api/users",
          detail: "15% error rate (500 requests)",
          severity: "high",
        },
        {
          type: "slow_endpoint",
          endpoint: "GET /api/reports",
          detail: "3500ms avg response time",
          severity: "medium",
        },
      ],
      suggestions: [
        "Investigate 1 endpoint(s) with high error rates",
        "Optimize 1 slow endpoint(s)",
      ],
      queriedAt: new Date().toISOString(),
    };
    expect(() => printMirrorReport(report)).not.toThrow();
  });
});
