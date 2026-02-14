/**
 * FLARE STACK — Pipeline State
 *
 * Tracks which phases have been completed for each ticket.
 * State is persisted per-worktree as `.flare-state.json`.
 *
 * Phases: planning → verification → implementation → audit
 */

import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { WorkflowPhase } from "./model-router.js";

/** State for a single ticket's pipeline */
export interface PipelineState {
  ticketId: string;
  completedPhases: WorkflowPhase[];
  currentPhase: WorkflowPhase | null;
  /** Auto-detected ticket type from plan phase: frontend, full-stack, or backend */
  ticketType?: "frontend" | "full-stack" | "backend";
  /** Classifier agent result — cached to avoid re-running on resume */
  classification?: {
    type: "frontend" | "backend" | "full-stack";
    confidence: number;
    reasoning: string;
    needsFigma: boolean;
  };
  startedAt: string;
  updatedAt: string;
}

const PHASE_ORDER: WorkflowPhase[] = [
  "planning",
  "verification",
  "implementation",
  "forging",
  "scanning",
  "audit",
];

const STATE_FILE = ".flare-state.json";

/**
 * Load pipeline state from a worktree directory.
 */
export async function loadPipelineState(
  worktreePath: string,
): Promise<PipelineState | null> {
  const statePath = join(worktreePath, STATE_FILE);
  if (!existsSync(statePath)) return null;

  try {
    const raw = await readFile(statePath, "utf-8");
    return JSON.parse(raw) as PipelineState;
  } catch {
    return null;
  }
}

/**
 * Save pipeline state to a worktree directory.
 */
export async function savePipelineState(
  worktreePath: string,
  state: PipelineState,
): Promise<void> {
  state.updatedAt = new Date().toISOString();
  const statePath = join(worktreePath, STATE_FILE);
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Mark a phase as started.
 */
export async function markPhaseStarted(
  worktreePath: string,
  ticketId: string,
  phase: WorkflowPhase,
): Promise<PipelineState> {
  let state = await loadPipelineState(worktreePath);

  if (!state) {
    state = {
      ticketId,
      completedPhases: [],
      currentPhase: phase,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } else {
    state.currentPhase = phase;
  }

  await savePipelineState(worktreePath, state);
  return state;
}

/**
 * Mark a phase as completed.
 */
export async function markPhaseCompleted(
  worktreePath: string,
  ticketId: string,
  phase: WorkflowPhase,
): Promise<PipelineState> {
  let state = await loadPipelineState(worktreePath);

  if (!state) {
    state = {
      ticketId,
      completedPhases: [phase],
      currentPhase: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } else {
    if (!state.completedPhases.includes(phase)) {
      state.completedPhases.push(phase);
    }
    state.currentPhase = null;
  }

  await savePipelineState(worktreePath, state);
  return state;
}

/**
 * Get the next phase in the pipeline based on completed phases.
 * Returns null if all phases are done.
 */
export function getNextPhase(
  state: PipelineState | null,
): WorkflowPhase | null {
  if (!state) return PHASE_ORDER[0];

  for (const phase of PHASE_ORDER) {
    if (!state.completedPhases.includes(phase)) {
      return phase;
    }
  }

  return null; // All phases complete
}

/**
 * Get all remaining phases.
 */
export function getRemainingPhases(
  state: PipelineState | null,
): WorkflowPhase[] {
  if (!state) return [...PHASE_ORDER];

  return PHASE_ORDER.filter((p) => !state.completedPhases.includes(p));
}

/**
 * Check if the pipeline is fully complete.
 */
export function isPipelineComplete(state: PipelineState | null): boolean {
  if (!state) return false;
  return PHASE_ORDER.every((p) => state.completedPhases.includes(p));
}
