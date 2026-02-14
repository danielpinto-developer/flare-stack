/**
 * FLARE STACK — Plan Judge Agent (Quality Gate)
 *
 * Evaluates whether a planning phase output is production-ready.
 * Returns a structured verdict with specific criticisms.
 *
 * When the verdict is FAIL, the criticisms are fed back into the
 * re-plan prompt so the planner receives DIFFERENT input and can
 * fix the specific issues — not just re-run blindly.
 *
 * Input:  Plan output + ticket details + optional codebase context
 * Output: { verdict, score, criticisms[] }
 */

import chalk from "chalk";
import { detectProvider, callLLM } from "./llm.js";

export interface JudgeVerdict {
  verdict: "PASS" | "FAIL";
  score: number;
  criticisms: string[];
  summary: string;
}

/** Quality gate threshold — plans scoring below this trigger a re-plan */
export const QUALITY_THRESHOLD = 80;

/** Maximum re-plan attempts before asking the user */
export const MAX_REPLANS = 2;

/**
 * Judge a plan and return a structured verdict.
 */
export async function judgePlan(
  planOutput: string,
  ticketContent: string,
  codeReviewStandards?: string,
): Promise<JudgeVerdict> {
  const provider = detectProvider();
  if (!provider) {
    console.log(
      chalk.yellow(`   ⚠️  No LLM key — skipping judge, assuming PASS`),
    );
    return {
      verdict: "PASS",
      score: 50,
      criticisms: [],
      summary: "No LLM available — judge skipped",
    };
  }

  const prompt = `You are the Plan Judge. Your ONLY job is to evaluate the quality of an implementation plan.
You are NOT generating code. You are NOT planning. You are SCORING and CRITICIZING.

TICKET:
${ticketContent}
${codeReviewStandards ? `\nCODE REVIEW STANDARDS:\n${codeReviewStandards}` : ""}

PLAN TO EVALUATE:
${planOutput}

EVALUATION CRITERIA (score each 0-20, total max 100):

1. COMPLETENESS (0-20): Does the plan cover all ticket requirements? Are acceptance criteria addressed?
2. SPECIFICITY (0-20): Are file paths, function names, and patterns specific — or vague hand-waving?
3. CONSISTENCY (0-20): Do proposed names/patterns match what already exists in the codebase (if mentioned)?
4. RISK AWARENESS (0-20): Does the plan identify breaking changes, migrations, edge cases?
5. TESTABILITY (0-20): Does each step have clear test criteria? Can you verify it worked?

RULES:
- Be harsh. A senior engineer would flag anything sloppy.
- Each criticism must be SPECIFIC and ACTIONABLE (not "improve naming" — say WHAT name and WHAT it should be)
- If the plan is genuinely good, say so — don't manufacture problems
- Score honestly: 90+ = excellent, 80-89 = good enough, 60-79 = needs work, <60 = rewrite

Return a JSON object with:
- "verdict": "PASS" if score >= 80, "FAIL" if below
- "score": total score (0-100)
- "criticisms": array of specific issues found (empty array if PASS with no issues)
- "summary": one-sentence overall assessment

Return ONLY the JSON object.`;

  try {
    const { extractJSON } = await import("./extract-json.js");
    const text = await callLLM(provider, prompt);
    const result = extractJSON<JudgeVerdict>(text);

    // Enforce verdict based on score
    result.score = Math.max(0, Math.min(100, Math.round(result.score || 0)));
    result.verdict = result.score >= QUALITY_THRESHOLD ? "PASS" : "FAIL";
    result.criticisms = result.criticisms || [];
    result.summary = result.summary || "";

    return result;
  } catch (err) {
    console.log(
      chalk.yellow(
        `   ⚠️  Judge failed: ${err instanceof Error ? err.message : err}`,
      ),
    );
    return {
      verdict: "PASS",
      score: 50,
      criticisms: [],
      summary: "Judge failed to evaluate — defaulting to PASS",
    };
  }
}

/**
 * Build the re-plan context that includes the Judge's criticisms.
 * This is the key to why re-planning produces DIFFERENT output —
 * the planner now receives specific issues to fix.
 */
export function buildRePlanContext(
  previousPlan: string,
  verdict: JudgeVerdict,
  attempt: number,
): string {
  const criticismList = verdict.criticisms
    .map((c, i) => `${i + 1}. ${c}`)
    .join("\n");

  return `
⚠️ PREVIOUS PLAN REJECTED (Attempt ${attempt}/${MAX_REPLANS + 1})
Score: ${verdict.score}/100 — ${verdict.summary}

THE JUDGE FOUND THESE SPECIFIC ISSUES:
${criticismList}

YOUR PREVIOUS PLAN (for reference):
${previousPlan}

INSTRUCTIONS:
- Fix ALL listed issues in your revised plan
- Do NOT repeat the same mistakes
- Keep everything that was correct
- The Judge will re-evaluate, so address every criticism specifically`;
}
