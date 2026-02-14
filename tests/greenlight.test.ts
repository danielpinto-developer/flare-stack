/**
 * FLARE STACK — Burn Command Tests
 *
 * Tests the full pipeline orchestration command.
 * Verifies command structure, options, and pipeline composition.
 */

import { describe, it, expect } from "vitest";
import { burnCommand } from "../src/commands/greenlight.js";

describe("Burn Command", () => {
  it("should have correct name", () => {
    expect(burnCommand.name()).toBe("burn");
  });

  it("should have descriptive description", () => {
    const desc = burnCommand.description();
    expect(desc.toLowerCase()).toContain("plan");
    expect(desc.toLowerCase()).toContain("implement");
    expect(desc.toLowerCase()).toContain("audit");
  });

  it("should accept a ticketId argument", () => {
    const args = burnCommand.registeredArguments || [];
    expect(args.length).toBeGreaterThanOrEqual(1);
    expect(args[0].name()).toBe("ticketId");
  });

  it("should have --repo option", () => {
    const repoOpt = burnCommand.options.find((o: any) => o.long === "--repo");
    expect(repoOpt).toBeDefined();
  });

  it("should have --dry-run option", () => {
    const dryRunOpt = burnCommand.options.find(
      (o: any) => o.long === "--dry-run",
    );
    expect(dryRunOpt).toBeDefined();
  });

  it("should have --restart option for pipeline reset", () => {
    const restartOpt = burnCommand.options.find(
      (o: any) => o.long === "--restart",
    );
    expect(restartOpt).toBeDefined();
  });

  it("should describe the combustion cycle in description", () => {
    const desc = burnCommand.description();
    expect(desc.toLowerCase()).toContain("plan");
    expect(desc.toLowerCase()).toContain("audit");
  });
});
