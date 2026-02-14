/**
 * FLARE STACK — Try Command
 *
 * `flare try` — Zero-config sandbox demo.
 * Creates a temporary repo, generates a sample ticket, and walks through
 * the full spawn → greenlight workflow so new users can experience the tool.
 */

import { Command } from "commander";
import chalk from "chalk";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

export const tryCommand = new Command("try")
  .description(
    "Zero-config sandbox demo — experience FLARE STACK in 60 seconds",
  )
  .option("--clean", "Clean up the sandbox after demo")
  .action(async (options) => {
    const sandboxDir = join(process.cwd(), ".flare-sandbox");

    if (options.clean) {
      if (existsSync(sandboxDir)) {
        rmSync(sandboxDir, { recursive: true, force: true });
        console.log(chalk.green("✅ Sandbox cleaned."));
      } else {
        console.log(chalk.yellow("⚠️  No sandbox found."));
      }
      return;
    }

    console.log(chalk.cyan.bold("\n🧪 FLARE STACK — Sandbox Demo\n"));
    console.log(
      chalk.gray(
        "   This creates a temporary Git repo to demonstrate the workflow.\n",
      ),
    );

    // 1. Create sandbox directory
    const repoDir = join(sandboxDir, "demo-app");
    const workspacesDir = join(sandboxDir, "workspaces");

    if (existsSync(sandboxDir)) {
      console.log(
        chalk.yellow(
          "⚠️  Sandbox already exists. Run `flare try --clean` first.\n",
        ),
      );
      return;
    }

    mkdirSync(repoDir, { recursive: true });
    mkdirSync(workspacesDir, { recursive: true });

    // 2. Initialize a sample Git repo
    console.log(chalk.cyan("   📦 Creating sample Git repo..."));
    execSync("git init", { cwd: repoDir, stdio: "ignore" });
    writeFileSync(
      join(repoDir, "README.md"),
      "# Demo App\n\nA sample app for FLARE STACK demo.\n",
    );
    writeFileSync(
      join(repoDir, "index.js"),
      'console.log("Hello from demo-app");\n',
    );
    execSync('git add -A && git commit -m "init: demo app"', {
      cwd: repoDir,
      stdio: "ignore",
    });
    console.log(chalk.green("   ✅ Sample repo created"));

    // 3. Create a sample jira_queue.txt
    console.log(chalk.cyan("   📝 Generating sample ticket queue..."));
    const sampleQueue = `DEMO-001
Implement user authentication flow
TARGET: demo-app
SOURCE: main

DEMO-002
Add dark mode toggle to settings page
TARGET: demo-app
SOURCE: main

DEMO-003
Fix pagination bug in data table
TARGET: demo-app
SOURCE: main
`;
    writeFileSync(join(sandboxDir, "jira_queue.txt"), sampleQueue);
    console.log(chalk.green("   ✅ Sample tickets created (3 tickets)"));

    // 4. Generate sample prompts
    console.log(chalk.cyan("   📋 Creating prompt files..."));
    const promptsDir = join(sandboxDir, "prompts");
    mkdirSync(promptsDir, { recursive: true });

    writeFileSync(
      join(promptsDir, "1_PLAN.md"),
      `# Phase 1: PLAN

**Model Tier:** Low-Reasoning (Fast)

1. Read the Jira ticket details from context
2. Scan codebase for existing patterns
3. Create implementation plan
4. List files to create/modify
5. Identify risks
`,
    );

    writeFileSync(
      join(promptsDir, "2_VERIFY.md"),
      `# Phase 2: VERIFY

**Model Tier:** Low-Reasoning (Pattern Matching)

1. Verify plan follows codebase patterns
2. Check naming and imports
3. Confirm no scope creep
4. Issue PROCEED or REVISE
`,
    );

    writeFileSync(
      join(promptsDir, "3_IMPLEMENT.md"),
      `# Phase 3: IMPLEMENT

**Model Tier:** High-Reasoning (Precision)

1. Implement EXACTLY what plan specifies
2. Follow existing patterns
3. Include error handling
4. Do NOT add features not in ticket
`,
    );

    writeFileSync(
      join(promptsDir, "4_AUDIT.md"),
      `# Phase 4: AUDIT

**Model Tier:** High-Reasoning (Zero Hallucination)

1. Compare code vs Jira ticket requirements word-for-word
2. Strict code review against standards
3. Verdict: GREENLIGHT or REJECT
`,
    );

    writeFileSync(
      join(promptsDir, "CODE_REVIEW_PROMPT.md"),
      `# Code Review Standards

- No console.log in production code
- Use TypeScript strict mode
- All functions must have JSDoc
- No any types
- No commented-out code
`,
    );
    console.log(chalk.green("   ✅ Prompt files created"));

    // 5. Generate flare.config.ts
    console.log(chalk.cyan("   ⚙️  Generating config..."));
    const configContent = `/** @type {import('flare-stack').FlareConfig} */
export default {
  project: 'flare-sandbox',
  workspacesDir: '${workspacesDir}',

  repos: {
    'demo-app': {
      path: '${repoDir}',
      branches: ['main'],
      codeReviewPrompt: '${join(promptsDir, "CODE_REVIEW_PROMPT.md")}',
      stack: 'react-node',
    },
  },

  jira: {
    projectKeys: ['DEMO'],
    ticketPrefix: 'DEMO',
    source: 'mcp',
  },

  prompts: {
    plan: '${join(promptsDir, "1_PLAN.md")}',
    verify: '${join(promptsDir, "2_VERIFY.md")}',
    implement: '${join(promptsDir, "3_IMPLEMENT.md")}',
    audit: '${join(promptsDir, "4_AUDIT.md")}',
  },
};
`;
    writeFileSync(join(sandboxDir, "flare.config.ts"), configContent);
    console.log(chalk.green("   ✅ Config generated"));

    // 6. Summary
    console.log(chalk.cyan.bold("\n" + "═".repeat(60)));
    console.log(chalk.green.bold("\n🎉 SANDBOX READY!\n"));
    console.log(chalk.white("   Your sandbox is at:"));
    console.log(chalk.cyan(`   ${sandboxDir}\n`));

    console.log(chalk.white("   Now try these commands:\n"));
    console.log(chalk.yellow("   1. Spawn worktrees for all tickets:"));
    console.log(
      chalk.gray("      cd .flare-sandbox && flare ignite --queue\n"),
    );
    console.log(chalk.yellow("   2. Check status:"));
    console.log(chalk.gray("      flare status\n"));
    console.log(chalk.yellow("   3. Run greenlight pipeline:"));
    console.log(chalk.gray("      flare greenlight DEMO-001\n"));
    console.log(chalk.yellow("   4. Clean up when done:"));
    console.log(chalk.gray("      flare try --clean\n"));
    console.log(chalk.cyan("═".repeat(60) + "\n"));
  });
