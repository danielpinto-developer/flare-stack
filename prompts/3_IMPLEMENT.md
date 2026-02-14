# PROMPT_EXECUTE (Implementation)

**TARGET MODEL:** Gemini 3 Pro (High)
**GOAL:** Write Code.

**Context:**
The `implementation_plan.md` is verified.

**Action:**

1.  **Implement:** Write the actual code (Files, Functions, Logic).
2.  **Strict Adherence:** Follow the Plan exactly.
3.  **No Hallucinations:** Use the `Jira ticket requirements` as source of truth.

**Branch Workflow:**

Obviously new branch. Do not commit anything or push anything. Must be done on local first then once I give the GREENLIGHT command then conventional commit and push without failing the commitlint we have in place. Source of truth is `[SOURCE_BRANCH]` branch. Checkout and pull from there.

**Output:**
"Implementation Complete. Ready for Audit."
