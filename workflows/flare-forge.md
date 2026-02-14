---
description: Run the forge phase — refine frontend UI against Figma/design specs (skipped for backend-only tickets)
---

When the user says "flare forge", "forge", or "refine the UI", execute:

// turbo-all

1. Run forge: `flare forge`
2. Report the forge output back to the user.

**What this does:**

- Skips automatically for backend-only tickets
- Compares implementation against Figma/design specs
- Checks pixel accuracy, accessibility, responsive behavior
