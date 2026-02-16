---
description: Run the implementation phase — write production code using YOUR selected model
---

When the user says "flare implement", "implement", or "write the code", do the following using YOUR OWN capabilities (do NOT run the CLI):

## 🛑 WORKTREE GATE (MANDATORY — DO NOT SKIP)

> [!CAUTION]
> **You MUST verify you are inside a git worktree BEFORE writing any code. If this check fails, STOP and run the worktree setup from `/flare-plan` Step 0.**

```bash
git rev-parse --git-dir 2>/dev/null && echo "WORKTREE OK" || echo "NOT A WORKTREE"
git branch --show-current       # Must show feat/<ticket-id>
ls node_modules/.package-lock.json 2>/dev/null && echo "DEPS OK" || echo "DEPS MISSING"
```

If any check fails:

1. Run the worktree setup from `/flare-plan` Step 0
2. Then continue with implementation

> [!CAUTION]
> **ALL code is written inside THIS chamber.** Do NOT edit files in the main repo (e.g., `~/Documents/inno`). Do NOT `cd` into the parent repo to write code. The chamber IS the repo checkout. If you find yourself writing to a path outside this chamber, **STOP IMMEDIATELY** — you are doing it wrong.

---

## Pre-flight Check

1. Read `TICKET.md` — classify as Backend Only / Frontend Only / Full Stack
2. If **Frontend Only** or **Full Stack**:
   - Check `images/` directory for Figma exports or screenshots
   - If no visual references found: **STOP and ask the user for Figma URL or screenshots**
   - Do NOT write UI code without design references

## Implementation

1. Read `3_IMPLEMENT.md` for the implementation prompt template and instructions
2. Read `OUTPUT_PLAN.md` and `OUTPUT_VERIFY.md` for your verified plan
3. Write production code **inside this chamber** following the plan:
   - **Backend:** models, migrations, routes, controllers, seeders, tests
   - **Frontend:** components, hooks, styles, PropTypes, tests
   - **Full Stack:** backend first, then frontend
4. Follow existing codebase patterns exactly (naming, structure, imports, PropTypes, constants)

## Write Tests (REQUIRED — part of implementation, NOT a separate phase)

Tests are written HERE, during implementation. Not at greenlight. Not at audit:

### 🖥️ Backend Only / 🔥 Full Stack (backend portion)

- Write unit tests for new models, routes, controllers
- **Run the tests** to make sure they pass:
  ```bash
  export PATH="/opt/homebrew/bin:$PATH" && SEGMENT_WRITE_KEY=dummy NODE_ENV=test npx jest --testPathPattern="<test-file>" --verbose --forceExit
  ```
- If tests fail, fix the code and re-run — do NOT move on with failing tests
- **Read `testing-proof.md`** for the repo-specific test proof template (inno is ready, others TBD)

### 🎨 Frontend Only / 🔥 Full Stack (frontend portion)

- Write component/integration tests
- Run frontend tests to make sure they pass

> **NOTE:** The visual screenshot-ready proof (with emojis, borders, etc.) is produced during `/flare-greenlight`, NOT here. Here you just make sure tests pass.

## Output

5. Write implementation summary to `OUTPUT_IMPLEMENT.md`
6. Report what was implemented to the user
7. Ask: **"Type `next` or `proceed` to continue to the scan phase, or tell me what to change."**
