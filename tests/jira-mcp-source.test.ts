/**
 * FLARE STACK — Jira MCP Source Tests
 */

import { describe, it, expect } from "vitest";
import { JiraMcpSource } from "../src/sources/jira-mcp-source.js";

describe("Jira MCP Source", () => {
  const makeConfig = () => ({
    command: "npx",
    args: ["-y", "mcp-remote", "https://mcp.atlassian.com/v1/sse"],
  });

  it("should create instance with full config", () => {
    const source = new JiraMcpSource(
      makeConfig(),
      "test-cloud-id",
      ["PROJ"],
      "test-repo",
      "main",
    );
    expect(source).toBeDefined();
    expect(source.name).toBe("jira-mcp");
  });

  it("should store name correctly", () => {
    const source = new JiraMcpSource(
      makeConfig(),
      "my-cloud-123",
      ["PROJ", "TEAM"],
      "frontend",
      "develop",
    );
    expect(source.name).toBe("jira-mcp");
  });

  it("should accept custom env vars in config", () => {
    const source = new JiraMcpSource(
      {
        command: "npx",
        args: ["-y", "mcp-remote", "https://mcp.atlassian.com/v1/sse"],
        env: { ATLASSIAN_TOKEN: "test-token" },
      },
      "cloud-id",
      ["PROJ"],
      "repo",
      "main",
    );
    expect(source).toBeDefined();
  });
});
