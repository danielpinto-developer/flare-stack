# Contributing to Flare Stack

Thanks for wanting to contribute to Flare Stack! Every PR improves the engine for everyone.

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.0.0
- **npm** (comes with Node.js)
- **Git** with worktree support

### Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/flare-stack.git
cd flare-stack

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## Branch Convention

- **`main`** — production, protected. You cannot push directly.
- **`develop`** — integration branch. Submit PRs here.
- **Feature branches** — branch off `develop` with a descriptive name.

```bash
git checkout develop
git checkout -b feat/my-feature
```

## Submitting a PR

1. **Fork** the repo and create your branch from `develop`.
2. **Write tests** for any new functionality.
3. **Run the test suite** — all 160 tests must pass:
   ```bash
   npm test
   ```
4. **Run the type checker** — zero errors:
   ```bash
   npm run lint
   ```
5. **Open a PR** against `develop` (not `main`).

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new command
fix: resolve timeout issue
docs: update README
test: add scavenger unit tests
refactor: simplify model router
chore: update dependencies
```

## Code Style

- **TypeScript** — strict mode, no `any` unless absolutely necessary.
- **ESM** — all imports use `.js` extensions.
- **Prettier** — formatting is handled by `.prettierrc`. Run `npx prettier --write .` before committing.
- **EditorConfig** — see `.editorconfig` for indentation rules.

## Project Structure

```
src/
├── commands/       # CLI commands (Commander.js)
├── config/         # Config loading and schema validation
├── core/           # Core engine (worktrees, AI executor, pipeline)
├── extras/         # Loom generator, shadow load, TTS narrator
├── quality/        # Entropy hunter, scavenger, vision QA
├── sources/        # Jira MCP integration
└── ui/             # Dashboard (Ink/React TUI)
tests/              # Vitest test suites
prompts/            # AI pipeline prompt templates
workflows/          # Flare workflow documentation
```

## Testing

Tests use [Vitest](https://vitest.dev/). Every module should have a corresponding test file in `tests/`.

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run a specific test file
npx vitest run tests/worktree-manager.test.ts
```

## Feature Maturity

New features should include a maturity badge in the README:

- ![Stable](https://img.shields.io/badge/status-stable-brightgreen) — battle-tested with comprehensive tests
- ![Tested](https://img.shields.io/badge/status-tested-blue) — unit tests pass, not yet verified end-to-end
- ![Experimental](https://img.shields.io/badge/status-experimental-orange) — functional, but tests may be incomplete

## Questions?

Open an issue or start a discussion. We're happy to help.
