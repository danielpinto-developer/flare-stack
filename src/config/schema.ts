/**
 * FLARE STACK — Configuration Schema
 *
 * Zod-validated configuration for the Parallel Reality OS.
 * Supports GCP-native stacks (Cloud Run, BigQuery, Postgres) and Gemini 3 via Google AI Studio.
 * and is extensible for any team's architecture.
 */
import { z } from "zod";

// ─── Repo Configuration ───────────────────────────────────────
export const RepoStackSchema = z.enum([
  "react-node", // React SPA + Express/Sequelize
  "python-fastapi", // Python + FastAPI + SQLAlchemy
  "next-node", // Next.js monolith
  "vue-node", // Vue + Express
  "custom", // Anything else
]);

export const RepoConfigSchema = z.object({
  path: z.string().describe("Absolute path to the repo root"),
  branches: z
    .array(z.string())
    .default(["develop"])
    .describe(
      "Active branches for this repo (used by LLM for routing + branch selection)",
    ),
  codeReviewPrompt: z
    .string()
    .optional()
    .describe("Path to repo-specific code review prompt"),
  stack: RepoStackSchema.default("custom"),
  ports: z
    .record(z.string(), z.number())
    .optional()
    .describe("Named port mappings"),
  startCommand: z
    .string()
    .optional()
    .describe("Command to start the dev server"),
  testCommand: z.string().optional().describe("Command to run tests"),
});

// ─── Jira Configuration ──────────────────────────────────────
export const JiraSourceSchema = z.literal("mcp");

export const McpServerConfigSchema = z
  .object({
    command: z.string().default("npx"),
    args: z
      .array(z.string())
      .default(["-y", "mcp-remote", "https://mcp.atlassian.com/v1/sse"]),
    env: z.record(z.string(), z.string()).optional(),
  })
  .default({
    command: "npx",
    args: ["-y", "mcp-remote", "https://mcp.atlassian.com/v1/sse"],
  });

export const JiraConfigSchema = z
  .object({
    cloudId: z.string().optional(),
    siteUrl: z.string().default(""),
    projectKeys: z.array(z.string()).default([]),
    queueStatus: z.string().default("Dev Review"),
    // Estimation settings
    estimation: z
      .object({
        pointsPerHour: z.number().default(4),
        maxPointsPerTicket: z.number().optional().default(8),
        buffers: z
          .object({
            ui: z.number().default(1),
            fullStack: z.number().default(1),
          })
          .default({}),
      })
      .default({}),
    ticketPrefix: z.string().default(""),
    source: JiraSourceSchema.default("mcp"),
    mcpServer: McpServerConfigSchema,
    autoComment: z.boolean().default(false),
    autoTransition: z.boolean().default(true),
  })
  .default({
    projectKeys: [],
    ticketPrefix: "",
    source: "mcp",
    mcpServer: {
      command: "npx",
      args: ["-y", "mcp-remote", "https://mcp.atlassian.com/v1/sse"],
    },
    autoComment: false,
    autoTransition: false,
  });

// ─── Model Configuration ─────────────────────────────────────
export const ModelProviderSchema = z.enum([
  "google",
  "anthropic",
  "openai",
  "local",
]);
export const ModelTierSchema = z.enum(["flash", "low", "high", "auto"]);

export const ModelPhaseConfigSchema = z.object({
  provider: ModelProviderSchema.default("google"),
  model: z.string().default("gemini-3-flash-preview"),
  tier: ModelTierSchema.default("low"),
  temperature: z.number().min(0).max(2).default(0.1),
  maxTokens: z.number().optional(),
});

export const ModelsConfigSchema = z
  .object({
    planning: ModelPhaseConfigSchema.default({
      provider: "google",
      model: "gemini-3-flash-preview",
      tier: "flash",
      temperature: 0.1,
    }),
    verification: ModelPhaseConfigSchema.default({
      provider: "google",
      model: "gemini-3-pro-preview",
      tier: "low",
      temperature: 0,
    }),
    implementation: ModelPhaseConfigSchema.default({
      provider: "google",
      model: "gemini-3-pro-preview",
      tier: "high",
      temperature: 0.1,
    }),
    scanning: ModelPhaseConfigSchema.default({
      provider: "google",
      model: "gemini-3-flash-preview",
      tier: "flash",
      temperature: 0.1,
    }),
    audit: ModelPhaseConfigSchema.default({
      provider: "google",
      model: "gemini-3-pro-preview",
      tier: "high",
      temperature: 0,
    }),
    forging: ModelPhaseConfigSchema.default({
      provider: "google",
      model: "gemini-3-pro-preview",
      tier: "high",
      temperature: 0.1,
    }),
  })
  .default({
    planning: {
      provider: "google",
      model: "gemini-3-flash-preview",
      tier: "flash",
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
  });

// ─── Prompt Configuration ────────────────────────────────────
export const PromptsConfigSchema = z
  .object({
    plan: z.string().default("1_PLAN.md"),
    verify: z.string().default("2_VERIFY.md"),
    implement: z.string().default("3_IMPLEMENT.md"),
    scan: z.string().default("5_SCAN.md"),
    audit: z.string().default("4_AUDIT.md"),
  })
  .default({
    plan: "1_PLAN.md",
    verify: "2_VERIFY.md",
    implement: "3_IMPLEMENT.md",
    scan: "5_SCAN.md",
    audit: "4_AUDIT.md",
  });

// ─── Proxy Router ────────────────────────────────────────────
export const ProxyConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    baseDomain: z.string().default("localhost"),
    port: z.number().default(9000),
  })
  .default({
    enabled: false,
    baseDomain: "localhost",
    port: 9000,
  });

// ─── Vision QA ───────────────────────────────────────────────
export const VisionQAConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    figmaToken: z.string().optional(),
    screenshotDir: z.string().default(".flare/screenshots"),
    diffThreshold: z.number().min(0).max(1).default(0.05),
  })
  .default({
    enabled: false,
    screenshotDir: ".flare/screenshots",
    diffThreshold: 0.05,
  });

// ─── Production Mirror (BigQuery) ───────────────────────────
export const BigQueryConfigSchema = z.object({
  projectId: z.string().optional(),
  dataset: z.string().default("production_logs"),
  table: z.string().default("requests"),
  windowMinutes: z.number().default(60),
});

export const ProductionMirrorConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    bigquery: BigQueryConfigSchema.optional(),
  })
  .default({
    enabled: false,
  });

// ─── Scavenger Bot Configuration ─────────────────────────────
export const ScavengerConfigSchema = z
  .object({
    blastRadiusDepth: z.number().min(1).max(10).default(5),
    maxFiles: z.number().min(1).max(50).default(20),
  })
  .default({
    blastRadiusDepth: 5,
    maxFiles: 20,
  });

// ─── Branch Naming ───────────────────────────────────────────
export const BranchingConfigSchema = z
  .object({
    pattern: z.string().default("feat/{ticketId}-{slug}"),
    slugSource: z
      .enum(["jira-summary", "manual", "ticketId-only"])
      .default("ticketId-only"),
  })
  .default({
    pattern: "feat/{ticketId}-{slug}",
    slugSource: "ticketId-only" as const,
  });

// ─── Observability (Sentry, Logging) ─────────────────────────
export const ObservabilityConfigSchema = z
  .object({
    sentry: z
      .object({
        dsn: z.string().optional(),
        environment: z.string().default("development"),
      })
      .optional(),
    logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .default({
    logLevel: "info" as const,
  });

// ─── Infrastructure Context ──────────────────────────────────
export const InfraConfigSchema = z
  .object({
    cloud: z.enum(["gcp", "aws", "azure", "none"]).default("gcp"),
    runtime: z
      .enum(["cloud-run", "vm", "k8s", "lambda", "local"])
      .default("cloud-run"),
    database: z
      .enum(["postgres", "mysql", "mongodb", "none"])
      .default("postgres"),
    ci: z
      .enum(["github-actions", "cloud-build", "gitlab-ci", "jenkins", "none"])
      .default("github-actions"),
  })
  .default({
    cloud: "gcp" as const,
    runtime: "cloud-run" as const,
    database: "postgres" as const,
    ci: "github-actions" as const,
  });

// ═══ THE MASTER CONFIG ═══════════════════════════════════════
export const FlareConfigSchema = z.object({
  project: z.string().optional().describe("Project name (optional)"),
  workspacesDir: z.string().default("./flare-chambers"),
  repos: z.record(z.string(), RepoConfigSchema),
  jira: JiraConfigSchema,
  models: ModelsConfigSchema,
  prompts: PromptsConfigSchema,
  proxy: ProxyConfigSchema,
  visionQA: VisionQAConfigSchema,
  productionMirror: ProductionMirrorConfigSchema,
  scavenger: ScavengerConfigSchema,
  branching: BranchingConfigSchema,
  observability: ObservabilityConfigSchema,
  infra: InfraConfigSchema,
});

// ─── Type Exports ────────────────────────────────────────────
export type FlareConfig = z.infer<typeof FlareConfigSchema>;
export type RepoConfig = z.infer<typeof RepoConfigSchema>;
export type ModelPhaseConfig = z.infer<typeof ModelPhaseConfigSchema>;
export type JiraConfig = z.infer<typeof JiraConfigSchema>;
