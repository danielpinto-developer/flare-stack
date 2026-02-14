/**
 * FLARE STACK — Entropy Hunter
 *
 * Mutation testing + historical regression detection.
 * Finds the "dark corners" of your codebase where tests don't actually
 * catch breaking changes.
 *
 * Workflow:
 *   1. Identify test files for a given source file
 *   2. Apply mutations (remove returns, flip booleans, swap operators)
 *   3. Run tests — if they still pass, your tests have blind spots
 *   4. Generate a report of "survived" mutations
 *
 * This is the "how confident are you REALLY in your test suite?" module.
 */

import { readFile, writeFile, readdir, stat } from "fs/promises";
import { join, extname, basename, dirname } from "path";
import chalk from "chalk";
import { execSync } from "child_process";

export interface Mutation {
  file: string;
  line: number;
  type: string;
  original: string;
  mutated: string;
}

export interface MutationResult {
  mutation: Mutation;
  killed: boolean;
  testOutput?: string;
}

export interface EntropyReport {
  totalMutations: number;
  killed: number;
  survived: number;
  score: number; // 0-100, percentage killed
  results: MutationResult[];
  targetDir: string;
}

type MutationFn = (line: string) => string | null;

/**
 * Mutation operators — each transforms a line of code.
 * Returns null if the mutation doesn't apply.
 */
const MUTATION_OPERATORS: Record<string, MutationFn> = {
  // Flip boolean returns
  "negate-return": (line: string): string | null => {
    if (/return\s+true\s*;/.test(line)) return line.replace("true", "false");
    if (/return\s+false\s*;/.test(line)) return line.replace("false", "true");
    return null;
  },

  // Remove return value (return undefined)
  "void-return": (line: string): string | null => {
    const match = line.match(/^(\s*)return\s+(.+);/);
    if (match && !match[2].match(/^(true|false|null|undefined)$/)) {
      return `${match[1]}return undefined;`;
    }
    return null;
  },

  // Swap comparison operators
  "swap-comparison": (line: string): string | null => {
    if (/===/.test(line)) return line.replace("===", "!==");
    if (/!==/.test(line)) return line.replace("!==", "===");
    if (/>(?!=)/.test(line) && !/>>=/.test(line)) return line.replace(">", "<");
    if (/<(?!=)/.test(line) && !/<<=/.test(line)) return line.replace("<", ">");
    return null;
  },

  // Swap arithmetic operators
  "swap-arithmetic": (line: string): string | null => {
    if (/\+(?!=)/.test(line) && !/\+\+/.test(line) && !/'\+/.test(line))
      return line.replace("+", "-");
    if (/\*(?!=)/.test(line) && !/\*\*/.test(line))
      return line.replace("*", "/");
    return null;
  },

  // Remove conditionals
  "remove-conditional": (line: string): string | null => {
    if (/^\s*if\s*\(/.test(line)) {
      return line.replace(/if\s*\(.*\)/, "if (true)");
    }
    return null;
  },
};

/**
 * Generate mutations for a source file.
 */
export async function generateMutations(
  filePath: string,
  maxMutations: number = 20,
): Promise<Mutation[]> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const mutations: Mutation[] = [];

  for (let i = 0; i < lines.length && mutations.length < maxMutations; i++) {
    const line = lines[i];

    // Skip comments, imports, blank lines
    if (/^\s*(\/\/|\/\*|\*|import |export \{)/.test(line)) continue;
    if (line.trim() === "") continue;

    for (const [type, mutate] of Object.entries(MUTATION_OPERATORS)) {
      if (mutations.length >= maxMutations) break;

      const mutated = mutate(line);
      if (mutated && mutated !== line) {
        mutations.push({
          file: filePath,
          line: i + 1,
          type,
          original: line,
          mutated,
        });
      }
    }
  }

  return mutations;
}

/**
 * Apply a mutation, run tests, check if it was killed.
 */
export async function testMutation(
  mutation: Mutation,
  testCommand: string,
  testCwd: string,
): Promise<MutationResult> {
  // Read original
  const original = await readFile(mutation.file, "utf-8");
  const lines = original.split("\n");

  // Apply mutation
  lines[mutation.line - 1] = mutation.mutated;
  await writeFile(mutation.file, lines.join("\n"));

  let killed = false;
  let testOutput = "";

  try {
    // Run tests — if they FAIL, the mutation was killed (good!)
    execSync(testCommand, {
      cwd: testCwd,
      stdio: "pipe",
      timeout: 30000,
      encoding: "utf-8",
    });
    // Tests passed → mutation SURVIVED (bad — tests didn't catch the change)
    killed = false;
    testOutput = "Tests passed (mutation survived)";
  } catch (error) {
    // Tests failed → mutation KILLED (good — tests caught the change)
    killed = true;
    testOutput = "Tests failed (mutation killed)";
  } finally {
    // ALWAYS restore original
    await writeFile(mutation.file, original);
  }

  return { mutation, killed, testOutput };
}

/**
 * Run the entropy hunter against a directory.
 */
export async function runEntropyHunter(
  targetDir: string,
  testCommand: string = "npm test",
): Promise<EntropyReport> {
  console.log(chalk.cyan("   🔬 Scanning for mutation targets..."));

  // Find source files
  const sourceFiles = await collectSourceFiles(targetDir);
  console.log(chalk.gray(`   Found ${sourceFiles.length} source file(s)`));

  // Generate mutations
  const allMutations: Mutation[] = [];
  for (const file of sourceFiles) {
    const mutations = await generateMutations(file, 5); // 5 per file max
    allMutations.push(...mutations);
  }

  console.log(chalk.cyan(`   🧬 Generated ${allMutations.length} mutation(s)`));

  // Test each mutation
  const results: MutationResult[] = [];
  let killed = 0;

  for (let i = 0; i < allMutations.length; i++) {
    const mutation = allMutations[i];
    console.log(
      chalk.gray(
        `   [${i + 1}/${allMutations.length}] ${mutation.type} @ ${basename(mutation.file)}:${mutation.line}`,
      ),
    );

    const result = await testMutation(mutation, testCommand, targetDir);
    results.push(result);

    if (result.killed) {
      killed++;
      console.log(chalk.green(`      ✅ Killed`));
    } else {
      console.log(chalk.red(`      ❌ Survived`));
    }
  }

  const survived = allMutations.length - killed;
  const score =
    allMutations.length > 0 ? (killed / allMutations.length) * 100 : 100;

  return {
    totalMutations: allMutations.length,
    killed,
    survived,
    score,
    results,
    targetDir,
  };
}

/**
 * Collect source files (non-test .ts/.js files).
 */
async function collectSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const IGNORE = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage",
    "__tests__",
  ]);

  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      if (IGNORE.has(entry)) continue;
      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        files.push(...(await collectSourceFiles(fullPath)));
      } else {
        const ext = extname(entry);
        if (
          (ext === ".ts" || ext === ".js") &&
          !entry.includes(".test.") &&
          !entry.includes(".spec.")
        ) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // Permission denied, etc.
  }

  return files;
}

/**
 * Print entropy report.
 */
export function printEntropyReport(report: EntropyReport): void {
  console.log(chalk.cyan.bold("\n🧬 ENTROPY HUNTER REPORT\n"));
  console.log(chalk.gray(`   Target: ${report.targetDir}`));
  console.log(chalk.gray(`   Total mutations: ${report.totalMutations}`));
  console.log(chalk.green(`   Killed: ${report.killed}`));
  console.log(chalk.red(`   Survived: ${report.survived}`));

  const scoreColor =
    report.score >= 80
      ? chalk.green
      : report.score >= 50
        ? chalk.yellow
        : chalk.red;
  console.log(scoreColor(`   Score: ${report.score.toFixed(1)}%`));

  if (report.survived > 0) {
    console.log(
      chalk.red.bold("\n   ⚠️  SURVIVING MUTATIONS (blind spots):\n"),
    );

    for (const r of report.results.filter((r) => !r.killed)) {
      console.log(
        chalk.yellow(
          `   ${r.mutation.type} @ ${basename(r.mutation.file)}:${r.mutation.line}`,
        ),
      );
      console.log(chalk.gray(`     Original: ${r.mutation.original.trim()}`));
      console.log(chalk.red(`     Mutated:  ${r.mutation.mutated.trim()}`));
      console.log("");
    }
  } else {
    console.log(
      chalk.green.bold("\n   ✅ ALL MUTATIONS KILLED — Tests are solid.\n"),
    );
  }
}
