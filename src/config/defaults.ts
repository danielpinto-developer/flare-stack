/**
 * FLARE STACK — Default Configuration Presets
 *
 * GCP-optimized defaults and community defaults.
 * Any team can override via flare.config.ts.
 */
import type { FlareConfig } from "./schema.js";

/**
 * GCP-native preset — optimized for teams running on Google Cloud.
 * Override any values in your flare.config.ts.
 */
export const GCP_PRESET: Partial<FlareConfig> = {
  project: "my-project",
  workspacesDir: "./flare-chambers",
  repos: {
    "my-app": {
      path: "./my-app",
      branches: ["develop"],
      stack: "react-node",
      ports: { client: 3000, server: 3001 },
      startCommand: "npm run dev",
      testCommand: "npm test",
    },
  },
  jira: {
    siteUrl: "",
    projectKeys: [],
    queueStatus: "Dev Review",
    ticketPrefix: "",
    source: "mcp",
    mcpServer: {
      command: "npx",
      args: ["-y", "mcp-remote", "https://mcp.atlassian.com/v1/sse"],
    },
    autoComment: false,
    autoTransition: true,
    estimation: {
      pointsPerHour: 4,
      maxPointsPerTicket: 8,
      buffers: { ui: 1, fullStack: 1 },
    },
  },
  models: {
    planning: {
      provider: "google",
      model: "gemini-3-flash-preview",
      tier: "low",
      temperature: 0.1,
    },
    verification: {
      provider: "google",
      model: "gemini-3-pro-preview",
      tier: "low",
      temperature: 0,
    },
    implementation: {
      provider: "google",
      model: "gemini-3-pro-preview",
      tier: "high",
      temperature: 0.1,
    },
    scanning: {
      provider: "google",
      model: "gemini-3-flash-preview",
      tier: "flash",
      temperature: 0.1,
    },
    audit: {
      provider: "google",
      model: "gemini-3-pro-preview",
      tier: "high",
      temperature: 0,
    },
    forging: {
      provider: "google",
      model: "gemini-3-pro-preview",
      tier: "high",
      temperature: 0.1,
    },
  },
  branching: {
    pattern: "feat/{ticketId}-{slug}",
    slugSource: "ticketId-only",
  },
  infra: {
    cloud: "gcp",
    runtime: "cloud-run",
    database: "postgres",
    ci: "github-actions",
  },
};

/**
 * Generic defaults for community users.
 * Minimal config — bring your own repos, models, and infra.
 */
export const COMMUNITY_DEFAULTS: Partial<FlareConfig> = {
  project: "my-project",
  workspacesDir: "./flare-chambers",
  repos: {},
  jira: {
    siteUrl: "",
    projectKeys: [],
    queueStatus: "Dev Review",
    ticketPrefix: "",
    source: "mcp",
    mcpServer: {
      command: "npx",
      args: ["-y", "mcp-remote", "https://mcp.atlassian.com/v1/sse"],
    },
    autoComment: false,
    autoTransition: true,
    estimation: {
      pointsPerHour: 4,
      maxPointsPerTicket: 8,
      buffers: { ui: 1, fullStack: 1 },
    },
  },
  models: {
    planning: {
      provider: "google",
      model: "gemini-3-flash-preview",
      tier: "low",
      temperature: 0.1,
    },
    verification: {
      provider: "google",
      model: "gemini-3-pro-preview",
      tier: "low",
      temperature: 0,
    },
    implementation: {
      provider: "google",
      model: "gemini-3-pro-preview",
      tier: "high",
      temperature: 0.1,
    },
    scanning: {
      provider: "google",
      model: "gemini-3-flash-preview",
      tier: "flash",
      temperature: 0.1,
    },
    audit: {
      provider: "google",
      model: "gemini-3-pro-preview",
      tier: "high",
      temperature: 0,
    },
    forging: {
      provider: "google",
      model: "gemini-3-pro-preview",
      tier: "high",
      temperature: 0.1,
    },
  },
  infra: {
    cloud: "none",
    runtime: "local",
    database: "none",
    ci: "github-actions",
  },
};
