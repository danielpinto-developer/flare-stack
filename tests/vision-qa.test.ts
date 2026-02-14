/**
 * FLARE STACK — Vision QA Tests
 */

import { describe, it, expect } from "vitest";
import { printVisionReport } from "../src/quality/vision-qa.js";

describe("Vision QA", () => {
  it("printVisionReport should handle empty report", () => {
    const report = {
      ticketId: "PROJ-001",
      screenshots: [],
      diffs: [],
      timestamp: new Date().toISOString(),
      passed: true,
    };
    expect(() => printVisionReport(report as any)).not.toThrow();
  });

  it("printVisionReport should handle failing diffs", () => {
    const report = {
      ticketId: "PROJ-002",
      screenshots: [],
      diffs: [
        {
          url: "http://localhost:3000",
          diffPercent: 15.5,
          passed: false,
          threshold: 5,
        },
      ],
      timestamp: new Date().toISOString(),
      passed: false,
    };
    expect(() => printVisionReport(report as any)).not.toThrow();
  });
});
