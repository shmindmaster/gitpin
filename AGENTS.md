# AGENTS.md - GitPin

## What this is

**GitPin** is an index-free, read-only MCP server for multi-repo evidence pinned to Git HEAD. Answers carry path, line, and full SHA. It has no databases, embeddings, queues, or write tools.
GitPin 0.6.0 is the shipped required PR evidence gate: required changed-path coverage, commit-pinned locators at full SHA, and read-only MCP support for traceable claim retrieval.

Package: `gitpin`. Tools: `pin.*`. CLI: `gitpin`.

## Architecture

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

One bounded responsibility per file. No monorepo packages.

## Rules

1. Read-only. Zero writes to indexed repositories.
2. Commit-pinned. Content answers include full SHA; blocked/unavailable are explicit.
3. Sensitive paths blocked at read time.
4. Exposure via `docs/wiki.yaml` or `.gitpin/wiki.yaml` (`.repocontext/wiki.yaml` remains a migration alias).
5. Local stdio may expose source; HTTP image is docs/manifests only.
6. No databases, caches, workers, or embeddings.
7. Registry entries point only to Git roots.
8. HTTP requires a bearer token; never commit it.

## Commands

```bash
pnpm install
pnpm mcp:serve
pnpm validate
pnpm build
pnpm verify:package
pnpm site:test
```

## Product pivot (0.4)

Compete on **verifiable HEAD evidence**, not generic repo context. Product loop: `pin.catalog` -> search candidates -> `pin.prove` -> `pin.verify`. Prefer EvidenceBrief for multi-repo decisions. Do not ship rename-only changes without functionality that forces prove/verify behavior.
