---
description: How to use Flare Stack to work on a Jira ticket end-to-end
---

# Flare Stack — Agent Workflow

This workflow describes how Antigravity uses Flare Stack to process Jira tickets through the full AI-driven development pipeline.

## Prerequisites

- `flare.config.ts` exists in the project root (run `flare init` if not)
- Atlassian MCP server is connected (provides Jira access)
- AI model API keys are configured in environment variables

## Workflow Steps

### 1. Pull the Jira ticket via MCP

// turbo

```bash
# Use the atlassian-mcp-server MCP tools to fetch the ticket
# Tool: searchJiraIssuesUsingJql or getJiraIssue
```

Alternatively, use the programmatic API:

```typescript
import { JiraMcpSource } from "flare-stack";
const source = new JiraMcpSource(cloudId, config.jira.mcpServer);
await source.connect();
const ticket = await source.fetchIssue("PROJ-001");
```

### 2. Load the Flare config

```typescript
import { loadConfig } from "flare-stack";
const config = await loadConfig();
```

Or via CLI:
// turbo

```bash
cd /path/to/project
```

### 3. Create a worktree for the ticket

```typescript
import { createWorktree } from "flare-stack";
const worktreePath = await createWorktree("PROJ-001", repoConfig, config);
```

Or via CLI:

```bash
flare ignite PROJ-001
```

### 4. Inject prompts into the worktree

```typescript
import { injectPrompts } from "flare-stack";
await injectPrompts(worktreePath, ticket, config);
```

This copies into the worktree:

- `JIRA_TICKET.txt` — ticket details
- `1_PLAN.md` — planning prompt
- `2_VERIFY.md` — verification prompt
- `3_IMPLEMENT.md` — implementation prompt
- `4_AUDIT.md` — audit prompt
- `CODE_REVIEW_PROMPT.md` — review standards

### 5. Run the 4-phase AI pipeline

**Option A: Full pipeline (recommended)**

```bash
flare greenlight PROJ-001
```

**Option B: Individual phases**

```bash
flare plan PROJ-001        # Phase 1: Create implementation plan
flare verify PROJ-001      # Phase 2: Verify plan against standards
flare implement PROJ-001   # Phase 3: Write production code
flare audit PROJ-001       # Phase 4: Code review + greenlight/reject
```

**Option C: Programmatic**

```typescript
import { executePrompt, selectModel } from "flare-stack";

const model = selectModel("planning", config);
const response = await executePrompt(promptContent, context, model);
// response.content contains the AI output
```

### 6. Run quality gates

```bash
flare scan PROJ-001          # Scavenger: catches console.log, TODOs, any types
flare entropy PROJ-001       # Mutation testing: find test blind spots
flare vision check PROJ-001  # Visual regression testing
```

Programmatic:

```typescript
import { runScavenger, runEntropyHunter, runVisionQA } from "flare-stack";

const scanReport = await runScavenger(worktreePath, config);
const entropyReport = await runEntropyHunter(worktreePath);
const visionReport = await runVisionQA(urls, config, ticketId);
```

### 7. If GREENLIGHT → Commit and push

```bash
cd <worktree-path>
git add -A
git commit -m "feat(PROJ-001): implement ticket requirements"
git push origin feat/PROJ-001-slug
```

### 8. If REJECT → Fix issues and re-run audit

```bash
flare audit PROJ-001
```

### 9. Cleanup (optional)

```bash
flare extinguish PROJ-001       # Remove the worktree
flare holodeck freeze PROJ-001  # Or save context for later
```

## Additional Commands

| Command                  | Purpose                              |
| ------------------------ | ------------------------------------ |
| `flare status`        | See all active worktrees             |
| `flare proxy`         | Start reverse proxy for dev servers  |
| `flare mirror`        | Monitor production logs via BigQuery |
| `flare shadow <url>`  | Load test a dev server               |
| `flare loom PROJ-001` | Generate visual demo screenshots     |
| `flare dashboard`     | Launch TUI dashboard                 |
| `flare holodeck list` | See saved contexts                   |
| `flare try`           | Sandbox demo (no real repo needed)   |
