/**
 * FLARE STACK — Prompt Injector Tests
 *
 * `injectPrompts(ticket: Ticket, worktreePath: string, config: FlareConfig)`
 * Ticket shape: { id, targetRepo, sourceBranch, rawContent, summary? }
 * config.prompts shape: { plan: "1_PLAN.md", verify: "2_VERIFY.md", implement: "3_IMPLEMENT.md", audit: "4_AUDIT.md" }
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { injectPrompts } from "../src/core/prompt-injector.js";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Prompt Injector", () => {
  const testDir = join(tmpdir(), "flare-stack-prompt-test-" + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  const makeTicket = (id: string) => ({
    id,
    targetRepo: "test-repo",
    sourceBranch: "main",
    rawContent: `# ${id}\nTitle: Test Ticket\nDescription: Test description`,
    summary: "Test Ticket",
  });

  const makeConfig = () =>
    ({
      repos: {
        "test-repo": {
          path: "/tmp/fake-repo",
          branches: ["main"],
        },
      },
      prompts: {
        plan: "1_PLAN.md",
        verify: "2_VERIFY.md",
        implement: "3_IMPLEMENT.md",
        audit: "4_AUDIT.md",
      },
      workspacesDir: join(testDir, "workspaces"),
    }) as any;

  it("should inject TICKET.md into worktree", async () => {
    const ticket = makeTicket("PROJ-001");
    await injectPrompts(ticket, testDir, makeConfig());

    const ticketPath = join(testDir, "TICKET.md");
    expect(existsSync(ticketPath)).toBe(true);

    const content = readFileSync(ticketPath, "utf-8");
    expect(content).toContain("PROJ-001");
    expect(content).toContain("Test Ticket");
  });

  it("should create prompt files", async () => {
    const ticket = makeTicket("PROJ-002");
    await injectPrompts(ticket, testDir, makeConfig());

    expect(existsSync(join(testDir, "1_PLAN.md"))).toBe(true);
    expect(existsSync(join(testDir, "2_VERIFY.md"))).toBe(true);
    expect(existsSync(join(testDir, "3_IMPLEMENT.md"))).toBe(true);
    expect(existsSync(join(testDir, "4_AUDIT.md"))).toBe(true);
  });

  it("should handle overwriting with new ticket", async () => {
    const ticket1 = makeTicket("PROJ-003");
    await injectPrompts(ticket1, testDir, makeConfig());

    const content1 = readFileSync(join(testDir, "TICKET.md"), "utf-8");
    expect(content1).toContain("PROJ-003");

    const ticket2 = makeTicket("PROJ-004");
    await injectPrompts(ticket2, testDir, makeConfig());

    const content2 = readFileSync(join(testDir, "TICKET.md"), "utf-8");
    expect(content2).toContain("PROJ-004");
  });
});
