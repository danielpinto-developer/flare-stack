---
description: Run the verification phase — self-correct plan against real codebase patterns and conventions
---

When the user says "flare verify", "verify", or "verify the plan", execute:

// turbo-all

1. Run verification: `flare verify`
2. Report the verification output back to the user.

**What this does:**

- Audits naming conventions, file structure, import patterns, test patterns, migration patterns
- Self-corrects plan when codebase evidence contradicts it
- Only asks user about things it genuinely can't determine from the code
