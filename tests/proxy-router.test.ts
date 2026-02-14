/**
 * FLARE STACK — Proxy Router Tests
 */

import { describe, it, expect } from "vitest";
import { printRouteTable } from "../src/core/proxy-router.js";

describe("Proxy Router", () => {
  it("printRouteTable should handle empty config gracefully", async () => {
    const config = {
      proxy: { enabled: true, port: 9000, baseDomain: "localhost" },
      repos: {},
      workspacesDir: "/tmp/nonexistent",
    } as any;

    // Should not throw even with no worktrees
    await expect(printRouteTable(config)).resolves.not.toThrow();
  });
});
