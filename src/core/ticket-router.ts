/**
 * FLARE STACK — LLM Ticket Router
 *
 * Routes Jira tickets to the correct repo AND picks the right source branch.
 *
 * Supports multiple LLM providers:
 *   - Gemini (GEMINI_API_KEY or GOOGLE_API_KEY)
 *   - OpenAI (OPENAI_API_KEY)
 *   - Anthropic (ANTHROPIC_API_KEY)
 *
 * The LLM sees all repos and their active branches (user-configured during init).
 * Branches ARE the routing signal.
 *
 * Returns confidence 0-100 and a one-liner reason.
 */

import chalk from "chalk";
import { createInterface } from "readline";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { Ticket } from "../sources/types.js";
import type { FlareConfig, RepoConfig } from "../config/schema.js";
import { detectProvider, callLLM } from "./llm.js";

interface RoutingResult {
  repo: string;
  branch: string;
  confidence: number; // 0-100
  reason: string;
}

/**
 * Extract meaningful code-searchable terms from ticket text.
 * Finds PascalCase, camelCase, API paths, and backtick identifiers.
 */

// ═══ Main Router ══════════════════════════════════════════════

/**
 * Route tickets to repos + branches via LLM.
 *
 * Single LLM call per ticket:
 * - Picks the best repo
 * - Picks the best source branch within that repo
 * - Returns confidence (0-100) and a one-liner reason
 */
export async function routeTickets(
  tickets: Ticket[],
  config: FlareConfig,
): Promise<Ticket[]> {
  let provider = detectProvider();

  // Hard gate: block until user adds a key
  while (!provider) {
    console.log(chalk.red("\n   ❌ No LLM API key found in .env"));
    console.log(
      chalk.yellow(
        "   Add one of the following to your .env file:\n" +
          "     GEMINI_API_KEY=your-key\n" +
          "     OPENAI_API_KEY=your-key\n" +
          "     ANTHROPIC_API_KEY=your-key",
      ),
    );
    console.log(chalk.cyan("   Press Enter once you've added it..."));

    // Block until user presses Enter
    await new Promise<void>((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question("", () => {
        rl.close();
        resolve();
      });
    });

    // Re-read .env files
    for (const envPath of [
      join(process.cwd(), ".env"),
      join(process.cwd(), "client", ".env"),
      join(process.cwd(), "server", ".env"),
    ]) {
      if (existsSync(envPath)) {
        try {
          const content = readFileSync(envPath, "utf-8");
          for (const line of content.split("\n")) {
            const match = line.match(/^([A-Z_]+)=(.+)$/);
            if (match) {
              process.env[match[1]] = match[2].trim();
            }
          }
        } catch {
          /* ignore */
        }
      }
    }

    provider = detectProvider();
  }

  const repoNames = Object.keys(config.repos);

  // Single repo with one branch? No routing needed.
  if (repoNames.length <= 1) {
    const onlyRepo = config.repos[repoNames[0]] as RepoConfig;
    if ((onlyRepo.branches || []).length <= 1) {
      return tickets;
    }
  }

  const providerLabel =
    provider.name === "gemini"
      ? "Gemini Flash"
      : provider.name === "openai"
        ? "GPT-4o Mini"
        : "Claude Sonnet";

  console.log(chalk.cyan(`\n   🧠 Routing tickets via ${providerLabel}...\n`));

  const { execSync } = await import("child_process");

  // ═══ AGENT 1: Build repo-level summaries (high-level, no branch noise) ═══
  console.log(
    chalk.gray(
      `   🏢 Agent 1: Building repo profiles for ${repoNames.length} repo(s)...`,
    ),
  );

  const repoProfiles: Record<string, string> = {};
  for (const name of repoNames) {
    const r = config.repos[name] as RepoConfig;
    let profile = `REPO: "${name}"\n  Path: ${r.path}`;

    // Detect language and tech stack from marker files
    try {
      if (existsSync(join(r.path, "package.json"))) {
        const pkg = JSON.parse(
          readFileSync(join(r.path, "package.json"), "utf-8"),
        );
        const deps = Object.keys({
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
        });
        const stack: string[] = ["Node.js"];
        if (deps.some((d) => d.includes("react"))) stack.push("React");
        if (deps.some((d) => d.includes("express"))) stack.push("Express");
        if (deps.some((d) => d.includes("sequelize"))) stack.push("Sequelize");
        if (deps.some((d) => d.includes("next"))) stack.push("Next.js");
        if (deps.some((d) => d.includes("fastapi"))) stack.push("FastAPI");
        profile += `\n  Language: JavaScript/TypeScript`;
        profile += `\n  Tech Stack: ${stack.join(", ")}`;
        if (pkg.description) profile += `\n  Description: ${pkg.description}`;
      }
    } catch {
      /* no package.json */
    }

    try {
      if (existsSync(join(r.path, "requirements.txt"))) {
        const reqs = readFileSync(join(r.path, "requirements.txt"), "utf-8");
        const deps = reqs
          .split("\n")
          .filter((l) => l.trim() && !l.startsWith("#"))
          .map((l) => l.split("==")[0].split(">=")[0].trim())
          .slice(0, 15);
        profile += `\n  Language: Python`;
        profile += `\n  Dependencies: ${deps.join(", ")}`;
      }
    } catch {
      /* no requirements.txt */
    }

    try {
      if (existsSync(join(r.path, "pyproject.toml"))) {
        profile += `\n  Language: Python (pyproject.toml found)`;
        const toml = readFileSync(join(r.path, "pyproject.toml"), "utf-8");
        const descMatch = toml.match(/description\s*=\s*"([^"]+)"/);
        if (descMatch) profile += `\n  Description: ${descMatch[1]}`;
      }
    } catch {
      /* no pyproject.toml */
    }

    // Read README for a high-level repo purpose (first 10 lines)
    try {
      const readmePaths = ["README.md", "readme.md", "Readme.md"];
      for (const rp of readmePaths) {
        const readmePath = join(r.path, rp);
        if (existsSync(readmePath)) {
          const readme = readFileSync(readmePath, "utf-8")
            .split("\n")
            .slice(0, 10)
            .join("\n");
          profile += `\n  README (first 10 lines):\n    ${readme.split("\n").join("\n    ")}`;
          break;
        }
      }
    } catch {
      /* no readme */
    }

    // Deep directory structure — shows what domains/features each repo ACTUALLY owns
    // This is the critical signal for routing. Without this, the LLM only sees
    // "Node.js + React" vs "Python + FastAPI" and routes by keyword, not by ownership.
    try {
      // Top-level structure (architecture at a glance)
      const ls = execSync(`ls -1 "${r.path}" | head -25`, {
        timeout: 3000,
        encoding: "utf-8",
      }).trim();
      if (ls) {
        profile += `\n  Top-level structure:\n    ${ls.split("\n").join("\n    ")}`;
      }
    } catch {
      /* skip */
    }

    // Full codebase file tree — let the LLM see EVERYTHING and decide what's relevant
    // No keyword filtering — the LLM is smarter than grep
    try {
      const defaultBranch =
        (config.repos[name] as RepoConfig).branches?.[0] || "develop";
      const fileTree = execSync(
        `git ls-tree -r --name-only origin/${defaultBranch} 2>/dev/null || git ls-tree -r --name-only HEAD 2>/dev/null`,
        { cwd: r.path, timeout: 10000, encoding: "utf-8" },
      ).trim();
      if (fileTree) {
        // Filter out noise: node_modules, .git, lock files, images, fonts
        const meaningful = fileTree
          .split("\n")
          .filter(
            (f) =>
              !f.includes("node_modules/") &&
              !f.includes(".git/") &&
              !f.endsWith(".lock") &&
              !f.endsWith(".png") &&
              !f.endsWith(".jpg") &&
              !f.endsWith(".svg") &&
              !f.endsWith(".woff") &&
              !f.endsWith(".woff2") &&
              !f.endsWith(".ttf") &&
              !f.endsWith(".eot") &&
              !f.endsWith(".ico") &&
              !f.endsWith(".map"),
          )
          .slice(0, 200) // cap at 200 files to avoid token explosion
          .join("\n    ");
        profile += `\n  Full file tree (${defaultBranch}):\n    ${meaningful}`;
      }
    } catch {
      /* git ls-tree failed */
    }

    // Branch names + recent commits — critical signal for Agent 1!
    // Without this, Agent 1 never knows that inno has feature/ciwp-cohort
    const branches = (config.repos[name] as RepoConfig).branches || ["develop"];
    profile += `\n  Configured branches: ${branches.join(", ")}`;
    for (const branch of branches) {
      try {
        const log = execSync(
          `git log --oneline -10 origin/${branch} 2>/dev/null || git log --oneline -10 ${branch} 2>/dev/null`,
          { cwd: r.path, timeout: 5000, encoding: "utf-8" },
        ).trim();
        if (log) {
          profile += `\n  Recent commits on "${branch}":\n    ${log.split("\n").join("\n    ")}`;
        }
      } catch {
        /* no log */
      }
    }

    repoProfiles[name] = profile;
  }

  // ═══ AGENT 2 PREP: Build branch details per repo (only used for chosen repo) ═══
  console.log(chalk.gray(`   🌿 Agent 2: Auditing branch histories...\n`));

  const repoBranchDetails: Record<string, string> = {};

  for (const name of repoNames) {
    const r = config.repos[name] as RepoConfig;
    const branches = r.branches || ["develop"];
    let details = `REPO: "${name}"\n  Branches: [${branches.join(", ")}]`;

    try {
      execSync(`git fetch origin ${branches.join(" ")} 2>/dev/null`, {
        cwd: r.path,
        timeout: 15000,
      });
    } catch {
      /* fetch failed */
    }

    // Git log per branch + file tree audit
    for (const branch of branches) {
      try {
        const log = execSync(
          `git log --oneline -20 origin/${branch} 2>/dev/null || git log --oneline -20 ${branch} 2>/dev/null`,
          { cwd: r.path, timeout: 10000, encoding: "utf-8" },
        ).trim();
        if (log) {
          details += `\n\n  ── Recent history on "${branch}" ──\n    ${log.split("\n").join("\n    ")}`;
        }
      } catch {
        details += `\n\n  ── "${branch}": could not read git log ──`;
      }

      // Full file tree for this branch — the LLM sees EVERYTHING
      try {
        const branchRef = `origin/${branch}`;
        const fileTree = execSync(
          `git ls-tree -r --name-only ${branchRef} 2>/dev/null`,
          { cwd: r.path, timeout: 10000, encoding: "utf-8" },
        ).trim();
        if (fileTree) {
          const meaningful = fileTree
            .split("\n")
            .filter(
              (f) =>
                !f.includes("node_modules/") &&
                !f.includes(".git/") &&
                !f.endsWith(".lock") &&
                !f.endsWith(".png") &&
                !f.endsWith(".jpg") &&
                !f.endsWith(".svg") &&
                !f.endsWith(".woff") &&
                !f.endsWith(".woff2") &&
                !f.endsWith(".ttf") &&
                !f.endsWith(".eot") &&
                !f.endsWith(".ico") &&
                !f.endsWith(".map"),
            )
            .slice(0, 200)
            .join("\n    ");
          details += `\n\n  ── Full file tree on "${branch}" ──\n    ${meaningful}`;
        }
      } catch {
        /* git ls-tree failed */
      }
    }

    // Diff between branches
    if (branches.length > 1) {
      for (let i = 1; i < branches.length; i++) {
        const base = branches[0];
        const feat = branches[i];
        try {
          const diffStat = execSync(
            `git diff --stat origin/${base}..origin/${feat} 2>/dev/null | tail -25`,
            { cwd: r.path, timeout: 10000, encoding: "utf-8" },
          ).trim();
          if (diffStat) {
            details += `\n\n  ── Files unique to "${feat}" (not on "${base}") ──\n    ${diffStat.split("\n").join("\n    ")}`;
          }
        } catch {
          /* skip */
        }
      }
    }

    repoBranchDetails[name] = details;
  }

  // ═══ ROUTE EACH TICKET ═══════════════════════════════════════

  const routed: Ticket[] = [];

  for (const ticket of tickets) {
    try {
      // ─── AGENT 1: REPO CLASSIFIER ───────────────────────────
      const repoProfilesText = repoNames
        .map((n) => repoProfiles[n])
        .join("\n\n---\n\n");

      // ─── STEP 0: Quick grep pre-scan — find files that MENTION ticket-relevant terms ───
      // Extract key terms from the ticket: endpoint paths, model names, domain keywords
      const ticketText = `${ticket.id} ${ticket.summary || ""} ${ticket.rawContent || ""}`;
      const searchTerms: string[] = [];

      // Extract API endpoints (e.g., /api/ciwp/step-1, /ingest)
      const endpoints = ticketText.match(/(?:\/[\w-]+){2,}/g) || [];
      for (const ep of endpoints.slice(0, 5)) {
        // Use the last segment as a search term (e.g., "step-1", "ingest")
        const parts = ep.split("/").filter(Boolean);
        if (parts.length > 0) searchTerms.push(parts[parts.length - 1]);
        // Also use the full path minus the leading slash
        if (parts.length > 1) searchTerms.push(parts.slice(-2).join("/"));
      }

      // Extract model/class names (PascalCase words)
      const pascalWords =
        ticketText.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g) || [];
      for (const pw of pascalWords.slice(0, 5)) {
        if (
          !["FastAPI", "GitHub", "JavaScript", "TypeScript", "NodeJs"].includes(
            pw,
          )
        ) {
          searchTerms.push(pw);
        }
      }

      // Extract ticket ID prefix as domain hint (e.g., "IW" from IW-6046)
      const idPrefix = ticket.id.match(/^([A-Z]+)-/)?.[1];
      // Extract specific file references (e.g., "goaldashboardlink.js", "main.py")
      const fileRefs =
        ticketText.match(/\b[\w-]+\.(js|ts|py|jsx|tsx)\b/g) || [];
      for (const fr of fileRefs.slice(0, 5)) {
        searchTerms.push(fr.replace(/\.(js|ts|py|jsx|tsx)$/, "")); // search without extension too
      }

      // Deduplicate and filter out very short terms
      const uniqueTerms = [...new Set(searchTerms)]
        .filter((t) => t.length >= 3)
        .slice(0, 8);

      // Run quick grep across each repo for these terms
      let grepHits = "";
      if (uniqueTerms.length > 0) {
        console.log(
          chalk.gray(
            `   🔎 ${ticket.id}: Pre-scanning for: ${uniqueTerms.join(", ")}`,
          ),
        );

        for (const name of repoNames) {
          const r = config.repos[name] as RepoConfig;
          const defaultBranch = r.branches?.[0] || "develop";
          let repoHits = "";
          for (const term of uniqueTerms) {
            try {
              const hits = execSync(
                `git grep -l -i "${term}" origin/${defaultBranch} 2>/dev/null | sed "s|^origin/${defaultBranch}:||" | head -10`,
                { cwd: r.path, timeout: 5000, encoding: "utf-8" },
              ).trim();
              if (hits) {
                repoHits += `\n    "${term}" found in:\n      ${hits.split("\n").join("\n      ")}`;
              }
            } catch {
              /* no matches */
            }
          }
          if (repoHits) {
            grepHits += `\n  GREP HITS in "${name}":${repoHits}`;
          }
        }
      }

      // ─── STEP 1: LLM sees file trees + grep hits, picks files to drill into ───
      const repoScanPrompt = `You are Agent 1: the REPO CLASSIFIER. You work in TWO steps.

STEP 1 (this step): Study the file trees AND grep results below, then pick up to 10 files you want to READ IN FULL to make your routing decision.

IMPORTANT: Read the ticket carefully. Does it contain code samples in JavaScript (DataTypes., module.exports, queryInterface)?
If YES → focus your file picks on the JavaScript/Node.js repo to confirm it has the files being modified.
Does it reference a Python endpoint as something to CALL? That's a dependency, not the target repo.

TICKET:
  ID: ${ticket.id}
  Summary: ${ticket.summary || "(no summary)"}
  Full Description:
${ticket.rawContent || "(no description)"}

REPOSITORIES (complete file trees, including branch names and commit history):
${repoProfilesText}
${grepHits ? `\nPRE-SCAN RESULTS (files that mention ticket-relevant terms):\n${grepHits}` : ""}

Pick files from BOTH repos if relevant — especially files that match what the ticket says to modify.
The grep results show which files mention ticket-relevant terms. Use these as candidates.

Return a JSON object with:
- "files": an array of objects, each with "repo" (repo name) and "path" (file path from the tree). Max 10 files. Prioritize files from the grep results AND files matching what the ticket explicitly says to modify.
- "initial_guess": your best guess repo name based on WHERE CODE WILL BE WRITTEN (not where referenced endpoints exist)
- "reasoning": brief explanation of what you're looking for

Return ONLY the JSON object.`;

      const { extractJSON } = await import("./extract-json.js");
      let fileContents = "";

      try {
        const scanText = await callLLM(provider, repoScanPrompt);
        const scanResult = extractJSON<{
          files: Array<{ repo: string; path: string }>;
          initial_guess: string;
          reasoning: string;
        }>(scanText);

        console.log(
          chalk.gray(
            `   🔍 ${ticket.id}: Agent 1 drilling into ${scanResult.files.length} files...`,
          ),
        );

        // Read the requested files via git show
        for (const { repo: reqRepo, path: filePath } of scanResult.files.slice(
          0,
          10,
        )) {
          const repoName =
            repoNames.find(
              (n) => n.toLowerCase() === (reqRepo || "").toLowerCase(),
            ) ||
            repoNames.find(
              (n) =>
                n.toLowerCase().includes((reqRepo || "").toLowerCase()) ||
                (reqRepo || "").toLowerCase().includes(n.toLowerCase()),
            );
          if (!repoName || !config.repos[repoName]) continue;

          const r = config.repos[repoName] as RepoConfig;
          const defaultBranch = r.branches?.[0] || "develop";
          try {
            const content = execSync(
              `git show origin/${defaultBranch}:"${filePath}" 2>/dev/null | head -80`,
              { cwd: r.path, timeout: 5000, encoding: "utf-8" },
            ).trim();
            if (content) {
              fileContents += `\n\n── FILE: ${repoName}/${filePath} (first 80 lines) ──\n${content}`;
            }
          } catch {
            // Try without origin/ prefix
            try {
              const content = execSync(
                `git show HEAD:"${filePath}" 2>/dev/null | head -80`,
                { cwd: r.path, timeout: 5000, encoding: "utf-8" },
              ).trim();
              if (content) {
                fileContents += `\n\n── FILE: ${repoName}/${filePath} (first 80 lines) ──\n${content}`;
              }
            } catch {
              /* file not found */
            }
          }
        }
      } catch {
        /* scan step failed, proceed without file contents */
      }

      // ─── STEP 2: LLM makes final decision with file contents ───
      const repoPrompt = `You are Agent 1: the REPO CLASSIFIER. Make your FINAL routing decision.

TASK: Which repository should this ticket be worked on?

CRITICAL RULES — READ ALL BEFORE DECIDING:

1. BRANCH SIGNAL (STRONGEST SIGNAL): If a repo has a FEATURE BRANCH whose name matches the ticket's domain (e.g., "feature/ciwp-cohort" for ANY CIWP-related ticket), that repo is where the developer works on this domain. Route there. This is the developer's EXPLICIT declaration of where work happens.
   - A feature branch named "feature/ciwp-cohort" means ALL CIWP tickets go to that repo, regardless of whether the ticket talks about Python, React, or anything else.
   - Even if another repo has backend code referenced by the ticket, the feature branch tells you which repo the developer will branch from.

2. TICKET INTENT: The ticket describes code TO BE WRITTEN, not just code that EXISTS.
   - If the ticket contains JavaScript/TypeScript code samples (e.g., DataTypes.STRING, module.exports, queryInterface), the work belongs in the JavaScript/Node.js repo.
   - If the ticket mentions creating a React component, the work belongs in the repo with React frontend code.
   - A reference to a Python endpoint (e.g., "POST /ingest in main.py") means "integrate with this endpoint", NOT "modify this endpoint". The work is in the CONSUMER repo.

3. CODE LANGUAGE MATCH: Look at the actual code samples in the ticket.
   - JavaScript/TypeScript syntax → JavaScript/Node.js repo
   - Python syntax → Python repo
   - But this is OVERRIDDEN by rule 1 (branch signal) when a feature branch match exists.

4. MONOREPO over MICROSERVICE: When a ticket is full-stack, prefer the monorepo. The separate backend service is a dependency, not the development target.

5. DO NOT be fooled by similar model names across repos. A ticket that says "update goaldashboardlink.js" goes to the repo with .js files, NOT a Python repo that has goal_dashboard_links.py.

TICKET:
  ID: ${ticket.id}
  Summary: ${ticket.summary || "(no summary)"}
  Full Description:
${ticket.rawContent || "(no description)"}

REPOSITORIES (with full file trees):
${repoProfilesText}
${fileContents ? `\nFILE CONTENTS YOU REQUESTED:\n${fileContents}` : ""}

Return a JSON object with:
- "repo": the repo name (MUST be one of: ${repoNames.map((n) => `"${n}"`).join(", ")})
- "confidence": 0-100
- "reason": a DETAILED paragraph (3-5 sentences) explaining your reasoning. Cite specific file paths and code you saw as evidence. Explain which files in that repo relate to this ticket and why. If multiple repos could match, explain why you picked this one over the others.

Return ONLY the JSON object.`;

      const repoText = await callLLM(provider, repoPrompt);
      let repoResult: { repo: string; confidence: number; reason: string };
      try {
        repoResult = extractJSON<{
          repo: string;
          confidence: number;
          reason: string;
        }>(repoText);
      } catch {
        console.log(
          chalk.yellow(
            `   ⚠️  ${ticket.id}: Agent 1 returned invalid JSON, using first repo`,
          ),
        );
        repoResult = {
          repo: repoNames[0],
          confidence: 30,
          reason: "Fallback — could not parse Agent 1 response",
        };
      }

      // Validate repo name (case-insensitive fuzzy match)
      let matchedRepo = repoResult.repo;
      if (!config.repos[matchedRepo]) {
        const found = repoNames.find(
          (n) => n.toLowerCase() === (matchedRepo || "").toLowerCase(),
        );
        if (found) {
          matchedRepo = found;
        } else {
          const partial = repoNames.find(
            (n) =>
              n.toLowerCase().includes((matchedRepo || "").toLowerCase()) ||
              (matchedRepo || "").toLowerCase().includes(n.toLowerCase()),
          );
          if (partial) {
            matchedRepo = partial;
          } else {
            console.log(
              chalk.yellow(
                `   ⚠️  ${ticket.id}: Agent 1 returned unknown repo "${repoResult.repo}", using first repo`,
              ),
            );
            matchedRepo = repoNames[0];
          }
        }
      }

      // ─── AGENT 2: BRANCH SELECTOR ──────────────────────────
      const repoConfig = config.repos[matchedRepo] as RepoConfig;
      const validBranches = repoConfig.branches || ["develop"];
      let branch = validBranches[0]; // default
      let branchConfidence = repoResult.confidence;
      let branchReason = repoResult.reason;

      if (validBranches.length > 1) {
        const branchDetails = repoBranchDetails[matchedRepo] || "";

        const branchPrompt = `You are Agent 2: the BRANCH SELECTOR. Your ONLY job is to pick the correct source branch.

TASK: Which branch should this ticket create a feature branch FROM?

CONTEXT: Agent 1 already decided this ticket belongs in the "${matchedRepo}" repository.
Agent 1 reasoning: ${repoResult.reason}

RULES:
- The branch you pick is the SOURCE branch — the developer will create a new feature branch from it
- STUDY THE FILE TREE PER BRANCH: Look at which files exist on each branch. If a branch has files directly related to this ticket's domain (API routes, services, components), that's the one.
- Look at commit messages: if a branch has commits related to this ticket's features, that's the one
- Look at file diffs: if a branch has files that would need to be modified for this ticket, that's the one
- If a feature branch has active work related to this ticket's domain, prefer it over develop/main
- If no branch clearly owns this work, prefer the default integration branch (develop or main)

TICKET:
  ID: ${ticket.id}
  Summary: ${ticket.summary || "(no summary)"}
  Full Description:
${ticket.rawContent || "(no description)"}

BRANCH DETAILS FOR "${matchedRepo}" (includes file trees per branch — use these as evidence):
${branchDetails}

Available branches: ${validBranches.map((b) => `"${b}"`).join(", ")}

Return a JSON object with:
- "branch": the source branch (MUST be one of: ${validBranches.map((b) => `"${b}"`).join(", ")})
- "confidence": 0-100
- "reason": a DETAILED paragraph (3-5 sentences) explaining your reasoning. Cite specific file paths or commit messages from the branch details as evidence. Explain why this branch is more relevant than the other(s) for this ticket.

Return ONLY the JSON object.`;

        const branchText = await callLLM(provider, branchPrompt);
        try {
          const branchResult = extractJSON<{
            branch: string;
            confidence: number;
            reason: string;
          }>(branchText);
          branch = validBranches.includes(branchResult.branch)
            ? branchResult.branch
            : validBranches[0];
          branchConfidence = branchResult.confidence;
          branchReason = `Repo: ${repoResult.reason} | Branch: ${branchResult.reason}`;
        } catch {
          console.log(
            chalk.yellow(
              `   ⚠️  ${ticket.id}: Agent 2 returned invalid JSON, using default branch`,
            ),
          );
        }
      }

      // Apply routing
      ticket.targetRepo = matchedRepo;
      ticket.sourceBranch = branch;

      // Combined confidence (average of both agents, weighted toward repo)
      const score = Math.max(
        0,
        Math.min(100, Math.round(branchConfidence || 50)),
      );
      const scoreColor =
        score >= 80 ? chalk.green : score >= 50 ? chalk.yellow : chalk.red;

      console.log(
        `   🧠 ${chalk.white.bold(ticket.id)} → ${chalk.cyan(matchedRepo)} / ${chalk.white(branch)} ${scoreColor(`${score}/100`)} — ${chalk.gray(branchReason)}`,
      );

      routed.push(ticket);
    } catch (err) {
      console.log(
        chalk.yellow(
          `   ⚠️  ${ticket.id}: routing failed (${err instanceof Error ? err.message : err}), using first repo`,
        ),
      );
      routed.push(ticket);
    }
  }

  console.log("");
  return routed;
}
