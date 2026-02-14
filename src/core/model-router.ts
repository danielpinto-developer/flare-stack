/**
 * FLARE STACK — Model Router
 *
 * Dynamically selects the AI model based on the current workflow phase.
 * Implements the 80/20 Rule:
 *   - Low-reasoning models for planning/verification (cheap, fast, iterative)
 *   - High-reasoning models for implementation/audit (precise, thorough)
 */

import type { FlareConfig, ModelPhaseConfig } from "../config/schema.js";
import chalk from "chalk";

export type WorkflowPhase =
  | "planning"
  | "verification"
  | "implementation"
  | "forging"
  | "scanning"
  | "audit";

export interface ModelSelection {
  provider: string;
  model: string;
  tier: string;
  temperature: number;
  maxTokens?: number;
  /** Display string for logging */
  display: string;
}

/**
 * Select the model configuration for a given workflow phase.
 */
export function selectModel(
  phase: WorkflowPhase,
  config: FlareConfig,
): ModelSelection {
  const phaseConfig: ModelPhaseConfig = config.models[phase];

  const display = `${phaseConfig.provider}/${phaseConfig.model} (${phaseConfig.tier})`;

  return {
    provider: phaseConfig.provider,
    model: phaseConfig.model,
    tier: phaseConfig.tier,
    temperature: phaseConfig.temperature,
    maxTokens: phaseConfig.maxTokens,
    display,
  };
}

/**
 * Log the model selection for a phase.
 */
export function logModelSelection(
  phase: WorkflowPhase,
  selection: ModelSelection,
): void {
  const phaseEmoji: Record<WorkflowPhase, string> = {
    planning: "📋",
    verification: "🔍",
    implementation: "🔥",
    forging: "🔨",
    scanning: "🔎",
    audit: "🛡️",
  };

  const tierColor = selection.tier === "high" ? chalk.red : chalk.green;

  console.log(
    chalk.cyan(`${phaseEmoji[phase]} Phase: ${phase.toUpperCase()}`),
    chalk.white("→"),
    chalk.bold(selection.display),
    tierColor(`[${selection.tier.toUpperCase()}]`),
    chalk.gray(`temp=${selection.temperature}`),
  );
}

/**
 * Get all model selections for the full Greenlight pipeline.
 */
export function getFullPipelineModels(
  config: FlareConfig,
): Record<WorkflowPhase, ModelSelection> {
  const phases: WorkflowPhase[] = [
    "planning",
    "verification",
    "implementation",
    "forging",
    "scanning",
    "audit",
  ];

  return Object.fromEntries(
    phases.map((phase) => [phase, selectModel(phase, config)]),
  ) as Record<WorkflowPhase, ModelSelection>;
}
