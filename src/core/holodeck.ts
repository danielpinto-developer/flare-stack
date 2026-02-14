/**
 * FLARE STACK — Context Holodeck
 *
 * Saves and restores the full working environment state for a ticket:
 *   - Open terminal commands
 *   - Environment variables
 *   - Active ports
 *   - Git branch state
 *   - Running dev servers
 *
 * When you switch between tickets, the holodeck freezes your current context
 * and restores it when you come back.
 *
 * State is saved as JSON in `.flare/holodeck/<ticketId>.json`
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import type { FlareConfig } from "../config/schema.js";

export interface HolodeckState {
  ticketId: string;
  repo: string;
  worktreePath: string;
  branch: string;
  savedAt: string;
  environment: Record<string, string>;
  runningPorts: number[];
  gitStatus: string;
  lastCommit: string;
  notes: string;
}

const HOLODECK_DIR = ".flare/holodeck";

/**
 * Freeze the current context for a ticket.
 */
export async function freezeContext(
  ticketId: string,
  config: FlareConfig,
): Promise<HolodeckState> {
  const holoDir = join(config.workspacesDir, "..", HOLODECK_DIR);
  mkdirSync(holoDir, { recursive: true });

  const targetRepo = Object.keys(config.repos)[0];
  const worktreePath = join(config.workspacesDir, ticketId);

  // Capture git state
  let branch = "";
  let gitStatus = "";
  let lastCommit = "";

  if (existsSync(worktreePath)) {
    try {
      branch = execSync("git branch --show-current", {
        cwd: worktreePath,
        encoding: "utf-8",
      }).trim();
      gitStatus = execSync("git status --short", {
        cwd: worktreePath,
        encoding: "utf-8",
      }).trim();
      lastCommit = execSync("git log -1 --oneline", {
        cwd: worktreePath,
        encoding: "utf-8",
      }).trim();
    } catch {
      // Not a git dir
    }
  }

  // Capture relevant env vars
  const relevantEnvKeys = [
    "NODE_ENV",
    "PORT",
    "DATABASE_URL",
    "GOOGLE_CLOUD_PROJECT",
    "API_URL",
    "REACT_APP_API_URL",
    "VITE_API_URL",
  ];
  const environment: Record<string, string> = {};
  for (const key of relevantEnvKeys) {
    if (process.env[key]) {
      environment[key] = process.env[key]!;
    }
  }

  // Detect running ports
  const runningPorts = detectRunningPorts(config, targetRepo);

  const state: HolodeckState = {
    ticketId,
    repo: targetRepo,
    worktreePath,
    branch,
    savedAt: new Date().toISOString(),
    environment,
    runningPorts,
    gitStatus,
    lastCommit,
    notes: "",
  };

  const statePath = join(holoDir, `${ticketId}.json`);
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  console.log(chalk.cyan(`   💾 Context frozen for ${ticketId}`));
  console.log(chalk.gray(`      Branch: ${branch}`));
  console.log(chalk.gray(`      Status: ${gitStatus || "clean"}`));
  console.log(chalk.gray(`      Last commit: ${lastCommit}`));
  console.log(chalk.gray(`      Saved to: ${statePath}`));

  return state;
}

/**
 * Restore the context for a ticket.
 */
export async function restoreContext(
  ticketId: string,
  config: FlareConfig,
): Promise<HolodeckState | null> {
  const holoDir = join(config.workspacesDir, "..", HOLODECK_DIR);
  const statePath = join(holoDir, `${ticketId}.json`);

  if (!existsSync(statePath)) {
    console.log(chalk.yellow(`   ⚠️  No saved context for ${ticketId}`));
    return null;
  }

  const state: HolodeckState = JSON.parse(readFileSync(statePath, "utf-8"));

  console.log(
    chalk.cyan.bold(`\n🎭 FLARE STACK — Restoring Context: ${ticketId}\n`),
  );
  console.log(chalk.white(`   Worktree: ${state.worktreePath}`));
  console.log(chalk.white(`   Branch: ${state.branch}`));
  console.log(chalk.white(`   Last saved: ${state.savedAt}`));
  console.log(chalk.white(`   Last commit: ${state.lastCommit}`));

  if (state.gitStatus) {
    console.log(chalk.yellow(`\n   ⚠️  Uncommitted changes when frozen:`));
    for (const line of state.gitStatus.split("\n")) {
      console.log(chalk.gray(`      ${line}`));
    }
  }

  if (state.runningPorts.length > 0) {
    console.log(chalk.yellow(`\n   ⚠️  These ports were in use when frozen:`));
    for (const port of state.runningPorts) {
      console.log(chalk.gray(`      :${port}`));
    }
  }

  if (Object.keys(state.environment).length > 0) {
    console.log(chalk.cyan(`\n   📋 Saved environment:`));
    for (const [key, value] of Object.entries(state.environment)) {
      console.log(chalk.gray(`      ${key}=${value}`));
    }
  }

  // Check current git status of the worktree
  if (existsSync(state.worktreePath)) {
    try {
      const currentBranch = execSync("git branch --show-current", {
        cwd: state.worktreePath,
        encoding: "utf-8",
      }).trim();
      const currentStatus = execSync("git status --short", {
        cwd: state.worktreePath,
        encoding: "utf-8",
      }).trim();
      const currentCommit = execSync("git log -1 --oneline", {
        cwd: state.worktreePath,
        encoding: "utf-8",
      }).trim();

      console.log(chalk.cyan(`\n   📊 Current state:`));
      console.log(chalk.gray(`      Branch: ${currentBranch}`));
      console.log(chalk.gray(`      Status: ${currentStatus || "clean"}`));
      console.log(chalk.gray(`      Latest: ${currentCommit}`));
    } catch {
      // Not a valid git worktree anymore
      console.log(
        chalk.red(
          `\n   ⚠️  Worktree no longer exists. Run flare ignite ${ticketId}`,
        ),
      );
    }
  }

  const repoConfig = config.repos[state.repo];
  if (repoConfig) {
    console.log(chalk.green(`\n   🚀 To resume work:`));
    console.log(chalk.gray(`      cd ${state.worktreePath}`));
    if (repoConfig.startCommand) {
      console.log(chalk.gray(`      ${repoConfig.startCommand}`));
    }
  }

  console.log("");
  return state;
}

/**
 * List all saved holodeck states.
 */
export function listContexts(config: FlareConfig): HolodeckState[] {
  const holoDir = join(config.workspacesDir, "..", HOLODECK_DIR);

  if (!existsSync(holoDir)) return [];

  const files = readdirSync(holoDir).filter((f: string) => f.endsWith(".json"));

  return files.map((f: string) => {
    const content = readFileSync(join(holoDir, f), "utf-8");
    return JSON.parse(content) as HolodeckState;
  });
}

/**
 * Detect which ports from the repo config are currently in use.
 */
function detectRunningPorts(config: FlareConfig, repoName: string): number[] {
  const repoConfig = config.repos[repoName];
  if (!repoConfig?.ports) return [];

  const activePorts: number[] = [];

  for (const port of Object.values(repoConfig.ports)) {
    try {
      execSync(`lsof -i :${port} -t 2>/dev/null`, { encoding: "utf-8" });
      activePorts.push(port);
    } catch {
      // Port not in use
    }
  }

  return activePorts;
}
