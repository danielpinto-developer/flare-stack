---
description: Final approval — review all outputs, smart-select files, and push to GitHub using YOUR selected model
---

When the user says "flare greenlight", "greenlight", or "push it", do the following:

// turbo-all

## Pre-check — Pipeline Complete?

1. Check that `OUTPUT_PLAN.md`, `OUTPUT_VERIFY.md`, `OUTPUT_IMPLEMENT.md`, and `OUTPUT_AUDIT.md` exist
2. If any are missing, warn the user: "⚠️ Pipeline incomplete. Missing: [list]. Run `/flare-next` to continue or use `--force` to push anyway."

## Worktree & Branch Check

All commands run from HERE (this chamber directory). Verify:

```bash
git branch --show-current   # Must be feat/<ticket-id>
git log -1 --oneline        # Must show the implementation commit
```

If the chamber is NOT a worktree: **STOP.** Run the worktree setup from `/flare-plan` Step 0.5 first.

## Test Proof (REQUIRED — BLOCKS GREENLIGHT)

### 🖥️ Backend Only / 🔥 Full Stack

**Read `testing-proof.md`** for the exact repo-specific command template. Run the full visual proof with:

- `══════` borders
- 🔒 local DB confirmation
- 🎯 new tests highlighted with grep
- ✅ plain English descriptions per test (QA reads these)
- 🟢 completion signal

**Tell the user to screenshot the output.** Do NOT proceed to commit until tests pass and the user has their screenshot.

### 🎨 Frontend Only

- Remind the user to record a Loom showing the UI working
- No terminal test proof needed (unless there are component tests)

## Smart File Selection

**DO NOT blindly `git add -A`.** Exclude pipeline artifacts:

- `OUTPUT_*.md`, `1_PLAN.md`, `2_VERIFY.md`, `3_IMPLEMENT.md`, `4_AUDIT.md`, `5_*.md`
- `TICKET.md`, `INNO_CODE_REVIEW_PROMPT.md`
- `.flare-pipeline.json`, `.flare-state.json`, `flare.config.ts`
- `.agent/` directory, `images/` directory

**Only commit ticket-relevant code changes** — models, migrations, routes, components, tests, configs, etc.

## Steps

1. Run `git status` to see all changes (from HERE, inside the chamber)
2. Filter out pipeline artifacts
3. **Show the user the file list** and ask to confirm:

> 📂 **Files to commit (X files):**
>
> - `path/to/file1.js`
> - `path/to/file2.js`
>
> 🚫 **Excluded (Y pipeline artifacts)**
>
> ✅ **Look good? Commit and push?**

4. If confirmed, create a **commitlint-compliant** commit:

   **Commitlint rules (from `commitlint.config.js`):**
   - Format: `type(scope): subject`
   - Type: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`, `style`, `revert`
   - Scope: **lowercase** (e.g., `iw-6034`, NOT `IW-6034`)
   - Subject: **lowercase start**, no period at end, max 200 chars total

   ```bash
   git add <selected files>
   git commit -m "feat(iw-XXXX): brief description"
   git push origin HEAD
   ```

5. **Generate `OUTPUT_PR.md`** — a pre-filled PR body using the repo's PR template. Fill in:
   - Title: `IW-XXXX — description`
   - Jira link: `https://innovaresip.atlassian.net/browse/IW-XXXX`
   - Description: summary from `OUTPUT_IMPLEMENT.md` and `OUTPUT_AUDIT.md`
   - Files changed list
   - Screenshots: test proof screenshot (backend) or Loom (frontend) or both (full-stack)
   - Additional notes: deliberate deviations or important context from audit

6. Report push results and tell the user:
   - `OUTPUT_PR.md` is ready for copy-paste
   - **"Type `next` or `flare review` if you have PR review suggestions to address, or you're done!"**
