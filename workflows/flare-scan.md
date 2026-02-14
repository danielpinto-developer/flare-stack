---
description: Run the scavenger bot — blast radius scan for collateral damage
---

When the user says "flare scan", "scan", or "blast radius", execute:

// turbo-all

1. Run scan: `flare scan`
2. Report the scan results back to the user.

**What this does:**

- Checks all files that import from or depend on changed files
- Runs available tests to verify nothing broke
- Reports any collateral damage
