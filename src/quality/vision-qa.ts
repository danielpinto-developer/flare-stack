/**
 * FLARE STACK — Vision QA
 *
 * Takes screenshots of running worktree apps and diffs them against baselines.
 * Uses Playwright for headless browser screenshots and pixel-diff for comparison.
 *
 * Workflow:
 *   1. `flare vision baseline <ticketId>` — Capture reference screenshots
 *   2. `flare vision check <ticketId>` — Compare current state vs baseline
 *
 * No Figma integration yet — uses saved PNGs as baselines.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import chalk from "chalk";
import type { FlareConfig } from "../config/schema.js";

export interface ScreenshotResult {
  url: string;
  path: string;
  success: boolean;
  error?: string;
}

export interface DiffResult {
  url: string;
  baselinePath: string;
  currentPath: string;
  diffPath: string;
  pixelDiff: number;
  percentDiff: number;
  passed: boolean;
}

export interface VisionReport {
  screenshots: ScreenshotResult[];
  diffs: DiffResult[];
  passed: boolean;
}

/**
 * Capture screenshots of pages at given URLs.
 */
export async function captureScreenshots(
  urls: string[],
  outputDir: string,
): Promise<ScreenshotResult[]> {
  mkdirSync(outputDir, { recursive: true });

  // Dynamic import to make Playwright optional
  let playwright: any;
  try {
    playwright = await import("playwright");
  } catch {
    console.error(
      chalk.red("❌ Playwright not installed. Run: npm install -D playwright"),
    );
    console.error(chalk.yellow("   Then: npx playwright install chromium"));
    return urls.map((url) => ({
      url,
      path: "",
      success: false,
      error: "Playwright not installed",
    }));
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const results: ScreenshotResult[] = [];

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });

    for (const url of urls) {
      const filename = url.replace(/[^a-zA-Z0-9]/g, "_") + ".png";
      const filepath = join(outputDir, filename);

      try {
        console.log(chalk.cyan(`   📸 Capturing: ${url}`));
        await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
        await page.screenshot({ path: filepath, fullPage: true });
        results.push({ url, path: filepath, success: true });
        console.log(chalk.green(`   ✅ Saved: ${filename}`));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ url, path: filepath, success: false, error: message });
        console.error(chalk.red(`   ❌ Failed: ${url} — ${message}`));
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

/**
 * Compare two PNG screenshots pixel-by-pixel.
 * Returns the percentage of pixels that differ.
 *
 * Uses a simple byte-level comparison (no perceptual diff library needed).
 */
export function compareScreenshots(
  baselinePath: string,
  currentPath: string,
  threshold: number = 0.05,
): DiffResult {
  const baselineBuffer = readFileSync(baselinePath);
  const currentBuffer = readFileSync(currentPath);

  // Simple byte comparison
  const maxLen = Math.max(baselineBuffer.length, currentBuffer.length);
  let diffBytes = 0;

  if (baselineBuffer.length !== currentBuffer.length) {
    // Different file sizes = definitely different
    diffBytes = Math.abs(baselineBuffer.length - currentBuffer.length);
  }

  const minLen = Math.min(baselineBuffer.length, currentBuffer.length);
  for (let i = 0; i < minLen; i++) {
    if (baselineBuffer[i] !== currentBuffer[i]) {
      diffBytes++;
    }
  }

  const percentDiff = maxLen > 0 ? diffBytes / maxLen : 0;
  const diffDir = join(baselinePath, "..", "diffs");
  mkdirSync(diffDir, { recursive: true });
  const diffPath = join(diffDir, `diff_${Date.now()}.txt`);

  // Write a simple diff report
  writeFileSync(
    diffPath,
    JSON.stringify(
      {
        baseline: baselinePath,
        current: currentPath,
        diffBytes,
        percentDiff: (percentDiff * 100).toFixed(2) + "%",
        passed: percentDiff <= threshold,
      },
      null,
      2,
    ),
  );

  return {
    url: "",
    baselinePath,
    currentPath,
    diffPath,
    pixelDiff: diffBytes,
    percentDiff,
    passed: percentDiff <= threshold,
  };
}

/**
 * Run a full vision QA check:
 * 1. Capture current screenshots
 * 2. Compare against baselines (if they exist)
 */
export async function runVisionQA(
  urls: string[],
  config: FlareConfig,
  ticketId?: string,
): Promise<VisionReport> {
  const screenshotDir = config.visionQA.screenshotDir;
  const threshold = config.visionQA.diffThreshold;

  const baselineDir = join(screenshotDir, "baselines");
  const currentDir = join(screenshotDir, ticketId || "current");

  // 1. Capture current screenshots
  const screenshots = await captureScreenshots(urls, currentDir);

  // 2. Compare against baselines
  const diffs: DiffResult[] = [];

  if (existsSync(baselineDir)) {
    const baselineFiles = readdirSync(baselineDir).filter((f) =>
      f.endsWith(".png"),
    );

    for (const file of baselineFiles) {
      const baselinePath = join(baselineDir, file);
      const currentPath = join(currentDir, file);

      if (!existsSync(currentPath)) {
        diffs.push({
          url: file,
          baselinePath,
          currentPath,
          diffPath: "",
          pixelDiff: -1,
          percentDiff: 1,
          passed: false,
        });
        continue;
      }

      const diff = compareScreenshots(baselinePath, currentPath, threshold);
      diff.url = file;
      diffs.push(diff);
    }
  }

  const allPassed = diffs.length === 0 || diffs.every((d) => d.passed);

  return {
    screenshots,
    diffs,
    passed: allPassed,
  };
}

/**
 * Print the vision QA report.
 */
export function printVisionReport(report: VisionReport): void {
  console.log(chalk.cyan.bold("\n👁️  VISION QA REPORT\n"));
  console.log(chalk.gray(`   Screenshots: ${report.screenshots.length}`));
  console.log(chalk.gray(`   Comparisons: ${report.diffs.length}`));

  if (report.diffs.length === 0) {
    console.log(chalk.yellow("\n   No baselines to compare against."));
    console.log(
      chalk.gray(
        "   Run with --baseline first to save reference screenshots.\n",
      ),
    );
    return;
  }

  for (const diff of report.diffs) {
    const status = diff.passed ? chalk.green("PASS") : chalk.red("FAIL");
    console.log(
      `   ${status} ${diff.url} (${(diff.percentDiff * 100).toFixed(1)}% diff)`,
    );
  }

  console.log(
    report.passed
      ? chalk.green.bold("\n   ✅ VISION QA PASSED\n")
      : chalk.red.bold(
          "\n   ❌ VISION QA FAILED — Screenshots don't match baselines\n",
        ),
  );
}
