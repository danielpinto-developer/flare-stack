/**
 * FLARE STACK — Public API Exports Test
 *
 * Verifies all documented exports are accessible.
 */

import { describe, it, expect } from "vitest";

describe("Public API — index.ts exports", () => {
  it("should export all config items", async () => {
    const mod = await import("../src/index.js");
    expect(mod.FlareConfigSchema).toBeDefined();
    expect(mod.loadConfig).toBeTypeOf("function");
    expect(mod.clearConfigCache).toBeTypeOf("function");
    expect(mod.GCP_PRESET).toBeDefined();
    expect(mod.COMMUNITY_DEFAULTS).toBeDefined();
    expect(mod.defineConfig).toBeTypeOf("function");
  });

  it("should export worktree functions", async () => {
    const mod = await import("../src/index.js");
    expect(mod.createWorktree).toBeTypeOf("function");
    expect(mod.destroyWorktree).toBeTypeOf("function");
    expect(mod.destroyAllWorktrees).toBeTypeOf("function");
    expect(mod.listWorktrees).toBeTypeOf("function");
  });

  it("should export AI execution functions", async () => {
    const mod = await import("../src/index.js");
    expect(mod.executePrompt).toBeTypeOf("function");
    expect(mod.logAIResponse).toBeTypeOf("function");
  });

  it("should export model router functions", async () => {
    const mod = await import("../src/index.js");
    expect(mod.selectModel).toBeTypeOf("function");
    expect(mod.logModelSelection).toBeTypeOf("function");
    expect(mod.getFullPipelineModels).toBeTypeOf("function");
  });

  it("should export source classes", async () => {
    const mod = await import("../src/index.js");
    expect(mod.JiraMcpSource).toBeDefined();
  });

  it("should export quality functions", async () => {
    const mod = await import("../src/index.js");
    expect(mod.runScavengerBot).toBeTypeOf("function");
    expect(mod.printScavengerReport).toBeTypeOf("function");
    expect(mod.captureScreenshots).toBeTypeOf("function");
    expect(mod.runVisionQA).toBeTypeOf("function");
    expect(mod.printVisionReport).toBeTypeOf("function");
    expect(mod.runEntropyHunter).toBeTypeOf("function");
    expect(mod.generateMutations).toBeTypeOf("function");
    expect(mod.printEntropyReport).toBeTypeOf("function");
  });

  it("should export infrastructure functions", async () => {
    const mod = await import("../src/index.js");
    expect(mod.startProxyRouter).toBeTypeOf("function");
    expect(mod.printRouteTable).toBeTypeOf("function");
    expect(mod.freezeContext).toBeTypeOf("function");
    expect(mod.restoreContext).toBeTypeOf("function");
    expect(mod.listContexts).toBeTypeOf("function");
    expect(mod.queryProductionLogs).toBeTypeOf("function");
    expect(mod.printMirrorReport).toBeTypeOf("function");
    expect(mod.injectPrompts).toBeTypeOf("function");
  });

  it("should export extras", async () => {
    const mod = await import("../src/index.js");
    expect(mod.runShadowLoad).toBeTypeOf("function");
    expect(mod.printLoadTestReport).toBeTypeOf("function");
    expect(mod.runLoomGenerator).toBeTypeOf("function");
    expect(mod.recordLoomVideo).toBeTypeOf("function");
    expect(mod.uploadToLoom).toBeTypeOf("function");
    expect(mod.generateDemoReport).toBeTypeOf("function");
    expect(mod.printLoomReport).toBeTypeOf("function");
  });

  it("should export dashboard functions", async () => {
    const mod = await import("../src/index.js");
    expect(mod.launchDashboard).toBeTypeOf("function");
    expect(mod.printChalkStatus).toBeTypeOf("function");
  });
});
