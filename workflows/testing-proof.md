---
description: How to run tests and produce screenshot-ready proof for PRs — REQUIRED for every greenlight
---

# Testing Proof for PRs

Every PR needs a **screenshot-ready terminal output** proving the tests pass. This is NOT optional — it's a hard requirement before greenlight.

---

## Repo-Specific Templates

### 🏢 `inno` Repo (Node.js / Sequelize / Jest)

#### Pre-requisites

- `/opt/homebrew/bin` in PATH (Homebrew Node)
- Docker running with `inno-db-1` Postgres container
- `--forceExit` flag required (Sequelize leaves connections open)

#### One-time setup

```bash
# Start the Postgres container (if stopped)
docker start inno-db-1

# Create the test database (if it doesn't exist)
docker exec inno-db-1 psql -U docker -c "CREATE DATABASE inno_test;"
```

#### Full Proof Command Template (copy & customize)

```bash
export PATH="/opt/homebrew/bin:$PATH" && \
SEGMENT_WRITE_KEY=dummy NODE_ENV=test npx jest \
  --testPathPattern="<TEST-FILE-PATTERN>" \
  --verbose --forceExit 2>&1 | tee /tmp/<TICKET-ID>-tests.txt; \
echo ""; \
echo "══════════════════════════════════════════════════════════"; \
echo "🔒 LOCAL TEST DB ONLY (inno-db-1 Docker, 127.0.0.1:4321)"; \
echo "══════════════════════════════════════════════════════════"; \
echo ""; \
echo "🎯🎯🎯 <TICKET-ID> PROOF — ONLY THESE <N> TESTS ARE NEW 🎯🎯🎯"; \
echo ""; \
grep -E "<KEYWORD1>|<KEYWORD2>|<KEYWORD3>" /tmp/<TICKET-ID>-tests.txt; \
echo ""; \
echo "  ✅ <test name 1>  → <plain English what it proves>"; \
echo "  ✅ <test name 2>  → <plain English what it proves>"; \
echo "  ✅ <test name 3>  → <plain English what it proves>"; \
echo "  ✅ <test name 4>  → <plain English what it proves>"; \
echo ""; \
echo "══════════════════════════════════════════════════════════"; \
echo "  🟢🟢🟢 ALL <N> NEW TESTS PASSING — <TICKET-ID> COMPLETE 🟢🟢🟢"; \
echo "══════════════════════════════════════════════════════════"
```

#### Real Example: IW-6034

```bash
export PATH="/opt/homebrew/bin:$PATH" && \
SEGMENT_WRITE_KEY=dummy NODE_ENV=test npx jest \
  --testPathPattern="ciwp-models" \
  --verbose --forceExit 2>&1 | tee /tmp/iw6034-tests.txt; \
echo ""; \
echo "══════════════════════════════════════════════════════════"; \
echo "🔒 LOCAL TEST DB ONLY (inno-db-1 Docker, 127.0.0.1:4321)"; \
echo "══════════════════════════════════════════════════════════"; \
echo ""; \
echo "🎯🎯🎯 IW-6034 PROOF — ONLY THESE 4 TESTS ARE NEW 🎯🎯🎯"; \
echo ""; \
grep -E "recommendationId|source ENUM|adoptedFromPipeline|indexes on recommendation" /tmp/iw6034-tests.txt; \
echo ""; \
echo "  ✅ recommendationId field           → NEW analytics tracking field added"; \
echo "  ✅ source ENUM with correct values   → 3 creation sources defined"; \
echo "  ✅ adoptedFromPipeline ENUM          → 3 pipeline types defined"; \
echo "  ✅ indexes on recommendationId+source → fast query lookup ready"; \
echo ""; \
echo "══════════════════════════════════════════════════════════"; \
echo "  🟢🟢🟢 ALL 4 NEW TESTS PASSING — IW-6034 COMPLETE 🟢🟢🟢"; \
echo "══════════════════════════════════════════════════════════"
```

---

### 🐍 `CIWP-Backend` Repo (Python / FastAPI / pytest)

_Template TBD — will be added with first ticket for this repo._

### 🤖 `agents-ai-pilot` Repo (Node.js / GCP)

_Template TBD — will be added with first ticket for this repo._

---

## Rules (ALL repos)

1. **ALWAYS run tests from inside the chamber worktree** — never the main repo
2. **ALWAYS use the visual proof template** — emojis, plain English, QA-friendly
3. **ALWAYS highlight ONLY the new ticket-specific tests** with the 🎯 block
4. **ALWAYS include plain English descriptions** of what each test proves (non-devs read PRs too)
5. **ALWAYS show the 🔒 local DB line** to prove no prod/staging was touched
6. **The full suite MUST also pass** — if existing tests break, the PR is not ready
7. **User screenshots the bottom section** (from the first `══════` down) for the PR

## What goes in the PR

1. **Screenshot of the 🎯 proof block** → paste into "Screenshots" section
2. **Loom recording** (if frontend changes) → paste into "Loom Videos" section
3. **For backend-only PRs** → test screenshot is sufficient proof
