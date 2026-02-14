# Security Policy

## Supported Versions

| Version | Supported         |
| ------- | ----------------- |
| 1.x     | ✅ Active support |

## Reporting a Vulnerability

If you discover a security vulnerability in Flare Stack, please report it responsibly.

**Do NOT open a public issue.**

Instead, please email or contact [@danielpinto-developer](https://github.com/danielpinto-developer) directly via GitHub with:

1. A description of the vulnerability
2. Steps to reproduce it
3. Any potential impact

We will acknowledge receipt within **48 hours** and aim to provide a fix or mitigation plan within **7 days**.

## Scope

Flare Stack is a CLI development tool that runs locally. Security concerns primarily relate to:

- **API key handling** — Flare Stack reads API keys from environment variables. Keys are never logged, stored, or transmitted beyond their intended LLM provider.
- **Git operations** — Flare Stack creates worktrees and branches. It does not modify files outside the designated `flare-chambers/` directory.
- **Dependency supply chain** — We monitor dependencies for known vulnerabilities.

## Best Practices

- Never commit API keys. Use environment variables or `.env` files (included in `.gitignore`).
- Review AI-generated code before merging to production.
- Keep dependencies updated: `npm audit` regularly.
