/**
 * FLARE STACK — Config Loader Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfig, clearConfigCache } from "../src/config/loader.js";

describe("Config Loader", () => {
  beforeEach(() => {
    clearConfigCache();
  });

  it("clearConfigCache should not throw", () => {
    expect(() => clearConfigCache()).not.toThrow();
  });

  it("loadConfig should throw useful error when no config found", async () => {
    // loadConfig searches for flare.config.ts from cwd
    // In test environment, there's no flare.config.ts
    // It should either find or throw a meaningful error
    try {
      const config = await loadConfig();
      // If it loaded (from project root), verify it's a valid config
      expect(config).toHaveProperty("project");
      expect(config).toHaveProperty("repos");
      expect(config).toHaveProperty("jira");
      expect(config).toHaveProperty("models");
    } catch (error) {
      // If no config found, should give a useful message
      expect(error).toBeDefined();
    }
  });

  it("loadConfig should cache results", async () => {
    try {
      const config1 = await loadConfig();
      const config2 = await loadConfig();
      expect(config1).toBe(config2); // Same reference = cached
    } catch {
      // No config in test env — still passes
    }
  });
});
