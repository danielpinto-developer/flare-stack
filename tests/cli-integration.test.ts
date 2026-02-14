/**
 * FLARE STACK — CLI Integration Tests
 *
 * Verifies all 20 commands respond to --help without errors.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { join } from "path";

const CLI = join(process.cwd(), "dist/cli.js");

const commands = [
  "init",
  "spawn",
  "destroy",
  "status",
  "greenlight",
  "plan",
  "verify",
  "implement",
  "audit",
  "next",
  "scan",
  "vision",
  "entropy",
  "proxy",
  "mirror",
  "shadow",
  "holodeck",
  "loom",
  "dashboard",
  "try",
];

describe("CLI — All Commands Respond to --help", () => {
  for (const cmd of commands) {
    it(`flare ${cmd} --help`, () => {
      const output = execSync(`node ${CLI} ${cmd} --help`, {
        encoding: "utf-8",
        timeout: 5000,
      });
      expect(output).toContain("Usage:");
      expect(output).toContain("-h, --help");
    });
  }

  it("flare --help shows all commands", () => {
    const output = execSync(`node ${CLI} --help`, {
      encoding: "utf-8",
      timeout: 5000,
    });
    for (const cmd of commands) {
      expect(output).toContain(cmd);
    }
  });

  it("flare --version", () => {
    const output = execSync(`node ${CLI} --version`, {
      encoding: "utf-8",
      timeout: 5000,
    });
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
