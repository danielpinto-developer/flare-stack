/**
 * FLARE STACK — Init Command
 *
 * `flare init` — Interactive setup that generates flare.config.ts.
 * Asks for repo names, auto-finds paths, user inputs active branches per repo.
 */

import { Command } from "commander";
import { writeFile } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import { join, resolve } from "path";
import chalk from "chalk";
import { createInterface } from "readline";

function createPrompter() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdin.isTTY),
  });

  const ask = (question: string, defaultVal?: string): Promise<string> => {
    const suffix = defaultVal ? chalk.gray(` (${defaultVal})`) : "";
    return new Promise((res) => {
      rl.question(chalk.cyan(`   ${question}${suffix}: `), (answer) => {
        res(answer.trim() || defaultVal || "");
      });
    });
  };

  return { rl, ask };
}

/**
 * Try to find a repo path automatically (case-insensitive).
 * Checks ~/Documents/{name} and ../{name} relative to CWD.
 */
function findRepoPath(name: string): string | null {
  const nameLower = name.toLowerCase();

  // Check ~/Documents/
  const homeDocuments = join(
    process.env.HOME || "/Users/" + process.env.USER,
    "Documents",
  );
  const match = findCaseInsensitive(homeDocuments, nameLower);
  if (match) return match;

  // Check parent of CWD
  const parentDir = resolve(process.cwd(), "..");
  const parentMatch = findCaseInsensitive(parentDir, nameLower);
  if (parentMatch) return parentMatch;

  // Check if CWD itself is the repo
  const cwdName = process.cwd().split("/").pop()?.toLowerCase();
  if (cwdName === nameLower && existsSync(join(process.cwd(), ".git"))) {
    return process.cwd();
  }

  return null;
}

/**
 * Find a directory by name (case-insensitive) that contains .git
 */
function findCaseInsensitive(
  parentDir: string,
  nameLower: string,
): string | null {
  try {
    const entries = readdirSync(parentDir, { encoding: "utf-8" });
    for (const entry of entries) {
      if (entry.toLowerCase() === nameLower) {
        const fullPath = join(parentDir, entry);
        if (existsSync(join(fullPath, ".git"))) {
          return fullPath;
        }
      }
    }
  } catch {
    // directory doesn't exist or can't be read
  }
  return null;
}

interface RepoSetup {
  name: string;
  path: string;
  branches: string[];
}

export const initCommand = new Command("init")
  .description("Initialize flare.config.ts in current directory")
  .option("--force", "Overwrite existing config")
  .action(async (options) => {
    const configPath = join(process.cwd(), "flare.config.ts");

    if (existsSync(configPath) && !options.force) {
      const { createInterface: createRl } = await import("readline");
      const confirmRl = createRl({
        input: process.stdin,
        output: process.stdout,
      });
      const overwrite = await new Promise<string>((res) => {
        confirmRl.question(
          chalk.yellow(
            "   ⚠️  flare.config.ts already exists. Overwrite? (y/n): ",
          ),
          (answer) => {
            res(answer.trim().toLowerCase());
            confirmRl.close();
          },
        );
      });
      if (overwrite !== "y" && overwrite !== "yes") {
        console.log(chalk.gray("   Cancelled."));
        process.exit(0);
      }
    }

    console.log(chalk.white.bold("\n   🔥 FLARE STACK — Let's set up.\n"));

    const { rl, ask } = createPrompter();

    try {
      // --- Repos (comma-separated) ---
      const repoInput = await ask("Repo names (comma-separated)");
      const repoNames = repoInput
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);

      if (repoNames.length === 0) {
        console.error(chalk.red("\n   ❌ No repos provided."));
        rl.close();
        process.exit(1);
      }

      const repos: RepoSetup[] = [];

      for (const name of repoNames) {
        console.log(chalk.gray(`\n   --- ${name} ---`));

        // Auto-find path
        let repoPath = findRepoPath(name);
        if (repoPath) {
          console.log(chalk.green(`   📂 Found: ${repoPath}`));
        } else {
          repoPath = await ask(`   Path to ${name}`);
          repoPath = resolve(repoPath);
        }

        // User inputs active branches for this repo
        const branchInput = await ask(
          `Active branches for ${name} (comma-separated)`,
        );
        const branches = branchInput
          .split(",")
          .map((b) => b.trim())
          .filter(Boolean);

        repos.push({ name, path: repoPath, branches });
        console.log(
          chalk.green(
            `   ✅ ${name} → ${repoPath}\n      🌿 ${branches.join(", ")}`,
          ),
        );
      }

      // --- Jira ---
      console.log(chalk.white.bold("\n   🎫 Jira Setup\n"));

      // Loop until we get a valid URL AND successfully fetch the Cloud ID
      let siteUrl = "";
      let cloudId = "";

      for (let attempt = 0; attempt < 3; attempt++) {
        // Get URL with validation
        while (true) {
          siteUrl = await ask(
            "Jira site URL (e.g. https://your-org.atlassian.net)",
          );
          const trimmed = siteUrl.trim();
          if (
            trimmed &&
            trimmed.startsWith("https://") &&
            trimmed.includes("atlassian.net")
          ) {
            siteUrl = trimmed;
            break;
          }
          console.log(
            chalk.red(
              "   ❌ Invalid URL. Must be https://your-org.atlassian.net",
            ),
          );
        }

        // Auto-fetch cloud ID
        const cleanUrl = siteUrl.replace(/\/$/, "");
        console.log(
          chalk.gray(`\n   🔍 Fetching Cloud ID from ${cleanUrl}...`),
        );
        try {
          const res = await fetch(`${cleanUrl}/_edge/tenant_info`);
          if (res.ok) {
            const data = (await res.json()) as { cloudId?: string };
            if (data.cloudId) {
              cloudId = data.cloudId;
              console.log(chalk.green(`   ✅ Cloud ID: ${cloudId}`));
              break;
            }
          }
        } catch {
          // fetch failed
        }

        if (!cloudId) {
          console.log(
            chalk.red(
              "   ❌ Could not connect. Double-check the URL and try again.",
            ),
          );
        }
      }

      if (!cloudId) {
        console.log(
          chalk.red(
            "\n   ❌ Failed to fetch Cloud ID after 3 attempts. Check your Jira site URL and network connection.",
          ),
        );
        process.exit(1);
      }

      // Compute centralized workspacesDir next to the repos
      const firstRepoParent =
        repos.length > 0 ? resolve(repos[0].path, "..") : process.cwd();
      const workspacesDir = join(firstRepoParent, "flare-chambers");

      // --- Generate config ---
      const content = generateConfig({
        repos,
        cloudId,
        siteUrl,
        workspacesDir,
      });

      await writeFile(configPath, content, "utf-8");

      console.log(chalk.green.bold("\n   🔥 FLARE STACK — Config saved!\n"));
      console.log(chalk.cyan(`   Config: ${configPath}`));
      console.log(chalk.cyan(`   Worktrees: ${workspacesDir}`));

      // --- LLM API Key ---
      // Check root .env and common subdirectory .env files
      const envCandidates = [
        join(process.cwd(), ".env"),
        join(process.cwd(), "client", ".env"),
        join(process.cwd(), "server", ".env"),
      ];
      const { readFile } = await import("fs/promises");

      let envContent = "";
      let envPath = join(process.cwd(), ".env"); // default to root for writing
      for (const candidate of envCandidates) {
        try {
          const content = await readFile(candidate, "utf-8");
          if (
            /GEMINI_API_KEY=.+/.test(content) ||
            /OPENAI_API_KEY=.+/.test(content) ||
            /ANTHROPIC_API_KEY=.+/.test(content)
          ) {
            envContent = content;
            envPath = candidate;
            break;
          }
          // Keep first existing .env for writing even if no key found
          if (!envContent) {
            envContent = content;
            envPath = candidate;
          }
        } catch {
          // file doesn't exist
        }
      }
      const hasGemini = /GEMINI_API_KEY=.+/.test(envContent);
      const hasOpenAI = /OPENAI_API_KEY=.+/.test(envContent);
      const hasAnthropic = /ANTHROPIC_API_KEY=.+/.test(envContent);
      const existingProvider = hasGemini
        ? "GEMINI_API_KEY"
        : hasOpenAI
          ? "OPENAI_API_KEY"
          : hasAnthropic
            ? "ANTHROPIC_API_KEY"
            : null;

      if (existingProvider) {
        console.log(
          chalk.green(
            `\n   ✅ LLM key detected: ${existingProvider} (in .env)`,
          ),
        );
      } else {
        console.log(chalk.white.bold("\n   🤖 LLM Setup\n"));
        console.log(
          chalk.white(
            "   Flare uses an LLM to route tickets to the right repo + branch.",
          ),
        );
        console.log(chalk.white("   Add one of these to your .env file:\n"));
        console.log(chalk.cyan("      GEMINI_API_KEY=your-key"));
        console.log(chalk.cyan("      OPENAI_API_KEY=sk-..."));
        console.log(chalk.cyan("      ANTHROPIC_API_KEY=sk-ant-..."));

        await ask("\n   Press Enter once you've added the key to .env");

        // Re-read .env to check
        try {
          envContent = await readFile(envPath, "utf-8");
        } catch {
          // still no .env
        }

        const nowHasKey =
          /GEMINI_API_KEY=.+/.test(envContent) ||
          /OPENAI_API_KEY=.+/.test(envContent) ||
          /ANTHROPIC_API_KEY=.+/.test(envContent);

        if (nowHasKey) {
          const detected = /GEMINI_API_KEY=.+/.test(envContent)
            ? "GEMINI_API_KEY"
            : /OPENAI_API_KEY=.+/.test(envContent)
              ? "OPENAI_API_KEY"
              : "ANTHROPIC_API_KEY";
          console.log(chalk.green(`   ✅ Found ${detected} in .env`));
        } else {
          console.log(
            chalk.yellow(
              "   ⚠️  No LLM key found in .env. You'll be prompted when you run flare ignite.",
            ),
          );
        }
      }

      // --- Gemini API Key ---
      // The LLM key check above already handles GEMINI_API_KEY detection.
      // Just confirm it's there for the Gemini API (Google AI Studio).
      const hasGeminiKey = /GEMINI_API_KEY=.+/.test(envContent);
      if (hasGeminiKey) {
        console.log(
          chalk.green("\n   ✅ Gemini API key detected — Gemini 3 ready!"),
        );
      } else if (!existingProvider) {
        console.log(chalk.white.bold("\n   🤖 Gemini API Key\n"));
        console.log(
          chalk.white(
            "   Flare uses Gemini 3 for all AI phases (plan, verify, implement, scan, audit).",
          ),
        );
        console.log(chalk.white("   Get a free API key at:\n"));
        console.log(chalk.cyan("      https://aistudio.google.com/apikey\n"));
        console.log(chalk.white("   Then add to your .env:\n"));
        console.log(chalk.cyan("      GEMINI_API_KEY=your-key-here\n"));
      }

      // --- Ignite? ---
      const igniteNow = await ask("Run flare ignite now? (y/n)", "y");
      rl.close();

      if (
        igniteNow.toLowerCase() === "y" ||
        igniteNow.toLowerCase() === "yes"
      ) {
        console.log(chalk.white.bold("\n   🔥 Launching ignite...\n"));
        const { execSync } = await import("child_process");
        execSync("flare ignite", { stdio: "inherit", cwd: process.cwd() });
      } else {
        console.log(chalk.gray("\n   Run `flare ignite` when you're ready.\n"));
      }
    } catch {
      rl.close();
      console.error(chalk.red("❌ Init cancelled."));
      process.exit(1);
    }
  });

interface ConfigOptions {
  repos: RepoSetup[];
  cloudId: string;
  siteUrl: string;
  workspacesDir: string;
}

function generateConfig(opts: ConfigOptions): string {
  const repoEntries = opts.repos
    .map(
      (r) => `    '${r.name}': {
      path: '${r.path}',
      branches: [${r.branches.map((b) => `'${b}'`).join(", ")}],
    },`,
    )
    .join("\n");

  return `/**
 * FLARE STACK — Configuration
 *
 * Generated by \`flare init\`
 * Docs: https://github.com/danielpinto-developer/flare-stack
 */

/** @type {import('flare-stack').FlareConfig} */
export default {
  workspacesDir: '${opts.workspacesDir}',

  repos: {
${repoEntries}
  },

  jira: {
    cloudId: '${opts.cloudId}',
    siteUrl: '${opts.siteUrl}',
    projectKeys: [],
    queueStatus: 'Dev Review',
    ticketPrefix: '',
    source: 'mcp',
    autoComment: false,
    autoTransition: true,
  },

  models: {
    planning:       { provider: 'google', model: 'gemini-3-flash-preview', tier: 'low', temperature: 0.1 },
    verification:   { provider: 'google', model: 'gemini-3-pro-preview', tier: 'low', temperature: 0 },
    implementation: { provider: 'google', model: 'gemini-3-pro-preview', tier: 'high', temperature: 0.1 },
    audit:          { provider: 'google', model: 'gemini-3-pro-preview', tier: 'high', temperature: 0 },
  },

  prompts: {
    plan: '1_PLAN.md',
    verify: '2_VERIFY.md',
    implement: '3_IMPLEMENT.md',
    audit: '4_AUDIT.md',
  },

  branching: {
    pattern: 'feat/{ticketId}-{slug}',
    slugSource: 'ticketId-only',
  },

  infra: {
    cloud: 'gcp',
    runtime: 'cloud-run',
    database: 'postgres',
    ci: 'github-actions',
  },
};
`;
}
