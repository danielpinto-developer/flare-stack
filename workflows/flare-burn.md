---
description: Run the full AI combustion cycle — Classify → Challenge Ticket → Plan → Verify → Implement → Forge → Scan → Audit
---

When the user says "flare burn", "burn", or "run the pipeline", do the following:

## 🛑 WORKTREE GATE (MANDATORY — DO NOT SKIP)

> [!CAUTION]
> **Before running ANY pipeline phase, verify you are inside a git worktree. If this check fails, STOP and run the worktree setup from `/flare-plan` Step 0.**

```bash
git rev-parse --git-dir 2>/dev/null && echo "WORKTREE OK" || echo "NOT A WORKTREE"
git branch --show-current       # Must show feat/<ticket-id>
```

If either check fails, set up the worktree first (see `/flare-plan` Step 0). **ALL code is written inside THIS chamber. NEVER edit files in the main repo.**

---

// turbo-all

1. Run the combustion cycle: `flare burn --no-pause`
2. Report the results of each phase back to the user.

**Pipeline phases:**

- **Step 0: WORKTREE GATE — verify chamber is a git worktree (this step)**
- Step 1: Classify ticket (backend/frontend/full-stack)
- Step 2: Challenge ticket suggestions against real codebase
- Phase 3: Planning — create implementation plan
- Phase 4: Verification — self-correct plan against codebase patterns
- Phase 5: Implementation — write production code
- Phase 6: Forging — refine frontend UI (skipped for backend-only)
- Phase 7: Scanning — blast radius check
- Phase 8: Audit — final code review + greenlight/reject
