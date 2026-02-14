/**
 * FLARE STACK — Model Router Tests
 */
import { describe, it, expect } from "vitest";
import {
  selectModel,
  getFullPipelineModels,
  type WorkflowPhase,
} from "../src/core/model-router.js";
import { FlareConfigSchema } from "../src/config/schema.js";

const baseConfig = FlareConfigSchema.parse({
  project: "test",
  repos: { app: { path: "/tmp/app" } },
});

describe("selectModel", () => {
  it("returns correct model for planning phase", () => {
    const result = selectModel("planning", baseConfig);
    expect(result.provider).toBe("google");
    expect(result.model).toBe("gemini-3-flash-preview");
    expect(result.tier).toBe("flash");
    expect(result.temperature).toBe(0.1);
    expect(result.display).toContain("google");
  });

  it("returns correct model for verification phase", () => {
    const result = selectModel("verification", baseConfig);
    expect(result.model).toBe("gemini-3-pro-preview");
    expect(result.temperature).toBe(0);
    expect(result.tier).toBe("low");
  });

  it("returns correct model for implementation phase", () => {
    const result = selectModel("implementation", baseConfig);
    expect(result.model).toBe("gemini-3-pro-preview");
    expect(result.tier).toBe("high");
    expect(result.temperature).toBe(0.1);
  });

  it("returns correct model for audit phase", () => {
    const result = selectModel("audit", baseConfig);
    expect(result.model).toBe("gemini-3-pro-preview");
    expect(result.tier).toBe("high");
    expect(result.temperature).toBe(0);
  });

  it("display string includes provider and model", () => {
    const result = selectModel("planning", baseConfig);
    expect(result.display).toBe("google/gemini-3-flash-preview (flash)");
  });
});

describe("getFullPipelineModels", () => {
  it("returns all 6 phases", () => {
    const result = getFullPipelineModels(baseConfig);
    expect(Object.keys(result)).toEqual([
      "planning",
      "verification",
      "implementation",
      "forging",
      "scanning",
      "audit",
    ]);
  });

  it("planning uses flash tier, verification uses low tier", () => {
    const result = getFullPipelineModels(baseConfig);
    expect(result.planning.tier).toBe("flash");
    expect(result.verification.tier).toBe("low");
  });

  it("implementation and audit use high tier", () => {
    const result = getFullPipelineModels(baseConfig);
    expect(result.implementation.tier).toBe("high");
    expect(result.audit.tier).toBe("high");
  });

  it("respects custom overrides", () => {
    const custom = FlareConfigSchema.parse({
      project: "test",
      repos: { app: { path: "/tmp/app" } },
      models: {
        planning: {
          provider: "anthropic",
          model: "claude-4-sonnet",
          tier: "high",
          temperature: 0.5,
        },
        verification: {
          provider: "google",
          model: "gemini-3-pro-preview",
          tier: "low",
          temperature: 0,
        },
        implementation: {
          provider: "openai",
          model: "o3",
          tier: "high",
          temperature: 0.1,
        },
        audit: {
          provider: "google",
          model: "gemini-3-pro-preview",
          tier: "high",
          temperature: 0,
        },
      },
    });
    const result = getFullPipelineModels(custom);
    expect(result.planning.provider).toBe("anthropic");
    expect(result.planning.model).toBe("claude-4-sonnet");
    expect(result.implementation.provider).toBe("openai");
  });
});
