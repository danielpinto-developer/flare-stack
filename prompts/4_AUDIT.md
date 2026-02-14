# PROMPT_END (Final Audit)

**TARGET MODEL:** Gemini 3 Pro (High)
**GOAL:** Final Greenlight with Confidence Scoring.

**Standards:** `[REPO]_CODE_REVIEW_PROMPT.md`

**Action:**

1.  **Word-for-Word Table:** Create a table comparing _every single line_ of the `Jira ticket requirements` requirements against the actual code.
2.  **Strict Evidence:** For EACH requirement, cite the exact file and line number where it is implemented.
3.  **Confidence Score:** Assign a **0–100 confidence score** to EACH requirement:
    - **100:** Perfect word-for-word match, fully tested.
    - **90–99:** Senior implementation, minor robust variations.
    - **70–89:** Implemented but missing edge cases or tests.
    - **<70:** REJECT. Stop immediately.
4.  **Code Review:** Strict audit against repo standards (`CODE_REVIEW_PROMPT.md`).
5.  **Overall Verdict:** Weighted average. NO "scrub" code allowed.

**Word-for-Word Audit Rule:**

One more time. I need word for word. Direct quotes and references. Line by line. Every thing compared in a table to understand if every single piece of the jira ticket is completed or if something was not completed. And to understand why.

**Output Format:**

| #   | Jira Requirement (Direct Quote) | Status   | Confidence | Evidence (file:line)   | Why (if incomplete) |
| --- | ------------------------------- | -------- | ---------- | ---------------------- | ------------------- |
| 1   | "[exact ticket text]"           | ✅/⚠️/❌ | 85/100     | [file:line, test name] | N/A or [reason]     |
| 2   | "[exact ticket text]"           | ✅/⚠️/❌ | 92/100     | [file:line, test name] | N/A or [reason]     |

**Overall Confidence: XX/100**

**Verdict:**

- **GREENLIGHT (90+):** Ready for push. All requirements met with high confidence.
- **CONDITIONAL (70–89):** Minor gaps. List exactly what needs fixing.
- **REJECT (<70):** Significant gaps. Fix immediately.
