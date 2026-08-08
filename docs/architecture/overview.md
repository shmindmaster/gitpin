# Architecture Overview

GitPin is a single TypeScript package with one bounded responsibility per file and no
monorepo packages. The detailed architecture reference is `docs/architecture.md`.

## Module map

```
src/
  server.ts     Shared pin.* MCP contract and stdio entry
  http.ts       Bearer-authenticated Streamable HTTP transport
  snapshot.ts   Docs/manifests snapshot builder
  registry.ts   repositories.yaml multi-repo Git roots
  git*.ts       HEAD-pinned source operations
  wiki*.ts      Documentation catalog/search/gaps/brief
  cli.ts        init / doctor / brief / verify
```

## Invariants

1. Read-only: zero writes to indexed repositories.
2. Commit-pinned: content answers include full SHA; blocked/unavailable are explicit.
3. Sensitive paths are blocked at read time.
4. Local stdio may expose source; the HTTP image serves docs/manifests only.
5. No databases, caches, workers, or embeddings.
6. Registry entries point only to Git roots.
7. HTTP requires a bearer token; never commit it.

## Key contracts

- `repositories.yaml` (or `registry/repositories.yaml`) declares the Git roots.
- `docs/wiki.yaml` / `.gitpin/wiki.yaml` expose documentation to the wiki tools
  (`.repocontext/wiki.yaml` remains a migration alias); `templates/wiki.yaml` is the
  schema template shipped to consumers.
- `action.yml` + `templates/gate.yml` implement the PR evidence gate.
- `server.json` carries MCP server metadata.
- `package.json` `files` pins the publish surface; `scripts/verify-package.mjs`
  enforces it.

## Build and verify

- `pnpm build` compiles `src/` to `dist/` (`tsc`).
- `pnpm validate` runs the full gate: lint, format check, typecheck, client/CI/env/MCP
  registry/release-tag verifiers, the vitest suite, site build, and the artifact-gate
  demo.
- `pnpm site:build` builds the static site from `site/`; `pnpm site:test` runs Playwright
  against it.
