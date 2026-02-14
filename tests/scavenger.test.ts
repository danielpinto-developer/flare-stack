/**
 * FLARE STACK — Scavenger Tests
 *
 * Tests the local static-analysis rules (no-console-log, no-commented-code,
 * no-todo-without-ticket, strict-types, no-any).
 *
 * NOTE: These tests target the LOCAL rule engine only — they do NOT invoke
 * the AI-powered blast-radius scanner (runScavengerBot), which requires
 * git history and LLM access.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  readdirSync,
} from "fs";
import { join, extname } from "path";

// ─── Minimal local rule runner ──────────────────────────────

interface Violation {
  rule: string;
  file: string;
  line: number;
  text: string;
}

interface LocalReport {
  clean: boolean;
  violations: Violation[];
}

const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build"]);
const SCANNABLE_EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectFiles(full));
    else if (SCANNABLE_EXT.has(extname(entry.name))) results.push(full);
  }
  return results;
}

function runLocalRules(dir: string, rules: string[]): LocalReport {
  const violations: Violation[] = [];
  const files = collectFiles(dir);

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      if (rules.includes("no-console-log") && /\bconsole\.log\b/.test(line)) {
        violations.push({
          rule: "no-console-log",
          file,
          line: lineNum,
          text: line.trim(),
        });
      }
      if (
        rules.includes("no-commented-code") &&
        /^\s*\/\/\s*(const|let|var|function|import|export|return|if|for|while)\b/.test(
          line,
        )
      ) {
        violations.push({
          rule: "no-commented-code",
          file,
          line: lineNum,
          text: line.trim(),
        });
      }
      if (
        rules.includes("no-todo-without-ticket") &&
        /\/\/\s*TODO(?!.*[A-Z]+-\d+)/i.test(line)
      ) {
        violations.push({
          rule: "no-todo-without-ticket",
          file,
          line: lineNum,
          text: line.trim(),
        });
      }
      if (rules.includes("no-any") && /:\s*any\b/.test(line)) {
        violations.push({
          rule: "no-any",
          file,
          line: lineNum,
          text: line.trim(),
        });
      }
      if (rules.includes("strict-types") && /\bas\s+any\b/.test(line)) {
        violations.push({
          rule: "strict-types",
          file,
          line: lineNum,
          text: line.trim(),
        });
      }
    }
  }

  return { clean: violations.length === 0, violations };
}

// ─── Tests ──────────────────────────────────────────────────

const SANDBOX = join(process.cwd(), ".test-scavenger");

const ALL_RULES = [
  "no-console-log",
  "no-commented-code",
  "no-todo-without-ticket",
  "strict-types",
  "no-any",
];

beforeEach(() => {
  mkdirSync(SANDBOX, { recursive: true });
});

afterEach(() => {
  rmSync(SANDBOX, { recursive: true, force: true });
});

describe("Scavenger", () => {
  it("detects console.log", () => {
    writeFileSync(
      join(SANDBOX, "test.ts"),
      `
const x = 1;
console.log(x);
`,
    );
    const report = runLocalRules(SANDBOX, ALL_RULES);
    expect(report.clean).toBe(false);
    expect(report.violations.some((v) => v.rule === "no-console-log")).toBe(
      true,
    );
  });

  it("detects commented-out code", () => {
    writeFileSync(
      join(SANDBOX, "test.ts"),
      `
const active = true;
// const inactive = false;
`,
    );
    const report = runLocalRules(SANDBOX, ALL_RULES);
    expect(report.violations.some((v) => v.rule === "no-commented-code")).toBe(
      true,
    );
  });

  it("detects TODO without ticket ID", () => {
    writeFileSync(
      join(SANDBOX, "test.ts"),
      `
// TODO: fix this later
`,
    );
    const report = runLocalRules(SANDBOX, ALL_RULES);
    expect(
      report.violations.some((v) => v.rule === "no-todo-without-ticket"),
    ).toBe(true);
  });

  it("allows TODO with ticket ID", () => {
    writeFileSync(
      join(SANDBOX, "test.ts"),
      `
// TODO PROJ-001: fix this later
`,
    );
    const report = runLocalRules(SANDBOX, ALL_RULES);
    expect(
      report.violations.filter((v) => v.rule === "no-todo-without-ticket"),
    ).toHaveLength(0);
  });

  it("detects any type annotations", () => {
    writeFileSync(
      join(SANDBOX, "test.ts"),
      `
function foo(x: any) {
  return x;
}
`,
    );
    const report = runLocalRules(SANDBOX, ALL_RULES);
    expect(report.violations.some((v) => v.rule === "no-any")).toBe(true);
  });

  it("detects as any casts", () => {
    writeFileSync(
      join(SANDBOX, "test.ts"),
      `
const result = value as any;
`,
    );
    const report = runLocalRules(SANDBOX, ALL_RULES);
    expect(report.violations.some((v) => v.rule === "strict-types")).toBe(true);
  });

  it("reports clean for compliant code", () => {
    writeFileSync(
      join(SANDBOX, "test.ts"),
      `
const x: number = 1;
const y: string = 'hello';
export function add(a: number, b: number): number {
  return a + b;
}
`,
    );
    const report = runLocalRules(SANDBOX, ALL_RULES);
    expect(report.clean).toBe(true);
    expect(report.violations).toHaveLength(0);
  });

  it("ignores node_modules", () => {
    const nmDir = join(SANDBOX, "node_modules", "some-pkg");
    mkdirSync(nmDir, { recursive: true });
    writeFileSync(join(nmDir, "index.ts"), 'console.log("from package");');
    const report = runLocalRules(SANDBOX, ALL_RULES);
    expect(
      report.violations.filter((v) => v.file.includes("node_modules")),
    ).toHaveLength(0);
  });

  it("only runs configured rules", () => {
    writeFileSync(
      join(SANDBOX, "test.ts"),
      `
console.log("bad");
// const dead = true;
const x: any = 1;
`,
    );
    const report = runLocalRules(SANDBOX, ["no-console-log"]);
    expect(report.violations.every((v) => v.rule === "no-console-log")).toBe(
      true,
    );
  });
});
