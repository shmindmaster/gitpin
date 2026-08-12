# Setup and Development

How to get the `gitpin` project running locally.

## Prerequisites

- Node.js `>=20` (the repo uses `pnpm@11.15.0`).
- `pnpm` 11.x (see `packageManager` in `package.json`).

## Install

```bash
pnpm install
```

## Canonical commands

```bash
pnpm mcp:serve             # run the MCP server (stdio) via tsx
pnpm mcp:http              # run the HTTP transport
pnpm doctor:check          # CLI doctor check
pnpm build                 # compile src/ to dist/ (tsc)
pnpm validate              # full gate: lint + format + typecheck + verifiers + tests + site build + gate demo
pnpm site:serve            # serve the site/ source tree for local preview
pnpm site:build            # build the deployable static site in .site-dist/
pnpm site:test             # Playwright suite against the site
```

Scoped tooling:

```bash
pnpm lint                  # biome lint
pnpm format                # biome format --write
pnpm typecheck             # tsc --noEmit
pnpm test                  # vitest run src
```

## Environment

Copy `.env.example` if a local env is needed. Never commit `.env`, `.env.*` (except
`.env.example`), `*.secret.*`, `*.key`, `*.pem`, or `*.p12`. The HTTP bearer token is a
runtime secret and must never be committed or logged.

## Working with demo/fixture tooling

`scripts/` holds demo, verification, and build helpers. The demo recorder
(`scripts/record-demo-qwen.ps1`) reads `LOCAL_AI_ROOT` for the local AI runtime; do not
reintroduce hardcoded `D:\AI-Platform`-style fallbacks. Local generated state
(`.repocontext-index/`, `.demo/`, `.site-dist/`, `.repowise/`) stays gitignored.

## Verification before commit

- `pnpm validate` (full gate)
- `pnpm site:test` when the site changes
- `pnpm build` + `pnpm verify:package` when the publish surface changes
- `git status` clean on `main`
