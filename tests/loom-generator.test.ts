/**
 * FLARE STACK — Loom Generator Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  generateDemoReport,
  type DemoRecording,
} from "../src/extras/loom-generator.js";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Loom Generator", () => {
  const testDir = join(tmpdir(), "flare-loom-test-" + Date.now());

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should generate markdown report with Loom URL", () => {
    const recordings: DemoRecording[] = [
      {
        step: {
          url: "http://localhost:3000",
          description: "Homepage",
          waitMs: 1000,
        },
        success: true,
      },
      {
        step: { url: "http://localhost:3000/login", description: "Login" },
        success: true,
      },
      {
        step: {
          url: "http://localhost:3000/broken",
          description: "Broken page",
        },
        success: false,
        error: "Page not found",
      },
    ];

    const videoPath = join(testDir, "loom-recording.webm");
    const loomUrl = "https://www.loom.com/share/abc123";
    const report = generateDemoReport(
      "PROJ-001",
      recordings,
      videoPath,
      loomUrl,
      testDir,
    );

    expect(report.ticketId).toBe("PROJ-001");
    expect(report.recordings.length).toBe(3);
    expect(report.loomUrl).toBe(loomUrl);
    expect(report.generatedAt).toBeTruthy();
    expect(existsSync(report.reportPath)).toBe(true);

    const md = readFileSync(report.reportPath, "utf-8");
    expect(md).toContain("PROJ-001");
    expect(md).toContain("Homepage");
    expect(md).toContain("Login");
    expect(md).toContain("Page not found");
    expect(md).toContain("FLARE STACK");
    expect(md).toContain("Watch on Loom");
    expect(md).toContain(loomUrl);
  });

  it("should generate report with local fallback when no Loom URL", () => {
    const recordings: DemoRecording[] = [
      { step: { url: "a", description: "a" }, success: true },
    ];

    const videoPath = join(testDir, "loom-recording.webm");
    const report = generateDemoReport(
      "TEST-001",
      recordings,
      videoPath,
      "",
      testDir,
    );
    const md = readFileSync(report.reportPath, "utf-8");

    expect(md).toContain("Local Video");
    expect(md).toContain("loom-recording.webm");
    expect(md).not.toContain("Watch on Loom");
  });

  it("should count successful and failed recordings", () => {
    const recordings: DemoRecording[] = [
      { step: { url: "a", description: "a" }, success: true },
      {
        step: { url: "b", description: "b" },
        success: false,
        error: "err",
      },
    ];

    const videoPath = join(testDir, "loom-recording.webm");
    const report = generateDemoReport(
      "TEST-002",
      recordings,
      videoPath,
      "",
      testDir,
    );
    const md = readFileSync(report.reportPath, "utf-8");

    expect(md).toContain("**Recorded:** 1");
    expect(md).toContain("**Failed:** 1");
  });

  it("should support optional narration field on DemoStep", () => {
    const recordings: DemoRecording[] = [
      {
        step: {
          url: "http://localhost:3000/feature",
          description: "Feature page",
          narration: "Here is the feature we implemented for this ticket.",
        },
        success: true,
      },
      {
        step: { url: "http://localhost:3000/other", description: "Other" },
        success: true,
      },
    ];

    const videoPath = join(testDir, "loom-recording.webm");
    const report = generateDemoReport(
      "NARR-001",
      recordings,
      videoPath,
      "",
      testDir,
    );

    expect(report.recordings[0].step.narration).toBe(
      "Here is the feature we implemented for this ticket.",
    );
    expect(report.recordings[1].step.narration).toBeUndefined();
  });
});
