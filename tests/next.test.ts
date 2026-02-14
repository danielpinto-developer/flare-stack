/**
 * FLARE STACK — Next Command Tests
 *
 * Tests the auto-advance command structure.
 */

import { describe, it, expect } from "vitest";
import { nextCommand } from "../src/commands/next.js";

describe("Next Command", () => {
  it("should have correct name", () => {
    expect(nextCommand.name()).toBe("next");
  });

  it("should have descriptive description", () => {
    const desc = nextCommand.description();
    expect(desc).toContain("next");
  });

  it("should accept an optional ticketId argument", () => {
    const args = nextCommand.registeredArguments || [];
    expect(args.length).toBeGreaterThanOrEqual(1);
    expect(args[0].name()).toBe("ticketId");
    expect(args[0].required).toBe(false);
  });

  it("should have --repo option", () => {
    const repoOpt = nextCommand.options.find((o: any) => o.long === "--repo");
    expect(repoOpt).toBeDefined();
  });
});
