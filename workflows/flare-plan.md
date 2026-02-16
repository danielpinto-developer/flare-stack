---
description: Run the planning phase — create an implementation plan using YOUR selected model
---

When the user says "flare plan", "plan", or "create a plan", do the following using YOUR OWN capabilities (do NOT run the CLI):

## 🛑 STEP 0 — WORKTREE GATE (MANDATORY — DO NOT SKIP)

> [!CAUTION]
> **This step is NON-NEGOTIABLE. If the chamber is not a git worktree, you MUST NOT read any code, write any code, or do ANY planning until it is fixed. STOP EVERYTHING.**

Run this check FIRST, before anything else:

```bash
git rev-parse --git-dir 2>/dev/null && echo "WORKTREE OK" || echo "NOT A WORKTREE"
```

### If "NOT A WORKTREE":

1. Read `flare.config.ts` to get the target repo path and source branch
2. Determine the source branch from `flare.config.ts` → `repos.<repo>.branches` (use the feature/dev branch, not `main`)
3. **From the target repo**, create the worktree pointing at this chamber directory:

```bash
# From the target repo (e.g., /Users/daniel/Documents/inno):
cd <repo-path>
git fetch origin
git checkout <source-branch>
git pull origin <source-branch>

# Create feature branch as worktree inside the chamber:
git worktree add <chamber-path> -b feat/<ticket-id-lowercase>
# Example: git worktree add /Users/daniel/Documents/flare-chambers/IW-6034 -b feat/iw-6034
```

4. **Back in the chamber**, install dependencies:

```bash
cd <chamber-path>
npm install
```

5. Verify setup:

```bash
git branch --show-current  # Should show feat/<ticket-id>
node -e "console.log('Node OK')"
npx jest --version  # Should print jest version
```

### If "WORKTREE OK":

1. Confirm you're on the right feature branch
2. If `node_modules` is missing, run `npm install`
3. Proceed

### Rules:

- **The chamber IS where ALL code lives.** All edits, tests, and git commands run from HERE.
- **NEVER edit files in the main repo (e.g., ~/Documents/inno).** That is the PARENT — not your workspace.
- **NEVER cd into the parent repo to write code.** Only cd into it to run `git worktree add`.
- If the worktree branch already exists elsewhere, prune stale entries first: `git worktree prune` from the main repo.

---

## Pre-check — Existing Output

If `OUTPUT_PLAN.md` already exists, **ask the user:**

> 📋 An existing plan (`OUTPUT_PLAN.md`) was found. What would you like to do?
>
> 1. **Overwrite** — start fresh with a new plan
> 2. **Revise** — read the existing plan and improve it with the updated workflow
> 3. **Skip** — keep the current plan and move to `/flare-verify`

**WAIT for the user to choose.** Then proceed accordingly.

## Step 1 — Classify the Ticket

Read `TICKET.md` and classify it as one of:

| Scope                | Signals                                                     | What it means                                               |
| -------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| **🖥️ Backend Only**  | migration, model, API endpoint, seeder, no UI mentions      | Skip forge phase. No Figma needed. Focus on DB, API, tests. |
| **🎨 Frontend Only** | component, modal, widget, UI, CSS, no DB/migration mentions | **REQUIRE Figma URL or screenshots before implementing.**   |
| **🔥 Full Stack**    | both backend AND frontend                                   | **REQUIRE Figma for frontend portion.** Plan backend first. |

### 🛑 Confirm Classification with User

Announce your classification and **ASK THE USER TO CONFIRM:**

> 📋 **Ticket Scope: [Backend Only | Frontend Only | Full Stack]**
> I classified this as **[scope]** because: [brief reason].
> ✅ **Correct?** If not, tell me the right scope.

**WAIT for confirmation.** If frontend/full-stack and confirmed, ask for Figma URL or screenshots.

---

## Step 2 — Challenge the Ticket (Trust but Verify)

The Jira ticket was written by a lead using LLM assistance. The technical suggestions in the ticket are **guidelines, not gospel.** You are a senior full-stack engineer — act like one.

### What to do:

1. Read the ticket's technical requirements, code snippets, and implementation suggestions
2. **Cross-reference each suggestion against the ACTUAL codebase:**
   - Does the file path the ticket mentions actually exist? Check it.
   - Does the model/table the ticket references have the structure it claims? Read it.
   - Are the field names, types, and conventions in the ticket consistent with what's already in the code?
   - Does the migration pattern the ticket suggests match the last 3 real migrations?
   - Are the ticket's enum values, index names, or association patterns consistent with existing ones?

3. **If you find a discrepancy:**
   - Don't blindly follow the ticket. Don't blindly reject it either.
   - Present the evidence to the user:

   > ⚠️ **Ticket Challenge:**
   > The ticket suggests `[what the ticket says]`
   > But the codebase actually does `[what the code shows]` (see `[file path]`)
   > **My recommendation:** `[your senior engineer suggestion]`
   > Want me to go with the ticket's approach or my recommendation?

4. **If the ticket's suggestion is solid and matches the codebase:** Say so. No need to challenge everything — only challenge what deserves it.

5. **Things to watch for:**
   - Wrong file paths or model names (LLMs hallucinate)
   - Field types that don't match existing patterns (e.g., ticket says `STRING` but similar fields use `TEXT`)
   - Naming conventions that break existing patterns (e.g., ticket says `snake_case` but codebase uses `camelCase`)
   - Copy-pasted migration patterns that don't match the project's actual migration style
   - Missing or incorrect associations that don't align with how the codebase defines relationships
   - Suggested indexes that duplicate existing ones or use wrong naming conventions

---

## Step 3 — Plan

1. Read `1_PLAN.md` for the planning prompt template and instructions
2. Analyze the codebase **INSIDE THIS CHAMBER** thoroughly — understand existing patterns, conventions, file structure
3. If frontend/full-stack: check for images in `images/` directory
4. Incorporate any corrections from Step 2 (ticket challenges)
5. Create a detailed implementation plan addressing every ticket requirement
6. Write the plan to `OUTPUT_PLAN.md`
7. Report the plan back to the user for review, including:
   - Scope classification
   - Any ticket challenges you found (with evidence)
   - The full plan
