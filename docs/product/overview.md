# Product Overview

GitPin is an index-free, read-only MCP server for multi-repo evidence pinned to Git
HEAD.

## Positioning

Compete on **verifiable HEAD evidence**, not generic repo context. Every answer carries
path, line, and a full commit SHA, so agents can prove the claims they make about code.
The product loop is `pin.catalog` -> search candidates -> `pin.prove` -> `pin.verify`;
for multi-repo decisions, prefer an `EvidenceBrief`.

## What it provides

- `pin.*` MCP tools (catalog, search, prove, verify, evidence) over a set of Git roots
  declared in `repositories.yaml`.
- A `gitpin` CLI (`init` / `doctor` / `brief` / `verify`) for evidence-gated workflows.
- A PR evidence gate (`action.yml` + `templates/gate.yml`) so change claims are verified
  at exact commits before merge.
- Local stdio (source-capable) and a bearer-authenticated Streamable HTTP transport
  (docs/manifests only) for remote use.

## Production surface

- **npm:** `gitpin` (published from tagged releases on `main`).
- **Site:** `https://shmindmaster.github.io/gitpin/` (GitHub Pages).
- **MCP Registry:** `io.github.shmindmaster/gitpin`.
- **CI/CD:** GitHub Actions — `ci.yml`, `evidence-gate.yml`, `pages.yml`,
  `publish-mcp.yml`, `release.yml`.

## Non-goals

- No databases, caches, workers, or embeddings.
- No write tools or side effects against indexed repositories (read-only by contract).
- No generic repo-context product; the value is pinned, verifiable evidence.
