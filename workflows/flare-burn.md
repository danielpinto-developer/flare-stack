---
description: Run the full AI combustion cycle — Classify → Challenge Ticket → Plan → Verify → Implement → Forge → Scan → Audit
---

When the user says "flare burn", "burn", or "run the pipeline", execute:

// turbo-all

1. Run the combustion cycle: `flare burn --no-pause`
2. Report the results of each phase back to the user.

**Pipeline phases:**

- Step 0: Classify ticket (backend/frontend/full-stack)
- Step 0.5: Challenge ticket suggestions against real codebase
- Phase 1: Planning — create implementation plan
- Phase 2: Verification — self-correct plan against codebase patterns
- Phase 3: Implementation — write production code
- Phase 4: Forging — refine frontend UI (skipped for backend-only)
- Phase 5: Scanning — blast radius check
- Phase 6: Audit — final code review + greenlight/reject
