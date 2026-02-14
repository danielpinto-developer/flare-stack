/**
 * FLARE STACK — Worktree Manager
 *
 * Git Worktree CRUD operations using simple-git.
 * Creates isolated "Realities" (worktrees) for every active ticket.
 *
 * Zero-Latency Context Switching: We do NOT switch branches.
 * We create parallel folder universes.
 */

import simpleGit, { type SimpleGit } from "simple-git";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import chalk from "chalk";
import type { FlareConfig, RepoConfig } from "../config/schema.js";
import type { Ticket } from "../sources/types.js";

export interface WorktreeResult {
  ticketId: string;
  worktreePath: string;
  branchName: string;
  success: boolean;
  error?: string;
}

/**
 * Create a Git Worktree for a ticket in the target repo.
 */
export async function createWorktree(
  ticket: Ticket,
  config: FlareConfig,
): Promise<WorktreeResult> {
  const repoConfig = config.repos[ticket.targetRepo];

  if (!repoConfig) {
    return {
      ticketId: ticket.id,
      worktreePath: "",
      branchName: "",
      success: false,
      error: `Repo '${ticket.targetRepo}' not found in flare.config.ts repos map`,
    };
  }

  const worktreePath = `${config.workspacesDir}/${ticket.id}`;
  const branchName = generateBranchName(ticket, config);

  // 1. Ensure workspace directory exists
  if (!existsSync(config.workspacesDir)) {
    await mkdir(config.workspacesDir, { recursive: true });
  }

  // 2. Check if worktree already exists
  if (existsSync(worktreePath)) {
    console.log(
      chalk.yellow(`   ⚠️  Worktree already exists: ${worktreePath}`),
    );
    return {
      ticketId: ticket.id,
      worktreePath,
      branchName,
      success: true,
    };
  }

  // 3. Prune stale worktree registrations, then create new worktree
  const git: SimpleGit = simpleGit(repoConfig.path);

  try {
    // Clean up stale registrations from previous runs
    await git.raw(["worktree", "prune"]);

    console.log(chalk.cyan(`   🌀 Spawning Reality (Worktree)...`));

    // Try creating a new branch from source
    try {
      await git.raw([
        "worktree",
        "add",
        "-b",
        branchName,
        worktreePath,
        ticket.sourceBranch,
      ]);
    } catch {
      // Branch may already exist — try without -b
      try {
        await git.raw(["worktree", "add", worktreePath, branchName]);
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }

    console.log(chalk.green(`   ✅ Reality Created: ${worktreePath}`));
    return {
      ticketId: ticket.id,
      worktreePath,
      branchName,
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`   ❌ Failed to create worktree: ${message}`));
    return {
      ticketId: ticket.id,
      worktreePath,
      branchName,
      success: false,
      error: message,
    };
  }
}

/**
 * Destroy a worktree for a ticket — remove folder, delete matching branches, and prune.
 * Scans for branches containing the ticket ID (e.g., feat/PROJ-001-slug).
 */
export async function destroyWorktree(
  ticketId: string,
  config: FlareConfig,
): Promise<void> {
  const worktreePath = `${config.workspacesDir}/${ticketId}`;

  // Find all repos with worktrees for this ticket
  for (const [repoName, repoConfig] of Object.entries(config.repos)) {
    if (!existsSync(worktreePath)) continue;

    const git: SimpleGit = simpleGit(repoConfig.path);

    try {
      // Remove worktree
      await git.raw(["worktree", "remove", worktreePath, "--force"]);
      console.log(chalk.green(`   ✅ Removed worktree: ${worktreePath}`));

      // Find and delete branches containing the ticket ID
      const branchOutput = await git.branch(["-l"]);
      const matchingBranches = branchOutput.all.filter((b) =>
        b.includes(ticketId),
      );

      for (const branch of matchingBranches) {
        try {
          await git.branch(["-D", branch]);
          console.log(chalk.green(`   ✅ Deleted branch: ${branch}`));
        } catch {
          // Branch may be in use — that's fine
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`   ❌ Failed to remove worktree: ${message}`));
    }
  }

  // Prune stale worktrees in all repos
  for (const [, repoConfig] of Object.entries(config.repos)) {
    const git: SimpleGit = simpleGit(repoConfig.path);
    try {
      await git.raw(["worktree", "prune"]);
    } catch {
      // Prune failure is non-critical
    }
  }
}

/**
 * Destroy ALL worktrees and clean the workspaces directory.
 */
export async function destroyAllWorktrees(config: FlareConfig): Promise<void> {
  if (!existsSync(config.workspacesDir)) {
    console.log(chalk.yellow("⚠️  No workspaces directory found."));
    return;
  }

  const { readdirSync, rmSync } = await import("fs");
  const entries = readdirSync(config.workspacesDir);

  for (const entry of entries) {
    await destroyWorktree(entry, config);
  }

  // Remove the workspaces directory itself
  rmSync(config.workspacesDir, { recursive: true, force: true });
  console.log(chalk.green(`✅ Clean slate. Removed ${config.workspacesDir}`));
}

/**
 * List all active worktrees across all repos.
 */
export async function listWorktrees(
  config: FlareConfig,
): Promise<{ repo: string; path: string; branch: string }[]> {
  const results: { repo: string; path: string; branch: string }[] = [];

  for (const [repoName, repoConfig] of Object.entries(config.repos)) {
    const git: SimpleGit = simpleGit(repoConfig.path);

    try {
      const output = await git.raw(["worktree", "list", "--porcelain"]);
      const worktrees = parseWorktreeList(output, repoName);
      results.push(...worktrees);
    } catch {
      // Repo may not exist locally
    }
  }

  return results;
}

/**
 * Parse `git worktree list --porcelain` output.
 */
function parseWorktreeList(
  output: string,
  repoName: string,
): { repo: string; path: string; branch: string }[] {
  const results: { repo: string; path: string; branch: string }[] = [];
  const blocks = output.split("\n\n").filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n");
    let path = "";
    let branch = "";

    for (const line of lines) {
      if (line.startsWith("worktree ")) path = line.replace("worktree ", "");
      if (line.startsWith("branch "))
        branch = line.replace("branch refs/heads/", "");
    }

    if (path && branch) {
      results.push({ repo: repoName, path, branch });
    }
  }

  return results;
}

/**
 * Generate a branch name from the config pattern.
 */
function generateBranchName(ticket: Ticket, config: FlareConfig): string {
  const pattern = config.branching.pattern;
  const slug = ticket.summary
    ? ticket.summary
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40)
    : ticket.id.toLowerCase();

  return pattern.replace("{ticketId}", ticket.id).replace("{slug}", slug);
}
