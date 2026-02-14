/**
 * FLARE STACK — Public API
 *
 * Exports for programmatic usage and type imports.
 * `import { defineConfig, FlareConfig } from 'flare-stack';`
 */

export { FlareConfigSchema } from "./config/schema.js";
export type {
  FlareConfig,
  RepoConfig,
  ModelPhaseConfig,
  JiraConfig,
} from "./config/schema.js";

export { loadConfig, clearConfigCache } from "./config/loader.js";
export { GCP_PRESET, COMMUNITY_DEFAULTS } from "./config/defaults.js";

export {
  createWorktree,
  destroyWorktree,
  destroyAllWorktrees,
  listWorktrees,
} from "./core/worktree-manager.js";
export { injectPrompts, type InjectionResult } from "./core/prompt-injector.js";
export {
  selectModel,
  logModelSelection,
  getFullPipelineModels,
} from "./core/model-router.js";
export type { WorkflowPhase, ModelSelection } from "./core/model-router.js";
export { routeTickets } from "./core/ticket-router.js";

// AI Execution
export { executePrompt, logAIResponse } from "./core/ai-executor.js";
export type { AIResponse } from "./core/ai-executor.js";

// Pipeline State
export {
  loadPipelineState,
  savePipelineState,
  markPhaseStarted,
  markPhaseCompleted,
  getNextPhase,
  getRemainingPhases,
  isPipelineComplete,
} from "./core/pipeline-state.js";
export type { PipelineState } from "./core/pipeline-state.js";

// Sources
export { JiraMcpSource } from "./sources/jira-mcp-source.js";
export type { McpServerConfig } from "./sources/jira-mcp-source.js";

export type { Ticket, TicketSource } from "./sources/types.js";

// Quality
export {
  runScavengerBot,
  printScavengerReport,
  getChangedFiles,
  traceBlastRadius,
} from "./quality/scavenger.js";
export type { ScavengerFinding, ScavengerReport } from "./quality/scavenger.js";
export {
  captureScreenshots,
  runVisionQA,
  printVisionReport,
} from "./quality/vision-qa.js";
export type { VisionReport, DiffResult } from "./quality/vision-qa.js";

// Infrastructure
export {
  startProxyRouter,
  printRouteTable,
  type ProxyRouterResult,
} from "./core/proxy-router.js";
export {
  freezeContext,
  restoreContext,
  listContexts,
} from "./core/holodeck.js";
export type { HolodeckState } from "./core/holodeck.js";
export {
  queryProductionLogs,
  printMirrorReport,
} from "./core/production-mirror.js";
export type {
  AnomalyReport,
  ProductionPattern,
} from "./core/production-mirror.js";

// Entropy Hunter (mutation testing)
export {
  runEntropyHunter,
  generateMutations,
  printEntropyReport,
} from "./quality/entropy-hunter.js";
export type { EntropyReport, Mutation } from "./quality/entropy-hunter.js";

// Shadow Load Tester
export { runShadowLoad, printLoadTestReport } from "./extras/shadow-load.js";
export type { LoadTestConfig, LoadTestReport } from "./extras/shadow-load.js";

// Loom Generator
export {
  runLoomGenerator,
  recordLoomVideo,
  uploadToLoom,
  generateDemoReport,
  printLoomReport,
} from "./extras/loom-generator.js";
export type {
  DemoStep,
  DemoRecording,
  DemoReport,
} from "./extras/loom-generator.js";

// TTS Narrator
export { generateNarration } from "./extras/tts-narrator.js";
export type { NarrationScene, NarrationResult } from "./extras/tts-narrator.js";

// TUI Dashboard
export { launchDashboard, printChalkStatus } from "./ui/Dashboard.js";

/**
 * Helper to define a flare config with type checking.
 * Usage: `export default defineConfig({ ... })`
 */
export function defineConfig(config: import("./config/schema.js").FlareConfig) {
  return config;
}
