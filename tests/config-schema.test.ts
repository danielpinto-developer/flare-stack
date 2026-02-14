/**
 * FLARE STACK — Configuration Schema Tests
 */
import { describe, it, expect } from "vitest";
import {
  FlareConfigSchema,
  RepoConfigSchema,
  ModelPhaseConfigSchema,
} from "../src/config/schema.js";

describe("FlareConfigSchema", () => {
  it("validates a minimal config", () => {
    const config = {
      project: "test-project",
      repos: {
        app: { path: "/path/to/app" },
      },
    };
    const result = FlareConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("accepts config without project (project is optional)", () => {
    const config = {
      repos: {
        app: { path: "/path/to/app" },
      },
    };
    const result = FlareConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("rejects config without repos", () => {
    const config = {
      project: "test-project",
    };
    const result = FlareConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("applies default workspacesDir", () => {
    const config = {
      project: "test-project",
      repos: { app: { path: "/path" } },
    };
    const result = FlareConfigSchema.parse(config);
    expect(result.workspacesDir).toBe("./flare-chambers");
  });

  it("applies all default nested objects", () => {
    const config = {
      project: "test-project",
      repos: { app: { path: "/path" } },
    };
    const result = FlareConfigSchema.parse(config);
    expect(result.jira.source).toBe("mcp");
    expect(result.models.planning.provider).toBe("google");
    expect(result.prompts.plan).toBe("1_PLAN.md");
    expect(result.proxy.enabled).toBe(false);
    expect(result.visionQA.enabled).toBe(false);
    expect(result.productionMirror.enabled).toBe(false);
    expect(result.branching.slugSource).toBe("ticketId-only");
    expect(result.observability.logLevel).toBe("info");
    expect(result.infra.cloud).toBe("gcp");
    expect(result.infra.runtime).toBe("cloud-run");
    expect(result.infra.database).toBe("postgres");
    expect(result.infra.ci).toBe("github-actions");
  });

  it("allows overriding defaults", () => {
    const config = {
      project: "test-project",
      repos: { app: { path: "/path" } },
      infra: {
        cloud: "aws" as const,
        runtime: "lambda" as const,
        database: "mongodb" as const,
        ci: "gitlab-ci" as const,
      },
    };
    const result = FlareConfigSchema.parse(config);
    expect(result.infra.cloud).toBe("aws");
    expect(result.infra.runtime).toBe("lambda");
  });
});

describe("RepoConfigSchema", () => {
  it("validates repo with only path", () => {
    const result = RepoConfigSchema.safeParse({ path: "/path/to/repo" });
    expect(result.success).toBe(true);
    expect(result.data!.branches).toEqual(["develop"]);
    expect(result.data!.stack).toBe("custom");
  });

  it("validates full repo config", () => {
    const result = RepoConfigSchema.safeParse({
      path: "/path/to/repo",
      branches: ["main", "develop"],
      stack: "react-node",
      ports: { client: 3000, server: 3001 },
      startCommand: "npm run dev",
      testCommand: "npm test",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid stack", () => {
    const result = RepoConfigSchema.safeParse({
      path: "/path",
      stack: "invalid-stack",
    });
    expect(result.success).toBe(false);
  });
});

describe("ModelPhaseConfigSchema", () => {
  it("applies defaults", () => {
    const result = ModelPhaseConfigSchema.parse({});
    expect(result.provider).toBe("google");
    expect(result.model).toBe("gemini-3-flash-preview");
    expect(result.tier).toBe("low");
    expect(result.temperature).toBe(0.1);
  });

  it("rejects temperature out of range", () => {
    const result = ModelPhaseConfigSchema.safeParse({ temperature: 3 });
    expect(result.success).toBe(false);
  });

  it("allows all valid providers", () => {
    for (const provider of ["google", "anthropic", "openai", "local"]) {
      const result = ModelPhaseConfigSchema.safeParse({ provider });
      expect(result.success).toBe(true);
    }
  });
});
