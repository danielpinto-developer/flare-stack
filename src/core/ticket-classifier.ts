/**
 * FLARE STACK — Ticket Type Classifier Agent
 *
 * Specialized agent that classifies tickets as frontend/backend/full-stack.
 * Runs BEFORE the planning phase to inform model selection and Figma requirements.
 *
 * Input:  Ticket summary + description
 * Output: { type, confidence, reasoning, needsFigma }
 */

import chalk from "chalk";
import { detectProvider, callLLM } from "./llm.js";

export interface TicketClassification {
  type: "frontend" | "backend" | "full-stack";
  confidence: number;
  reasoning: string;
  needsFigma: boolean;
}

/**
 * Classify a ticket's type using a focused LLM call.
 */
export async function classifyTicket(
  ticketId: string,
  summary: string,
  description: string,
): Promise<TicketClassification> {
  const provider = detectProvider();
  if (!provider) {
    console.log(chalk.yellow(`   ⚠️  No LLM key — defaulting to full-stack`));
    return {
      type: "full-stack",
      confidence: 30,
      reasoning: "No LLM available for classification",
      needsFigma: true,
    };
  }

  const prompt = `You are a ticket classifier. Your ONLY job is to determine the TYPE of engineering work.

TICKET:
  ID: ${ticketId}
  Summary: ${summary || "(no summary)"}
  Description:
${description || "(no description)"}

CLASSIFY as exactly one of:
- "frontend" — UI-only work (React components, CSS, modals, pages, styling). No backend API changes.
- "backend" — Backend-only (API routes, database migrations, services, models). No UI changes.
- "full-stack" — Both frontend AND backend work needed.

SIGNALS TO LOOK FOR:
- Mentions of modals, buttons, pages, layouts, UI, design, Figma → frontend or full-stack
- Mentions of API endpoints, database, migrations, models, services → backend or full-stack
- Mentions of both UI AND API/database → full-stack

Return a JSON object with:
- "type": one of "frontend", "backend", "full-stack"
- "confidence": 0-100
- "reasoning": one sentence explaining your classification
- "needsFigma": true if any visual/UI work is involved (frontend or full-stack), false for backend-only

Return ONLY the JSON object.`;

  try {
    const { extractJSON } = await import("./extract-json.js");
    const text = await callLLM(provider, prompt);
    const result = extractJSON<TicketClassification>(text);

    // Validate type
    const validTypes = ["frontend", "backend", "full-stack"];
    if (!validTypes.includes(result.type)) {
      result.type = "full-stack";
    }

    // Derive needsFigma if not provided
    if (result.needsFigma === undefined) {
      result.needsFigma = result.type !== "backend";
    }

    result.confidence = Math.max(
      0,
      Math.min(100, Math.round(result.confidence || 50)),
    );

    return result;
  } catch (err) {
    console.log(
      chalk.yellow(
        `   ⚠️  Classifier failed: ${err instanceof Error ? err.message : err}`,
      ),
    );
    return {
      type: "full-stack",
      confidence: 30,
      reasoning: "Classification failed, defaulting to full-stack",
      needsFigma: true,
    };
  }
}
