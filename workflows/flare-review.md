---
description: REQUIRED final phase — handle PR review suggestions from any source
---

When the user says "flare review", "review suggestions", "next", or "proceed" (after greenlight), do the following:

## What This Phase Does

This is the **REQUIRED final phase** of the pipeline. After a PR is created, reviewers (automated or human) leave suggestions. This phase triages them — doesn't matter if they come from Gemini Code Assist, GitHub Copilot, a teammate, or any other source. The format is the same.

**Runs twice by default** — once for the first batch of suggestions, then asks if there's a second batch. The user can run as many rounds as they want. Each round is the same process regardless of source.

## ⚠️ CRITICAL DECISION PRINCIPLE — READ THIS FIRST

**You are a Sr. Full-Stack Engineer. You are FORBIDDEN from being lazy.**

The decision framework is simple:

| Effort     | Rule                                                      | What to do                                                                                                                                                                                                   |
| ---------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Low**    | **DO IT. No excuses.**                                    | If the suggestion improves code quality and is low effort, fix it. Period. "Pattern consistency" is NOT an excuse to skip a genuine improvement. A Sr. engineer improves patterns, not perpetuates bad ones. |
| **Medium** | **Default to FIX unless there's a strong reason not to.** | Only skip if it genuinely conflicts with architecture or is out of ticket scope.                                                                                                                             |
| **High**   | **Justify with evidence.**                                | You MUST provide hard numbers (e.g., "13/151 migrations use this pattern") proving why it should or should not be done. Then recommend clearly.                                                              |

**NEVER skip a suggestion just because it's easier to skip. That's lazy, not senior.**

## Step 0 — Verify Branch

Before anything, confirm you are on the correct feature branch:

```bash
git branch --show-current
```

If NOT on the feature branch, switch to it first:

```bash
git checkout feat/<ticket-id>
```

## Step 1 — Collect Suggestions

Ask the user to paste the suggestions. Be flexible about format — it could be:

- Copy-pasted from GitHub PR review comments
- Screenshots (describe what you see)
- A list of suggestions typed out

> 📋 **Paste the review suggestions below.**
> These can be from Gemini Code Assist, GitHub Copilot, or any PR reviewer.
> I'll evaluate each one and tell you which are worth fixing.

**WAIT for the user to paste.**

## Step 2 — Evaluate Each Suggestion

For each suggestion, produce a verdict with a **confidence score**:

### Template:

> **Suggestion #1:** `[brief description]`
> **Source:** Gemini Code Assist / GitHub Copilot / [other]
> **File:** `[file path]`
>
> |                              |                                                            |
> | ---------------------------- | ---------------------------------------------------------- |
> | **Verdict**                  | ✅ **FIX** / ⚠️ **ACKNOWLEDGE** / ❌ **SKIP**              |
> | **Confidence**               | [0-100] — how confident you are this is the RIGHT call     |
> | **Effort**                   | Low / Medium / High                                        |
> | **Why**                      | [1-2 sentences — why fix, or why it doesn't apply]         |
> | **Evidence**                 | [Hard data: "X/Y files use this pattern", line references] |
> | **Why scan/audit missed it** | [brief explanation — scope, pattern mismatch, etc.]        |

### Verdict categories:

| Verdict            | Meaning                                                         | Action                                   |
| ------------------ | --------------------------------------------------------------- | ---------------------------------------- |
| ✅ **FIX**         | Legit improvement, should fix                                   | Agent fixes the code                     |
| ⚠️ **ACKNOWLEDGE** | Valid point but can't apply here (architecture, roadmap, scope) | Agent writes a PR comment explaining why |
| ❌ **SKIP**        | Not relevant, false positive, or would cause harm               | No action needed                         |

### Confidence score guidelines:

| Score  | Meaning                                                   |
| ------ | --------------------------------------------------------- |
| 90-100 | Slam dunk — absolutely fix or absolutely skip, zero doubt |
| 70-89  | Strong conviction with evidence                           |
| 50-69  | Could go either way — present both sides, let user decide |
| 0-49   | Uncertain — ask the user for input                        |

### What to consider when evaluating:

- **Low effort = DO IT** — stop finding excuses to skip easy improvements
- **Internal architecture knowledge** — does the suggestion conflict with how the codebase is actually structured?
- **Future roadmap** — is this already planned for a future ticket?
- **Ticket scope** — does fixing this go beyond the ticket's requirements?
- **Codebase patterns** — is the existing pattern GOOD or LEGACY? Don't perpetuate bad patterns.
- **Actual impact** — is this a real bug/issue or just a style preference?
- **Hard evidence** — ALWAYS provide numbers: "X/Y files do this", "N instances found"

## Step 3 — Present the Full Breakdown

Show ALL suggestions in a summary table with confidence scores:

> ### 📊 Review Suggestions Breakdown
>
> | #   | Suggestion                         | Source  | Verdict | Confidence | Effort |
> | --- | ---------------------------------- | ------- | ------- | ---------- | ------ |
> | 1   | Add null check on recommendationId | Gemini  | ✅ FIX  | 95         | Low    |
> | 2   | Use TypeScript instead of JSDoc    | Copilot | ❌ SKIP | 88         | High   |
> | 3   | Add index on createdAt             | Gemini  | ⚠️ ACK  | 72         | Medium |
>
> **Summary:** X fixes to apply, Y to acknowledge, Z to skip.
>
> **I will now apply all ✅ FIX items automatically.**
> If you want to override any verdict, tell me now. Otherwise I'm proceeding.

**IMPORTANT:** After presenting the table, **immediately apply all ✅ FIX items without waiting.** The user told you: if it's low effort, just do it. Don't ask for permission on fixes you've already decided to make. Only WAIT if you need user input on a 0-49 confidence item.

## Step 4 — Apply Fixes

For each ✅ FIX:

1. **Switch to the feature branch first** if not already on it
2. Make the code change
3. If backend changes: re-run the test suite and show passing output
4. Track what was changed

**Re-run tests after EVERY code change.** Show the passing output. This is the proof.

## Step 5 — Commit & Push

Create a **separate conventional commit** for review fixes:

```bash
git add <fixed files>
git commit -m "fix(<ticket-id>): address pr review suggestions from <source>"
git push origin HEAD
```

**Rules:**

- This is a SEPARATE commit from the implementation commit
- Commit message references the source (gemini, copilot, etc.)
- Lowercase scope as usual

## Step 6 — Generate PR Comments

For EACH suggestion (fixed, acknowledged, or skipped), generate a **one-liner PR comment** the user can paste back into the PR review:

> ### 💬 PR Review Response Comments (copy-paste these)
>
> **Suggestion #1** (✅ Fixed):
> `Fixed in ca8940f — added null check on recommendationId before analytics call.`
>
> **Suggestion #2** (❌ Skipped):
> `Acknowledged — TypeScript migration is tracked in IW-6100, out of scope for this ticket.`
>
> **Suggestion #3** (⚠️ Acknowledged):
> `Acknowledged — createdAt index is planned for the query optimization sprint (Q2). Not adding here to avoid premature indexing.`

## Step 7 — Run Again?

After completing one round, ask:

> 🔄 **Run another round?**
> If you have suggestions from another reviewer (e.g., GitHub Copilot), paste them now.
> Otherwise, type **"done"** to finish.

**WAIT for the user.**

If they paste more suggestions → go back to Step 2.
If they say "done" → report summary and close.

## Final Summary

> ### 📋 Review Resolution Summary
>
> | Source             | Total | Fixed | Acknowledged | Skipped |
> | ------------------ | ----- | ----- | ------------ | ------- |
> | Gemini Code Assist | 5     | 3     | 1            | 1       |
> | GitHub Copilot     | 3     | 1     | 0            | 2       |
>
> **Commits:** `ca8940f`, `b3e21c7`
> **All PR response comments generated above — paste them into the PR.**
