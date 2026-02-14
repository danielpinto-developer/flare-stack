/**
 * FLARE STACK — Scavenger Bot (Blast Radius Scanner)
 *
 * AI-powered blast radius analysis for code changes.
 *
 * How it works:
 *   1. `git diff` to find YOUR changed files
 *   2. Trace imports + importers to build the blast radius
 *   3. Feed the affected files to the LLM (Flash model)
 *   4. Report collateral damage findings
 *
 * The Scavenger Bot scans the NEIGHBORHOOD of your changes —
 * not the whole repo, not just your files, but the connected code.
 * It finds broken contracts, stale references, missing error handling.
 *
 * Different from Audit:
 *   - Audit reviews YOUR code against ticket + 8 commandments
 *   - Scavenger Bot scans SURROUNDING code for collateral damage
 */

import { readFile, readdir, stat } from "fs/promises";
import { join, extname, dirname, relative } from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import type { FlareConfig } from "../config/schema.js";
import type { ModelPhaseConfig } from "../config/schema.js";
import { executePrompt } from "../core/ai-executor.js";

// ─── Types ───────────────────────────────────────────────────

export interface ScavengerFinding {
  file: string;
  lineRange?: string;
  severity: "critical" | "warning" | "info";
  category: string;
  description: string;
  suggestion?: string;
}

export interface ScavengerReport {
  changedFiles: string[];
  blastRadiusFiles: string[];
  findings: ScavengerFinding[];
  totalFilesAnalyzed: number;
  clean: boolean;
  aiModel: string;
  duration: number;
}

const SCANNABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".java",
  ".go",
  ".rb",
  ".rs",
  ".vue",
  ".svelte",
]);

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "__pycache__",
  ".next",
  "coverage",
  ".flare",
  ".flare-sandbox",
  "images",
]);

// ─── Step 1: Get Changed Files ─────────────────────────────

/**
 * Get the list of files changed in this worktree vs the source branch.
 * Falls back to all tracked files if no branch comparison is possible.
 */
export function getChangedFiles(worktreePath: string): string[] {
  try {
    // Try to find the source branch by looking at the worktree's merge base
    const currentBranch = execSync("git branch --show-current", {
      cwd: worktreePath,
      encoding: "utf-8",
    }).trim();

    // Get the default branch (develop, main, master)
    let baseBranch = "develop";
    try {
      const branches = execSync("git branch -l", {
        cwd: worktreePath,
        encoding: "utf-8",
      });
      if (branches.includes("develop")) baseBranch = "develop";
      else if (branches.includes("main")) baseBranch = "main";
      else if (branches.includes("master")) baseBranch = "master";
    } catch {
      /* use default */
    }

    // Get diff against base branch
    const diff = execSync(
      `git diff --name-only --diff-filter=ACMR ${baseBranch}...${currentBranch} 2>/dev/null || git diff --name-only HEAD`,
      { cwd: worktreePath, encoding: "utf-8" },
    ).trim();

    if (!diff) return [];

    return diff
      .split("\n")
      .filter((f) => f && SCANNABLE_EXTENSIONS.has(extname(f)))
      .map((f) => join(worktreePath, f));
  } catch {
    // Fallback: get all staged + unstaged changes
    try {
      const diff = execSync("git diff --name-only HEAD", {
        cwd: worktreePath,
        encoding: "utf-8",
      }).trim();

      if (!diff) return [];

      return diff
        .split("\n")
        .filter((f) => f && SCANNABLE_EXTENSIONS.has(extname(f)))
        .map((f) => join(worktreePath, f));
    } catch {
      return [];
    }
  }
}

// ─── Step 2: Trace Blast Radius ─────────────────────────────

/**
 * Parse import/require statements from a file to find its dependencies.
 */
function parseImports(content: string, filePath: string): string[] {
  const dir = dirname(filePath);
  const imports: string[] = [];

  // ES module imports: import X from './path'
  const esImportRegex = /import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = esImportRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith(".")) {
      imports.push(resolveImportPath(dir, importPath));
    }
  }

  // CommonJS requires: require('./path')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (importPath.startsWith(".")) {
      imports.push(resolveImportPath(dir, importPath));
    }
  }

  // Python imports: from .module import X
  if (extname(filePath) === ".py") {
    const pyImportRegex = /from\s+(\.[\w.]+)\s+import/g;
    while ((match = pyImportRegex.exec(content)) !== null) {
      const modulePath = match[1].replace(/\./g, "/");
      imports.push(join(dir, modulePath));
    }
  }

  return imports;
}

/**
 * Resolve a relative import path to an absolute file path.
 * Handles missing extensions (.ts, .tsx, .js, .jsx) and index files.
 */
function resolveImportPath(fromDir: string, importPath: string): string {
  const base = join(fromDir, importPath);
  // Remove .js extension that might be in the import (ESM convention)
  const cleaned = base.replace(/\.js$/, "");
  return cleaned;
}

/**
 * Trace the blast radius: find all files connected to the changed files.
 * Walks the import graph bidirectionally up to `depth` levels.
 */
export async function traceBlastRadius(
  changedFiles: string[],
  worktreePath: string,
  depth: number,
  maxFiles: number,
): Promise<string[]> {
  const blastRadius = new Set<string>();
  const visited = new Set<string>();
  const fileImportMap = new Map<string, string[]>();

  // Build the full import graph for the worktree
  const allFiles = await collectSourceFiles(worktreePath);

  for (const file of allFiles) {
    try {
      const content = await readFile(file, "utf-8");
      const imports = parseImports(content, file);
      fileImportMap.set(file, imports);
    } catch {
      /* skip unreadable files */
    }
  }

  // Build reverse import map (who imports this file?)
  const reverseImportMap = new Map<string, string[]>();
  for (const [file, imports] of fileImportMap) {
    for (const imp of imports) {
      // Match against all possible resolved paths
      for (const sourceFile of allFiles) {
        const normalized = sourceFile.replace(/\.(ts|tsx|js|jsx)$/, "");
        if (normalized === imp || normalized === imp + "/index") {
          if (!reverseImportMap.has(sourceFile)) {
            reverseImportMap.set(sourceFile, []);
          }
          reverseImportMap.get(sourceFile)!.push(file);
        }
      }
    }
  }

  // BFS from changed files, walking both directions
  let frontier = [...changedFiles];
  let currentDepth = 0;

  while (frontier.length > 0 && currentDepth < depth) {
    const nextFrontier: string[] = [];

    for (const file of frontier) {
      if (visited.has(file)) continue;
      visited.add(file);

      // Add to blast radius (but not the original changed files)
      if (!changedFiles.includes(file)) {
        blastRadius.add(file);
      }

      if (blastRadius.size >= maxFiles) break;

      // Forward: files this file imports
      const imports = fileImportMap.get(file) || [];
      for (const imp of imports) {
        for (const sourceFile of allFiles) {
          const normalized = sourceFile.replace(/\.(ts|tsx|js|jsx)$/, "");
          if (
            (normalized === imp || normalized === imp + "/index") &&
            !visited.has(sourceFile)
          ) {
            nextFrontier.push(sourceFile);
          }
        }
      }

      // Reverse: files that import this file
      const importers = reverseImportMap.get(file) || [];
      for (const importer of importers) {
        if (!visited.has(importer)) {
          nextFrontier.push(importer);
        }
      }
    }

    frontier = nextFrontier;
    currentDepth++;
    if (blastRadius.size >= maxFiles) break;
  }

  return Array.from(blastRadius).slice(0, maxFiles);
}

/**
 * Recursively collect all source files in a directory.
 */
async function collectSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry)) continue;

      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        files.push(...(await collectSourceFiles(fullPath)));
      } else if (SCANNABLE_EXTENSIONS.has(extname(entry))) {
        files.push(fullPath);
      }
    }
  } catch {
    /* permission denied etc */
  }

  return files;
}

// ─── Step 3: Build Context ──────────────────────────────────

/**
 * Build the context payload for the LLM. Includes changed files
 * and blast radius files with their contents.
 */
export async function buildBlastRadiusContext(
  changedFiles: string[],
  blastRadiusFiles: string[],
  worktreePath: string,
): Promise<string> {
  const sections: string[] = [];

  // Changed files section
  sections.push("## YOUR CHANGED FILES\n");
  for (const file of changedFiles) {
    try {
      const content = await readFile(file, "utf-8");
      const relPath = relative(worktreePath, file);
      // Truncate very large files
      const truncated =
        content.length > 5000
          ? content.slice(0, 5000) + "\n... [TRUNCATED]"
          : content;
      sections.push(`### ${relPath}\n\`\`\`\n${truncated}\n\`\`\`\n`);
    } catch {
      /* skip */
    }
  }

  // Blast radius section
  if (blastRadiusFiles.length > 0) {
    sections.push("\n## BLAST RADIUS — Connected Files\n");
    sections.push(
      "These files import from or are imported by the changed files.\n",
    );
    for (const file of blastRadiusFiles) {
      try {
        const content = await readFile(file, "utf-8");
        const relPath = relative(worktreePath, file);
        const truncated =
          content.length > 3000
            ? content.slice(0, 3000) + "\n... [TRUNCATED]"
            : content;
        sections.push(`### ${relPath}\n\`\`\`\n${truncated}\n\`\`\`\n`);
      } catch {
        /* skip */
      }
    }
  }

  return sections.join("\n");
}

// ─── Step 4: Analyze with AI ────────────────────────────────

/**
 * Run the Scavenger Bot AI analysis on the blast radius.
 */
export async function analyzeBlastRadius(
  context: string,
  modelConfig: ModelPhaseConfig,
): Promise<{
  findings: ScavengerFinding[];
  rawResponse: string;
  model: string;
  duration: number;
}> {
  const prompt = `You are the Scavenger Bot — an AI-powered blast radius scanner.

You are reviewing code that is CONNECTED to the developer's changes. Your job is to find COLLATERAL DAMAGE — issues in surrounding files that may have been caused or exposed by the changes.

Focus on:
- **Broken Contracts**: Function signatures changed but callers not updated
- **Stale References**: Imports pointing to renamed/moved/deleted exports
- **Missing Error Handling**: New code paths without try/catch or error checks
- **Inconsistent Patterns**: New code using different patterns than surrounding code
- **Security Issues**: Unsanitized inputs, exposed secrets, missing auth checks
- **Type Mismatches**: Changed types that break downstream consumers
- **Dead Code**: Exports/functions no longer used after the changes

For each finding, respond in this EXACT format (one per line):
[SEVERITY] | [FILE] | [LINE_RANGE] | [CATEGORY] | [DESCRIPTION] | [SUGGESTION]

Where SEVERITY is one of: CRITICAL, WARNING, INFO
Where CATEGORY is one of: broken-contract, stale-reference, missing-error-handling, inconsistent-pattern, security, type-mismatch, dead-code

If the code looks clean with no issues, respond with:
CLEAN — No collateral damage detected.

Be thorough but precise. Only report real issues, not style preferences.`;

  const startTime = Date.now();
  const response = await executePrompt(prompt, context, modelConfig);

  // Parse findings from response
  const findings: ScavengerFinding[] = [];

  if (!response.content.includes("CLEAN")) {
    const lines = response.content.split("\n");
    for (const line of lines) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 5) {
        const severityRaw = parts[0].toUpperCase();
        let severity: ScavengerFinding["severity"] = "info";
        if (severityRaw.includes("CRITICAL")) severity = "critical";
        else if (severityRaw.includes("WARNING")) severity = "warning";

        findings.push({
          file: parts[1] || "unknown",
          lineRange: parts[2] || undefined,
          severity,
          category: parts[3] || "general",
          description: parts[4] || "",
          suggestion: parts[5] || undefined,
        });
      }
    }
  }

  return {
    findings,
    rawResponse: response.content,
    model: response.model,
    duration: Date.now() - startTime,
  };
}

// ─── Step 5: Report ─────────────────────────────────────────

/**
 * Run the full Scavenger Bot pipeline and return a report.
 */
export async function runScavengerBot(
  worktreePath: string,
  config: FlareConfig,
  modelConfig: ModelPhaseConfig,
): Promise<ScavengerReport> {
  const startTime = Date.now();

  // Step 1: Get changed files
  console.log(chalk.gray("   🔎 Finding changed files..."));
  const changedFiles = getChangedFiles(worktreePath);

  if (changedFiles.length === 0) {
    console.log(chalk.yellow("   ⚠️  No changed files detected."));
    return {
      changedFiles: [],
      blastRadiusFiles: [],
      findings: [],
      totalFilesAnalyzed: 0,
      clean: true,
      aiModel: modelConfig.model,
      duration: Date.now() - startTime,
    };
  }

  console.log(chalk.white(`   📁 Changed files: ${changedFiles.length}`));
  for (const f of changedFiles) {
    console.log(chalk.gray(`      → ${relative(worktreePath, f)}`));
  }

  // Step 2: Trace blast radius
  console.log(chalk.gray("\n   🔎 Tracing blast radius..."));
  const blastRadiusFiles = await traceBlastRadius(
    changedFiles,
    worktreePath,
    config.scavenger.blastRadiusDepth,
    config.scavenger.maxFiles,
  );

  console.log(
    chalk.white(
      `   💥 Blast radius: ${blastRadiusFiles.length} connected files`,
    ),
  );
  for (const f of blastRadiusFiles) {
    console.log(chalk.gray(`      → ${relative(worktreePath, f)}`));
  }

  // Step 3: Build context
  console.log(chalk.gray("\n   📦 Building analysis context..."));
  const context = await buildBlastRadiusContext(
    changedFiles,
    blastRadiusFiles,
    worktreePath,
  );

  // Step 4: AI Analysis
  console.log(chalk.gray("   🧠 Analyzing blast radius with AI...\n"));
  const analysis = await analyzeBlastRadius(context, modelConfig);

  return {
    changedFiles: changedFiles.map((f) => relative(worktreePath, f)),
    blastRadiusFiles: blastRadiusFiles.map((f) => relative(worktreePath, f)),
    findings: analysis.findings,
    totalFilesAnalyzed: changedFiles.length + blastRadiusFiles.length,
    clean: analysis.findings.length === 0,
    aiModel: analysis.model,
    duration: Date.now() - startTime,
  };
}

/**
 * Print the Scavenger Bot report to the console.
 */
export function printScavengerReport(report: ScavengerReport): void {
  console.log(chalk.cyan.bold("\n🔎 SCAVENGER BOT — Blast Radius Report\n"));
  console.log(chalk.gray(`   Changed files: ${report.changedFiles.length}`));
  console.log(
    chalk.gray(
      `   Blast radius: ${report.blastRadiusFiles.length} connected files`,
    ),
  );
  console.log(chalk.gray(`   Total analyzed: ${report.totalFilesAnalyzed}`));
  console.log(chalk.gray(`   Model: ${report.aiModel}`));
  console.log(
    chalk.gray(`   Duration: ${(report.duration / 1000).toFixed(1)}s`),
  );

  if (report.clean) {
    console.log(
      chalk.green.bold("\n   ✅ ALL CLEAR — No collateral damage detected.\n"),
    );
    return;
  }

  // Group by severity
  const critical = report.findings.filter((f) => f.severity === "critical");
  const warnings = report.findings.filter((f) => f.severity === "warning");
  const info = report.findings.filter((f) => f.severity === "info");

  console.log(
    chalk.red.bold(
      `\n   ⚠️  ${report.findings.length} finding(s) in the blast radius:\n`,
    ),
  );

  if (critical.length > 0) {
    console.log(chalk.red.bold(`   🔴 CRITICAL (${critical.length})`));
    for (const f of critical) {
      console.log(
        chalk.red(`      ${f.file}${f.lineRange ? `:${f.lineRange}` : ""}`),
      );
      console.log(chalk.white(`      [${f.category}] ${f.description}`));
      if (f.suggestion) {
        console.log(chalk.gray(`      💡 ${f.suggestion}`));
      }
      console.log("");
    }
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow.bold(`   🟡 WARNING (${warnings.length})`));
    for (const f of warnings) {
      console.log(
        chalk.yellow(`      ${f.file}${f.lineRange ? `:${f.lineRange}` : ""}`),
      );
      console.log(chalk.white(`      [${f.category}] ${f.description}`));
      if (f.suggestion) {
        console.log(chalk.gray(`      💡 ${f.suggestion}`));
      }
      console.log("");
    }
  }

  if (info.length > 0) {
    console.log(chalk.blue.bold(`   🔵 INFO (${info.length})`));
    for (const f of info) {
      console.log(
        chalk.blue(`      ${f.file}${f.lineRange ? `:${f.lineRange}` : ""}`),
      );
      console.log(chalk.white(`      [${f.category}] ${f.description}`));
      if (f.suggestion) {
        console.log(chalk.gray(`      💡 ${f.suggestion}`));
      }
      console.log("");
    }
  }
}
