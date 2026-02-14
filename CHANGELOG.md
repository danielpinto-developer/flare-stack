# Changelog

All notable changes to Flare Stack will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-02-10

### Added

- **19 CLI commands**: `init`, `spawn`, `destroy`, `status`, `greenlight`, `plan`, `verify`, `implement`, `audit`, `scan`, `vision`, `entropy`, `proxy`, `mirror`, `shadow`, `holodeck`, `loom`, `dashboard`, `try`
- **Programmatic API**: Full ESM exports from `src/index.ts` for agent integration
- **AI Executor**: Multi-provider support (Google Gemini, Anthropic Claude, OpenAI, local/Ollama)
- **Jira MCP Source**: Primary ticket source via Model Context Protocol
- **Jira REST API Source**: Fallback ticket source via direct REST API
- **Git Worktree Manager**: Parallel branch management per ticket
- **Prompt Injector**: Injects JIRA context + prompt lifecycle files into worktrees
- **Model Router**: Intelligent model selection by task phase and tier
- **Config System**: Zod-validated config with GCP and Community presets
- **Quality Gates**: Scavenger (code analysis), Vision QA (visual regression), Entropy Hunter (mutation testing)
- **Infrastructure**: Proxy Router (per-worktree dev servers), Context Holodeck (save/restore), Production Mirror (BigQuery logs)
- **Extras**: Shadow Load Tester (stress testing), Loom Generator (demo recording)
- **Dashboard**: Ink TUI + chalk fallback for real-time status
- **Agent Workflow**: `.agent/workflows/flare.md` for Antigravity IDE integration
- **CI/CD**: GitHub Actions pipeline with Node 20/22 matrix, TypeScript check, Prettier lint
- **Test Suite**: 18 test files, 114 tests covering all modules
- **Project Hygiene**: `.editorconfig`, `.prettierrc`, `CHANGELOG.md`

### Architecture

- ESM-only TypeScript project
- Dual-mode: CLI tool + programmatic library
- 4-phase AI pipeline: Plan → Verify → Implement → Audit
- MCP-first Jira integration with REST API fallback
