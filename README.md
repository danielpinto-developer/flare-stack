# 🔥 FLARE STACK

> **Ship a sprint in a day.** Isolated AI chambers per ticket. The workflow Git never gave you.
>
> Every ticket gets its own isolated chamber — its own branch, its own AI, its own pipeline. Use the **CLI** to type commands or the **Operator** to speak naturally. Same engine. Your choice.

[![npm version](https://img.shields.io/npm/v/flare-stack)](https://npmjs.com/package/flare-stack)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-160%20passing-brightgreen)]()

---

## 🔖 Feature Maturity

> Flare Stack uses maturity badges to signal what's battle-tested vs. what's still being hardened. This follows the [open-source convention](https://shields.io/) used by projects like React, Vite, and Deno.

| Badge                                                                    | Meaning                                                               |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| ![Stable](https://img.shields.io/badge/status-stable-brightgreen)        | Battle-tested. Used in real workflows. You can rely on this today.    |
| ![Tested](https://img.shields.io/badge/status-tested-blue)               | Unit tests pass, but not yet verified end-to-end in real-world usage. |
| ![Experimental](https://img.shields.io/badge/status-experimental-orange) | Implemented and functional, but not fully tested. API may change.     |

---

## 🏭 The Problem: One Ticket at a Time

One branch. One ticket. One developer sitting in one checkout wondering why the backlog never shrinks. It's been this way since version control was invented — and nobody's questioned it until now.

The tools got better. The editors got smarter. The AI got faster. But the workflow? Same loop. Same stash. Same pain.

`git stash && git checkout feature-x && git stash pop` — a ritual so old it's practically folklore. Context lost. Flow obliterated.

**That ritual ends here.**

Flare Stack gives every sprint ticket its own isolated **chamber** — its own Git Worktree, its own branch, its own AI pipeline, its own prompt files. No more stashing. No more switching. Five tickets live at the same time. Ten. Twenty. All of them ready, all the time, zero context switching.

```bash
# Ignite the backlog
flare ignite

# Or skip the menus and go full bore
flare ignite --queue
```

```
flare-chambers/
├── TICKET-001/my-app/         ← Isolated chamber, its own branch
├── TICKET-002/my-app/         ← Another chamber, fully independent
└── TICKET-003/my-backend/     ← Different repo? No problem
    ├── 1_PLAN.md                ← Ignition planning prompt
    ├── 2_VERIFY.md              ← Safety check prompt
    ├── 3_IMPLEMENT.md           ← Combustion prompt
    ├── 4_AUDIT.md               ← Quality control gate
    └── CODE_REVIEW_PROMPT.md    ← Your repo's standards, enforced
```

Done with a ticket? Generate visual proof before shipping:

```bash
flare loom TICKET-001    # Records a Loom video walkthrough of every page
```

---

## 🛠️ The Arsenal

> Features marked with 🧪 are **experimental** — implemented and functional, but not yet covered by comprehensive automated tests. Use them, but expect refinement.

![Stable](https://img.shields.io/badge/status-stable-brightgreen) **Chamber Management** — The foundation. Create isolated worktrees, inject AI prompts, track pipeline state, destroy chambers. This is the core engine — battle-tested with 136+ unit and integration tests.

![Stable](https://img.shields.io/badge/status-stable-brightgreen) **Jira Integration (MCP)** — Connect directly to Jira via MCP protocol. Fetch tickets, auto-transition status, add comments. Fully tested.

---

![Experimental](https://img.shields.io/badge/status-experimental-orange) **AI Combustion Cycle** — The full PLAN → VERIFY → IMPLEMENT → AUDIT pipeline driven by `flare burn`. The pipeline state tracking, phase sequencing, and prompt injection are all stable and tested. The AI execution layer (LLM calls, model routing) is functional but test coverage is partial.

![Experimental](https://img.shields.io/badge/status-experimental-orange) **Forge** — Iterative frontend UI refinement loop. Accepts screenshots and Figma URLs, runs AI to produce incremental fixes. Functional, but no dedicated test suite yet.

![Experimental](https://img.shields.io/badge/status-experimental-orange) **Fix** — Re-runs the last completed phase with natural language corrections. Functional, no dedicated test suite yet.

---

![Tested](https://img.shields.io/badge/status-tested-blue) **Entropy Hunter** — Mutation testing that injects faults and verifies your tests catch them. Tests pass (7 tests), not yet verified in real-world usage.

![Tested](https://img.shields.io/badge/status-tested-blue) **Vision QA** — Playwright-powered screenshot diffing. Capture baselines, catch visual regressions. Tests pass (2 tests), not yet verified in real-world usage.

![Experimental](https://img.shields.io/badge/status-experimental-orange) **Scavenger** 🧹 — Hunts toxic waste: `console.log`, commented code, untyped `any`, TODOs without tickets. Functional, but test suite currently has import issues being resolved.

![Tested](https://img.shields.io/badge/status-tested-blue) **Shadow Load** — Concurrent request stress testing. p95/p99 latency, success rates, status breakdowns. Tests pass (6 tests), not yet verified in real-world usage.

![Tested](https://img.shields.io/badge/status-tested-blue) **Context Holodeck** — Freeze/restore your full working state (env vars, ports, git state) per chamber. Tests pass (2 tests), not yet verified in real-world usage.

![Tested](https://img.shields.io/badge/status-tested-blue) **Production Mirror** — Query production logs via BigQuery. Detect anomalies and error spikes. Tests pass (4 tests), not yet verified in real-world usage.

![Tested](https://img.shields.io/badge/status-tested-blue) **Proxy Router** — Per-chamber dev server routing. No port conflicts. Tests pass (1 test), not yet verified in real-world usage.

![Experimental](https://img.shields.io/badge/status-experimental-orange) **Dashboard** — Real-time TUI dashboard showing every chamber and its cycle progress. Functional, no dedicated tests.

![Tested](https://img.shields.io/badge/status-tested-blue) **Loom Generator** — Records video walkthroughs of your running app for PR reviews. Tests pass (4 tests), not yet verified in real-world usage.

![Experimental](https://img.shields.io/badge/status-experimental-orange) **TTS Narrator** 🧪 — AI-generated narration for Loom videos. Script-first pipeline: Jira AC/DoD → AI script → user review → Stagehand agent → Kokoro TTS → ffmpeg merge. Tests pass (11 tests) but end-to-end pipeline requires external dependencies (`ffmpeg`, Stagehand, `kokoro-js`).

---

## 🔥 Why "Flare Stack"?

Why "Flare Stack"? Because pressure kills. In a refinery, the flare stack is the last line of defense — it burns off what the system can't hold. Sprint backlogs work the same way. Tickets pile up, deadlines tighten, and the pressure never stops building. You need a release.

AI moved the finish line. What used to take a sprint can ship in a day — if the workflow lets you. **Ship daily, not bi-weekly.** That's not a slogan. That's what the right tooling makes possible.

Flare Stack gives you **parallel combustion.** `flare ignite` creates isolated chambers — each with its own branch, its own prompts, its own AI pipeline. Five tickets burning simultaneously. Ten. Twenty. Each in its own sealed chamber. `cd` into any of them. They're all live, all the time. Open a terminal tab per ticket and you're working all of them at once.

### Three workflow paths — same engine

**Chamber Management** ![Stable](https://img.shields.io/badge/-stable-brightgreen) is what you get right now, fully tested. Create isolated worktrees, inject prompts, manage lifecycle. This is the foundation everything else sits on.

**AI Combustion Cycle** ![Experimental](https://img.shields.io/badge/-experimental-orange) is the full autonomous pipeline (`flare burn`). PLAN → VERIFY → IMPLEMENT → AUDIT. The state machine, phase tracking, and prompt injection are all battle-tested. The AI execution itself works but is still being hardened.

**Forge Loop** ![Experimental](https://img.shields.io/badge/-experimental-orange) is iterative UI refinement (`flare forge`). Give feedback + screenshots + Figma URLs, and the AI produces incremental improvements. Functional but not yet covered by automated tests.

### Two interfaces — same engine

**The CLI** is terminal-first. Type commands, get output, move fast. `flare ignite`, `flare burn`, `flare extinguish`. If you live in the terminal, this is home.

**The Operator** is voice and natural language. Powered by Gemini. "What's the status of chamber 5?" "Ignite the next three tickets." No commands to memorize. No tabs to juggle. Speak to your sprint.

Both paths run the same combustion cycle, the same quality gates, produce the same output. Pick the interface that fits how you work.

```
┌─────────────────────────────────────────────────────────────────┐
│                      FLARE STACK                                 │
│                                                                  │
│  HOW YOU OPERATE ─ Three workflows, same engine                  │
│                                                                  │
│  🖥️  Single Terminal   │  📑 Tab per Ticket   │  🤖 Agent Mgr    │
│     One terminal,      │     One tab per      │     AI manages   │
│     flare next to      │     chamber, cd in   │     the full     │
│     step through       │     and work them    │     burn cycle   │
│     each phase         │     in parallel      │     autonomously │
├─────────────────────────────────────────────────────────────────┤
│                   COMBUSTION CYCLE 🧪                             │
│                                                                  │
│  PLAN ────→ VERIFY ────→ IMPLEMENT ────→ AUDIT                   │
│  (Flash)     (Low)        (High)          (High)                 │
│                                                                  │
│  State tracked per chamber (.flare-state.json)                   │
│  Picks up where you left off. Always.                            │
├─────────────────────────────────────────────────────────────────┤
│               QUALITY GATES (Mixed Maturity)                      │
│  Entropy 🔵 │ Vision 🔵 │ Scavenger 🧪 │ Prod Mirror 🔵          │
├─────────────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE ✅                                │
│  Git Worktrees │ Proxy Router 🔵 │ Context Holodeck 🔵           │
└─────────────────────────────────────────────────────────────────┘
```

### 🖥️ Three Ways to Operate

**1. Single Terminal** — Stay in one window and step through each chamber manually. `flare next` advances the current phase. You control the pace.

**2. Tab per Ticket** — After `flare ignite`, the CLI prints `cd` commands for every chamber. Open a terminal tab per ticket, paste, and you're in. All chambers live at the same time:

```bash
flare ignite --queue

# Output:
#   🔥 Open a new tab and jump in:
#
#   cd ~/flare-chambers/TICKET-001/my-app  # TICKET-001
#   cd ~/flare-chambers/TICKET-002/my-app  # TICKET-002
#   cd ~/flare-chambers/TICKET-003/my-api  # TICKET-003
```

The CLI auto-detects which ticket you're working on from your current directory — no flags, no configuration, just `cd` in and go.

**3. Agent Manager** 🧪 — Let the AI run the full combustion cycle autonomously. `flare burn TICKET-001` fires PLAN → VERIFY → IMPLEMENT → AUDIT without manual intervention. You review at the end.

### 🔥 How You Operate

You don't write every line — you direct the system and the AI writes the syntax. The combustion cycle (PLAN → VERIFY → IMPLEMENT → AUDIT) catches everything in dev mode before it ships. The loop: prompt → run → error → paste → fix → ship. Nothing raw hits production.

**Four interfaces to the same engine:**

- **Interactive CLI** — `flare ignite` launches arrow-key menus, auto-detects your ticket from CWD
- **Classic CLI** — `flare burn TICKET-001` for scripting and CI/CD
- **The Operator** — Voice and natural language, powered by Gemini
- **Programmatic API** — `import { createWorktree, injectPrompts } from 'flare-stack'`

**All four share the same engine. Same combustion cycle. Same quality gates. Same output.**

---

## 📦 Installation

```bash
npm install -g flare-stack
```

Or run it without installing:

```bash
npx flare-stack init
```

---

## 🧪 Try It (Zero Config)

```bash
# Spin up a sandbox demo in 60 seconds
flare try

# Done exploring? Clean up
flare try --clean
```

Creates a temporary Git repo with sample tickets, prompt files, and a config — no API keys, no setup, no commitment. See how it burns before connecting to your real project.

---

## ⚡ Quick Start

### Step 0: Install

> **Important:** Clone flare-stack to its own folder — NOT inside your project repo.

```bash
# Not inside your project repo — Flare lives in its own folder
cd ~/Documents

# Grab it
git clone https://github.com/danielpinto-developer/flare-stack.git
cd flare-stack

# Install, build, link — done
npm install
npm run build
npm link
```

That's it. `flare` is now a global CLI command. Head to your project:

```bash
cd ~/Documents/your-project
```

### Step 1: Initialize

```bash
# Community preset (works with any stack)
flare init

# Or GCP-native preset (Vertex AI, Cloud Run, BigQuery)
flare init --gcp
```

This generates `flare.config.ts`. Point it at your repos and you're ready.

### Step 2: Add to Your `.env`

Flare Stack auto-loads `.env` from your project root. Add ONE LLM key:

```bash
# AI Provider — pick ONE (any works for ticket routing)
GEMINI_API_KEY=your-gemini-key              # Google Gemini
# OPENAI_API_KEY=sk-...                     # OpenAI
# ANTHROPIC_API_KEY=sk-ant-...              # Anthropic

# Loom (optional, for flare loom uploads)
# LOOM_API_KEY=your-loom-api-key
```

No `export`. No `source`. Flare auto-detects which provider you're using.

### Step 3: Ignite

Tickets come from Jira automatically (MCP is the default). Just ignite:

```bash
# Interactive mode — arrow-key menus, no memorizing flags
flare ignite           # Pick: Jira queue / single ticket / manual entry
flare burn             # Auto-detects ticket from CWD, or pick one
flare next             # Auto-advances to the next combustion phase
flare extinguish       # Pick a chamber to tear down

# Classic mode — flags for scripting & CI/CD
flare ignite --queue
flare burn TICKET-001
flare extinguish --all --yes

# Check plant status
flare status
```

---

## 🔥 The 4-Stage Combustion Cycle

> ![Experimental](https://img.shields.io/badge/status-experimental-orange) The AI combustion cycle is functional but not fully covered by automated tests. The state machine, phase tracking, and prompt injection used by this cycle are all stable and tested.

Every ticket runs through a **4-stage combustion cycle** — each stage uses the right AI model for the job:

| Stage               | Prompt           | Model Tier   | Purpose                                                     |
| ------------------- | ---------------- | ------------ | ----------------------------------------------------------- |
| 🔥 **Ignition**     | `1_PLAN.md`      | Gemini Flash | Break down the fuel — ticket requirements into a plan       |
| 🔍 **Safety Check** | `2_VERIFY.md`    | Gemini Low   | Check for leaks — quintuple-check against codebase patterns |
| ⚡ **Combustion**   | `3_IMPLEMENT.md` | Gemini High  | The main burn — write production code that matches exactly  |
| 🛡️ **QC**           | `4_AUDIT.md`     | Gemini High  | Strict quality control — 0–100 score per requirement        |

**Why different tiers?** Planning is cheap and iterative — use Flash. Safety checks need pattern matching — use Low. Combustion and QC demand precision — use High. This is the **80/20 Rule** applied to AI costs: spend where it matters.

The planning stage estimates **Jira points** (1 pt = 4h) with automatic buffers for UI/Figma (+1 pt) and full-stack work (+1 pt). Estimation is [configurable](#-estimation-config).

The QC stage scores **every requirement from your Jira ticket** individually (0–100) with file/line evidence. **90+** = Greenlight. **70–89** = Conditional. **<70** = Reject. No handwaving — every score comes with proof.

The `burn` command runs all 4 stages via AI end-to-end. It **remembers progress** in `.flare-state.json` — if it fails midway, re-run and it picks up exactly where it left off. Use `--dry-run` to preview, `--restart` to start fresh.

---

## 🛡️ Embedded Safety Rules

Three rules are hardwired into the combustion cycle — the AI follows these every time, no exceptions:

| Rule                    | Prompt                         | What It Enforces                                                                                       |
| ----------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **Branch Workflow**     | `1_PLAN.md` + `3_IMPLEMENT.md` | Asks for source branch first. No commits until GREENLIGHT. Conventional commits only.                  |
| **Pattern Adherence**   | `2_VERIFY.md`                  | Quintuple-checks existing patterns, variables, DB names. Senior full-stack quality. Ask, don't assume. |
| **Word-for-Word Audit** | `4_AUDIT.md`                   | Direct quotes from ticket, file:line evidence, confidence score, and "Why" for every incomplete item.  |

`[SOURCE_BRANCH]` in prompts is replaced dynamically at injection time from `ticket.sourceBranch` (set by LLM routing from `repos.*.branches`). If neither is set, the AI asks you directly — no guessing.

---

## ⌘ Every CLI Command

Every command works in two modes: **interactive** (no args → arrow-key menus) and **explicit** (flags for scripting and CI/CD).

### Core Operations ![Stable](https://img.shields.io/badge/-stable-brightgreen)

| Command                        | Description                                        |
| ------------------------------ | -------------------------------------------------- |
| `flare init`                   | Interactive setup (or `--gcp` / `--force`)         |
| `flare ignite`                 | 🔥 Pick: Jira queue / single ticket / manual entry |
| `flare ignite --queue`         | Ignite every ticket from your queue file           |
| `flare ignite <ticketId>`      | Ignite a chamber for one specific ticket           |
| `flare status`                 | See every active chamber at a glance               |
| `flare status --models`        | Show your current model routing config             |
| `flare extinguish`             | 🧯 Pick a chamber to tear down, or nuke them all   |
| `flare extinguish --all --yes` | Clean slate — everything gone, no prompt           |
| `flare nuke`                   | 🧹 Selectively remove stale chambers               |
| `flare try`                    | Zero-config sandbox demo — try before you burn     |

### Combustion Cycle ![Experimental](https://img.shields.io/badge/-experimental-orange)

| Command                  | Description                                            |
| ------------------------ | ------------------------------------------------------ |
| `flare burn`             | 🔥 Full PLAN→VERIFY→IMPLEMENT→AUDIT cycle              |
| `flare burn <ticketId>`  | Run combustion cycle for a specific ticket             |
| `flare burn --restart`   | Wipe state and re-run the cycle from scratch           |
| `flare burn --dry-run`   | Preview the cycle without executing anything           |
| `flare greenlight`       | 🟢 Final approval gate — review outputs and push       |
| `flare next`             | ⏭️ Auto-advance to the next stage (state-aware)        |
| `flare plan`             | Run ignition planning only (auto-detects from CWD)     |
| `flare verify`           | Run safety check only                                  |
| `flare implement`        | Run combustion only                                    |
| `flare audit`            | Run QC only                                            |
| `flare forge`            | 🔨 Iterative UI refinement (screenshot + Figma)        |
| `flare fix "correction"` | ✏️ Re-run last phase with natural language corrections |

### Quality Gates

| Command                      | Status | Description                                  |
| ---------------------------- | ------ | -------------------------------------------- |
| `flare scan <ticketId>`      | 🧪     | Run scavenger on chamber                     |
| `flare scan --dir ./path`    | 🧪     | Scan any directory for toxic waste           |
| `flare vision baseline <id>` | ✅     | Capture reference screenshots (Playwright)   |
| `flare vision check <id>`    | ✅     | Optical inspection against baselines         |
| `flare entropy <ticketId>`   | ✅     | Structural integrity test (mutation testing) |

### Infrastructure & Extras

| Command                       | Status | Description                                              |
| ----------------------------- | ------ | -------------------------------------------------------- |
| `flare proxy`                 | ✅     | Start per-chamber pressure routing (no port conflicts)   |
| `flare proxy --routes`        | ✅     | Show the current routing table                           |
| `flare mirror`                | ✅     | Pull production logs via BigQuery and spot anomalies     |
| `flare holodeck freeze <id>`  | ✅     | Cryo-preserve your full context (env, ports, git state)  |
| `flare holodeck restore <id>` | ✅     | Bring it all back, exactly as you left it                |
| `flare holodeck list`         | ✅     | See every preserved snapshot                             |
| `flare shadow <url>`          | ✅     | Hydraulic pressure test — concurrent request stress test |
| `flare loom <ticketId>`       | ✅     | Record a Loom video walkthrough of your changes          |
| `flare loom --narrate`        | 🧪     | AI-narrated Loom video (Kokoro TTS + Stagehand agent)    |
| `flare dashboard`             | 🧪     | Control room — every chamber, every cycle, one view      |

> **Legend:** ✅ = stable & tested | 🧪 = experimental (functional, tests in progress)

---

## ⚙️ Configuration Reference

Create `flare.config.ts` in your project root (`flare init` generates this for you):

```typescript
export default {
  // Where chambers are created
  workspacesDir: "./flare-chambers",

  // Repository configurations
  repos: {
    "my-app": {
      path: "../my-app", // Path to the repo
      branches: ["develop", "main"], // Active branches (LLM picks from these)
      codeReviewPrompt: "./prompts/CODE_REVIEW.md",
      ports: { client: 3000, server: 3001 },
      startCommand: "npm run dev",
      testCommand: "npm test",
    },
  },

  // Jira integration
  jira: {
    projectKeys: ["PROJ"],
    ticketPrefix: "PROJ",
    source: "mcp",
    autoComment: false,
    autoTransition: false,
    estimation: {
      pointsPerHour: 4,
      maxPointsPerTicket: 8,
      buffers: { ui: 1, fullStack: 1 },
    },
  },

  // AI model routing per combustion stage
  models: {
    planning: {
      provider: "google",
      model: "gemini-2.0-flash",
      tier: "flash",
      temperature: 0.1,
    },
    verification: {
      provider: "google",
      model: "gemini-2.5-pro",
      tier: "low",
      temperature: 0,
    },
    implementation: {
      provider: "google",
      model: "gemini-2.5-pro",
      tier: "high",
      temperature: 0.1,
    },
    audit: {
      provider: "google",
      model: "gemini-2.5-pro",
      tier: "high",
      temperature: 0,
    },
  },

  // Prompt file names
  prompts: {
    plan: "1_PLAN.md",
    verify: "2_VERIFY.md",
    implement: "3_IMPLEMENT.md",
    audit: "4_AUDIT.md",
  },

  // Branch naming
  branching: {
    pattern: "feat/{ticketId}-{slug}",
    slugSource: "ticketId-only",
  },

  // Infrastructure metadata
  infra: {
    cloud: "gcp",
    runtime: "cloud-run",
    database: "postgres",
    ci: "github-actions",
  },

  // Proxy router
  proxy: { enabled: false, baseDomain: "localhost", port: 9000 },
};
```

### AI Provider Options

| Provider         | Config Value  | Required Env Var    | Routing Model    |
| ---------------- | ------------- | ------------------- | ---------------- |
| Google Gemini    | `"google"`    | `GEMINI_API_KEY`    | gemini-2.0-flash |
| OpenAI           | `"openai"`    | `OPENAI_API_KEY`    | gpt-4o-mini      |
| Anthropic Claude | `"anthropic"` | `ANTHROPIC_API_KEY` | claude-sonnet    |

---

## 🔌 Programmatic API

Drop Flare Stack into your own scripts, CI/CD pipelines, or AI agents as a library:

```typescript
import {
  // Config
  loadConfig,
  clearConfigCache,
  FlareConfig,
  FlareConfigSchema,

  // Chamber management
  createWorktree,
  destroyWorktree,
  destroyAllWorktrees,
  listWorktrees,

  // Prompt injection
  injectPrompts,
  InjectionResult,

  // AI execution
  executePrompt,
  logAIResponse,
  AIResponse,

  // Model routing
  selectModel,
  logModelSelection,
  ModelConfig,

  // Quality gates
  runScavengerBot,
  ScavengerReport,
  runVisionQA,
  VisionReport,
  runEntropyHunter,
  EntropyReport,

  // Infrastructure
  startProxyRouter,
  printRouteTable,
  ProxyRouterResult,
  freezeContext,
  restoreContext,
  listContexts,
  HolodeckState,
  queryProductionLogs,
  AnomalyReport,

  // Extras
  runShadowLoad,
  LoadTestReport,
  runLoomGenerator,
  uploadToLoom,
  DemoReport,
  generateNarration, // 🧪 TTS narrator
  NarrationScene, // 🧪

  // Sources
  JiraMcpSource,
} from "flare-stack";

// Example: Agent workflow
const config = await loadConfig();
const chamberPath = await createWorktree("TICKET-001", "my-app", config);
const injection = await injectPrompts(ticket, chamberPath, config);
console.log(`Injected ${injection.filesInjected.length} files`);
```

### Return Types

Every core function returns a structured object (not `void`) — built for agent consumption and pipeline chaining:

| Function                | Returns                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| `createWorktree()`      | `string` (chamber path)                                                        |
| `injectPrompts()`       | `InjectionResult` `{ ticketId, worktreePath, filesInjected[], hasImages }`     |
| `executePrompt()`       | `AIResponse` `{ content, provider, model, duration, tokensUsed? }`             |
| `runScavengerBot()`     | `ScavengerReport` `{ files, violations[], score }`                             |
| `runEntropyHunter()`    | `EntropyReport` `{ mutations[], killed, survived, score }`                     |
| `runShadowLoad()`       | `LoadTestReport` `{ totalRequests, successRate, avgResponseTime, p95, p99 }`   |
| `queryProductionLogs()` | `AnomalyReport` `{ patterns[], anomalies[], suggestions[] }`                   |
| `freezeContext()`       | `HolodeckState` `{ ticketId, branch, gitStatus, environment }`                 |
| `startProxyRouter()`    | `ProxyRouterResult \| null` `{ port, baseDomain, routeCount, routes, server }` |

---

## 🎫 Jira Integration

Flare Stack connects to Jira via MCP (Model Context Protocol). Set `jira.cloudId` in your config. Flare Stack spawns its own Atlassian MCP server as a subprocess and talks to it via stdio transport. Tickets flow straight from your Jira board — no API keys, no files, no copy-pasting.

```typescript
jira: {
  cloudId: 'your-cloud-id',  // Required
  projectKeys: ['IW'],
  source: 'mcp',
}
```

To find your `cloudId`, visit: `https://your-org.atlassian.net/_edge/tenant_info`

---

## 🧩 Works With Your Stack

| Stack            | Description                   |
| ---------------- | ----------------------------- |
| `react-node`     | React SPA + Express/Sequelize |
| `python-fastapi` | Python + FastAPI + SQLAlchemy |
| `next-node`      | Next.js monolith              |
| `vue-node`       | Vue + Express                 |
| `custom`         | Your stack, your rules        |

---

## 🧪 Testing

```bash
# Run the full suite
npm test

# Run with coverage report
npm test -- --coverage

# Target a specific test file
npx vitest run tests/ai-executor.test.ts
```

**24 test files. 136 tests passing across 18 stable modules.**

| Module                   | Tests | Status                      |
| ------------------------ | ----- | --------------------------- |
| CLI Integration          | 22    | ✅                          |
| Config (schema + loader) | 15    | ✅                          |
| Pipeline Phases          | 12    | ✅                          |
| TTS Narrator             | 11    | ✅                          |
| Entropy Hunter           | 7     | ✅                          |
| Shadow Load              | 6     | ✅                          |
| Try Sandbox              | 6     | ✅                          |
| Init                     | 4     | ✅                          |
| Loom Generator           | 4     | ✅                          |
| Next Command             | 4     | ✅                          |
| Production Mirror        | 4     | ✅                          |
| Worktree Manager         | 4     | ✅                          |
| Jira Estimation          | 3     | ✅                          |
| Jira MCP Source          | 3     | ✅                          |
| Holodeck                 | 2     | ✅                          |
| Vision QA                | 2     | ✅                          |
| Proxy Router             | 1     | ✅                          |
| AI Executor              | 8     | 🧪 (1 test needs env fix)   |
| Greenlight               | 7     | 🧪 (command name refactor)  |
| Model Router             | 8     | 🧪 (model defaults updated) |
| Prompt Injector          | 6     | 🧪 (mock path issue)        |
| Scavenger                | 9     | 🧪 (import refactor)        |
| Public API               | 5     | 🧪 (export name sync)       |

---

## 📜 Philosophy

1. **We create burn zones, not branches.** Zero-latency context switching. Every ticket lives in its own sealed chamber.
2. **The combustion cycle catches everything.** PLAN → VERIFY → IMPLEMENT → AUDIT. Every stage is a quality gate. Nothing raw hits production.
3. **AI never acts alone.** No pushing, no merging, no Jira posts without your explicit confirmation.
4. **If something breaks, we tell you.** No silent fallbacks. No swallowed errors. No manual modes you didn't ask for.
5. **Flare remembers.** State-aware pipelines. Re-run and it resumes from where you left off. Always.
6. **Smart fuel routing.** Fast models for planning. Precise models for combustion. Never overpay for tokens.
7. **Production awareness.** Mirror real production patterns into dev. Test what actually breaks.
8. **Context preservation.** Switch chambers and your full environment (env vars, ports, git state) is cryo-preserved and restored.
9. **Start anywhere.** `flare try` for a demo. The CLI for terminal ops. The Operator for voice. Same engine, your choice.
10. **The output is what matters.** Whether you write code line by line or direct AI to write it, the combustion cycle enforces the same standard.

---

## 🤝 Contributing

```bash
# Grab the repo
git clone https://github.com/danielpinto-developer/flare-stack.git
cd flare-stack

# Install
npm install

# Build
npm run build

# Run the test suite
npm test

# Try the CLI locally
node dist/cli.js --help
```

PRs welcome. Every engineer I've ever talked to works one ticket at a time. Managing multiple sprint tickets simultaneously shouldn't be this hard — so I built Flare Stack.

---

## 📄 License

MIT — _Pressure builds with every ticket. That's what the flare stack is for. The new industry standard._

---

**[danielpinto-developer](https://github.com/danielpinto-developer)** • Powered by Antigravity
