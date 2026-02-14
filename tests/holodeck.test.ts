/**
 * FLARE STACK — Holodeck Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  freezeContext,
  restoreContext,
  listContexts,
} from "../src/core/holodeck.js";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

describe("Context Holodeck", () => {
  const testDir = join(tmpdir(), "flare-holodeck-test-" + Date.now());
  const workspacesDir = join(testDir, "workspaces");
  const repoDir = join(testDir, "test-repo");

  const makeConfig = () =>
    ({
      workspacesDir,
      repos: {
        "test-repo": {
          path: repoDir,
          branches: ["main"],
        },
      },
    }) as any;

  beforeEach(() => {
    mkdirSync(workspacesDir, { recursive: true });
    mkdirSync(repoDir, { recursive: true });
    // Init a git repo
    execSync(
      'git init && git -c user.name="CI" -c user.email="ci@test" commit --allow-empty -m init',
      {
        cwd: repoDir,
        stdio: "pipe",
      },
    );
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("listContexts should return empty array when no contexts saved", () => {
    const contexts = listContexts(makeConfig());
    expect(contexts).toEqual([]);
  });

  it("freezeContext should create a state file", async () => {
    // Create a mock worktree directory
    const worktreeDir = join(workspacesDir, "PROJ-001", "test-repo");
    mkdirSync(worktreeDir, { recursive: true });

    // Init git in worktree
    execSync(
      'git init && git checkout -b feat/PROJ-001 && git -c user.name="CI" -c user.email="ci@test" commit --allow-empty -m test',
      {
        cwd: worktreeDir,
        stdio: "pipe",
      },
    );

    await freezeContext("PROJ-001", makeConfig());

    // Should have saved context
    const contexts = listContexts(makeConfig());
    expect(contexts.length).toBe(1);
    expect(contexts[0].ticketId).toBe("PROJ-001");
  });
});
