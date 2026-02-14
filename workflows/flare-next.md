---
description: Auto-advance to the next pipeline phase using YOUR selected model
---

When the user says "flare next", "next", "proceed", or "continue", do the following:

// turbo-all

## Pipeline Order

Core combustion cycle: **PLAN → VERIFY → IMPLEMENT → AUDIT** (from README).
Quality gates and shipping phases wrap around it. Every phase is required.

### 🖥️ Backend Only

```
1. /flare-plan       → Break down the ticket into an implementation plan
2. /flare-verify     → Verify the plan against the real codebase patterns
3. /flare-implement  → Write production code + write unit/integration tests
4. /flare-scan       → Blast radius — check what else could break
5. /flare-audit      → Word-for-word code review — greenlight or reject
6. /flare-greenlight → Test proof screenshot, commit + push, generate PR body
7. /flare-review     → Handle PR review suggestions (Gemini Code Assist, then Copilot, etc.)
```

### 🎨 Frontend Only / 🔥 Full Stack

```
1. /flare-plan       → Break down the ticket into an implementation plan
2. /flare-verify     → Verify the plan against the real codebase patterns
3. /flare-implement  → Write production code + write tests
4. /flare-forge      → Refine UI against Figma/design specs
5. /flare-scan       → Blast radius — check what else could break
6. /flare-audit      → Word-for-word code review — greenlight or reject
7. /flare-greenlight → Test proof (backend) + Loom (frontend), commit + push, generate PR
8. /flare-review     → Handle PR review suggestions (Gemini Code Assist, then Copilot, etc.)
```

## How to determine the current phase

1. Read `TICKET.md` to determine scope (Backend / Frontend / Full Stack)
2. Check which `OUTPUT_*.md` files exist:

| If exists             | Next (Backend)      | Next (Frontend/Full Stack) |
| --------------------- | ------------------- | -------------------------- |
| Nothing               | `/flare-plan`       | `/flare-plan`              |
| `OUTPUT_PLAN.md`      | `/flare-verify`     | `/flare-verify`            |
| `OUTPUT_VERIFY.md`    | `/flare-implement`  | `/flare-implement`         |
| `OUTPUT_IMPLEMENT.md` | `/flare-scan`       | `/flare-forge`             |
| `OUTPUT_FORGE.md`     | N/A                 | `/flare-scan`              |
| `OUTPUT_SCAN.md`      | `/flare-audit`      | `/flare-audit`             |
| `OUTPUT_AUDIT.md`     | `/flare-greenlight` | `/flare-greenlight`        |
| `OUTPUT_PR.md`        | `/flare-review`     | `/flare-review`            |

## Action

1. Determine scope from `TICKET.md`
2. Determine current phase from the table above
3. Announce: "▶️ **Next phase: /flare-[phase]** — [brief description]"
4. Execute that phase's workflow (read the corresponding `flare-[phase].md`)
