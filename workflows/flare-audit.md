---
description: Run the audit phase — final code review and greenlight/reject decision
---

When the user says "flare audit", "audit", or "code review", execute:

// turbo-all

1. Run audit: `flare audit`
2. Report the audit results back to the user.

**What this does:**

- Reviews ALL code changes against ticket requirements
- Checks for scope creep, missing tests, broken patterns, security issues
- Gives GREENLIGHT or REJECT with specific reasons
