/**
 * FLARE STACK — Worktree Manager Tests
 */
import { describe, it, expect } from "vitest";
import { FlareConfigSchema } from "../src/config/schema.js";

const baseConfig = FlareConfigSchema.parse({
  project: "test",
  repos: {
    app: { path: "/tmp/test-repo" },
  },
  branching: {
    pattern: "feat/{ticketId}-{slug}",
    slugSource: "ticketId-only",
  },
});

describe("Worktree Manager — Integration-ready", () => {
  it("config supports multiple repos", () => {
    const config = FlareConfigSchema.parse({
      project: "test",
      repos: {
        frontend: { path: "/tmp/frontend", stack: "react-node" },
        backend: { path: "/tmp/backend", stack: "python-fastapi" },
        agents: { path: "/tmp/agents", stack: "python-fastapi" },
      },
    });
    expect(Object.keys(config.repos)).toHaveLength(3);
    expect(config.repos.frontend.stack).toBe("react-node");
    expect(config.repos.backend.stack).toBe("python-fastapi");
  });

  it("workspacesDir has correct default", () => {
    expect(baseConfig.workspacesDir).toBe("./flare-chambers");
  });

  it("branching pattern is correctly set", () => {
    expect(baseConfig.branching.pattern).toBe("feat/{ticketId}-{slug}");
    expect(baseConfig.branching.slugSource).toBe("ticketId-only");
  });

  it("repo branches defaults to [develop]", () => {
    expect(baseConfig.repos.app.branches).toEqual(["develop"]);
  });
});
