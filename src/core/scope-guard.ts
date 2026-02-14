/**
 * FLARE STACK — Scope Guard Agent
 *
 * Post-implementation agent that detects if AI output drifts beyond
 * the original ticket scope. This catches gold-plating, unrequested
 * features, and off-topic code changes.
 *
 * Input:  Ticket + plan + implementation output
 * Output: { inScope, driftedItems[], confidence }
 */

import chalk from "chalk";
import { detectProvider, callLLM } from "./llm.js";

export interface ScopeVerdict {
  inScope: boolean;
  driftedItems: string[];
  confidence: number;
  summary: string;
}

/**
 * Check if the implementation stayed within the ticket's scope.
 */
export async function checkScope(
  ticketContent: string,
  planOutput: string,
  implementationOutput: string,
): Promise<ScopeVerdict> {
  const provider = detectProvider();
  if (!provider) {
    console.log(chalk.yellow(`   ⚠️  No LLM key — skipping scope guard`));
    return {
      inScope: true,
      driftedItems: [],
      confidence: 30,
      summary: "No LLM available — scope guard skipped",
    };
  }

  const prompt = `You are the Scope Guard. Your ONLY job is to detect if the implementation went beyond the ticket scope.

TICKET (the source of truth for what was requested):
${ticketContent}

APPROVED PLAN (what was agreed to implement):
${planOutput}

IMPLEMENTATION OUTPUT (what was actually built):
${implementationOutput}

CHECK FOR SCOPE DRIFT:
- Files modified that aren't mentioned in the plan
- Features added that weren't in the ticket
- Refactoring done that wasn't requested
- Dependencies added without justification
- Test coverage for things outside the ticket

IMPORTANT DISTINCTIONS:
- Standard supporting work IS in scope (e.g., adding a type definition needed by a new feature)
- Bug fixes discovered during implementation ARE in scope if directly related
- "While I'm here" changes are OUT OF SCOPE

Return a JSON object with:
- "inScope": true if implementation stays within scope, false if drift detected
- "driftedItems": array of specific out-of-scope items (empty array if in scope)
- "confidence": 0-100 how confident you are in the assessment
- "summary": one-sentence overall assessment

Return ONLY the JSON object.`;

  try {
    const { extractJSON } = await import("./extract-json.js");
    const text = await callLLM(provider, prompt);
    const result = extractJSON<ScopeVerdict>(text);

    result.confidence = Math.max(
      0,
      Math.min(100, Math.round(result.confidence || 50)),
    );
    result.driftedItems = result.driftedItems || [];
    result.inScope =
      result.inScope !== undefined
        ? result.inScope
        : result.driftedItems.length === 0;
    result.summary = result.summary || "";

    return result;
  } catch (err) {
    console.log(
      chalk.yellow(
        `   ⚠️  Scope guard failed: ${err instanceof Error ? err.message : err}`,
      ),
    );
    return {
      inScope: true,
      driftedItems: [],
      confidence: 30,
      summary: "Scope guard failed — defaulting to in-scope",
    };
  }
}
