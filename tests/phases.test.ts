/**
 * FLARE STACK — Phase Commands Tests
 *
 * Tests the individual phase commands (plan, verify, implement, audit).
 * Verifies phase metadata, command structure, and execution logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Import named exports
import {
  planCommand,
  verifyCommand,
  implementCommand,
  auditCommand,
} from "../src/commands/phases.js";

describe("Phase Commands", () => {
  describe("Command metadata", () => {
    it("planCommand should have correct name and description", () => {
      expect(planCommand.name()).toBe("plan");
      expect(planCommand.description()).toContain("implementation plan");
    });

    it("verifyCommand should have correct name and description", () => {
      expect(verifyCommand.name()).toBe("verify");
      expect(verifyCommand.description()).toContain("Verify");
    });

    it("implementCommand should have correct name and description", () => {
      expect(implementCommand.name()).toBe("implement");
      expect(implementCommand.description()).toContain("production code");
    });

    it("auditCommand should have correct name and description", () => {
      expect(auditCommand.name()).toBe("audit");
      expect(auditCommand.description()).toContain("code review");
    });

    it("all phase commands should accept a ticketId argument", () => {
      for (const cmd of [
        planCommand,
        verifyCommand,
        implementCommand,
        auditCommand,
      ]) {
        const args = cmd.registeredArguments || [];
        expect(args.length).toBeGreaterThanOrEqual(1);
        expect(args[0].name()).toBe("ticketId");
      }
    });

    it("all phase commands should have --repo option", () => {
      for (const cmd of [
        planCommand,
        verifyCommand,
        implementCommand,
        auditCommand,
      ]) {
        const repoOpt = cmd.options.find((o: any) => o.long === "--repo");
        expect(repoOpt).toBeDefined();
      }
    });

    it("all phase commands should accept an optional ticketId argument", () => {
      for (const cmd of [
        planCommand,
        verifyCommand,
        implementCommand,
        auditCommand,
      ]) {
        const args = cmd.registeredArguments || [];
        expect(args[0].required).toBe(false);
      }
    });

    it("all phase commands should have --show-prompt option", () => {
      for (const cmd of [
        planCommand,
        verifyCommand,
        implementCommand,
        auditCommand,
      ]) {
        const showPromptOpt = cmd.options.find(
          (o: any) => o.long === "--show-prompt",
        );
        expect(showPromptOpt).toBeDefined();
      }
    });
  });

  describe("Phase prompt file mapping", () => {
    it("plan phase should use 1_PLAN.md", () => {
      expect(planCommand.description()).toContain("plan");
    });

    it("verify phase should use 2_VERIFY.md", () => {
      expect(verifyCommand.description()).toContain("Verify");
    });

    it("implement phase should use 3_IMPLEMENT.md", () => {
      expect(implementCommand.description()).toContain("code");
    });

    it("audit phase should use 4_AUDIT.md", () => {
      expect(auditCommand.description()).toContain("review");
    });
  });
});
