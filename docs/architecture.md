# Architecture

repocontext is a local-first MCP server that indexes multiple git repositories and exposes them through 8 read-only tools to any MCP-compatible AI agent.

## System boundary

```
[Your Git Repos] --read--> [repocontext] --MCP stdio--> [Claude / Codex / Cursor / any MCP client]
```

repocontext sits between your local repos and your AI coding agent. It reads; it never writes.

## Components

| File | Responsibility |
|------|---------------|
| `src/server.ts` | MCP protocol handler. Registers 8 tools. Entry point. |
| `src/registry.ts` | Parses `registry/repositories.yaml`. Resolves repo names to paths. |
| `src/git.ts` | All git operations via simple-git + git grep. File reads with path traversal prevention. |
| `src/wiki.ts` | Markdown doc discovery, cross-repo search, gap analysis. Respects wiki.yaml exposure. |

## Data flow

1. `registry/repositories.yaml` lists repos to index (name + path + branches)
2. `wiki.ts` walks each repo's filesystem, discovers .md files respecting exposure rules
3. `git.ts` provides repo status, commit history, file reads, code search, commit comparison
4. `server.ts` exposes everything through the MCP tool protocol

## Security model

- **Path traversal prevention**: `repo.read` blocks paths that resolve outside the repo root.
- **Sensitive file blocking**: .env, credentials, keys, tokens are never returned.
- **Read-only by design**: Zero write operations in the entire codebase.
- **Exposure control**: Each repo's `docs/wiki.yaml` or `.repocontext/wiki.yaml` limits what's visible.
- **No network calls**: Everything runs on the local filesystem.

## MCP tools (8, all read-only)

| Tool | Purpose |
|------|---------|
| wiki.catalog | List repos, sync status, staleness |
| wiki.search | Cross-repo documentation search |
| wiki.get | Read one doc with commit trace |
| wiki.analyze | Gap analysis + coverage comparison |
| repo.inspect | Status, commits, manifest, tests, changes |
| repo.read | Safe file slice at current commit |
| repo.search | git grep with bounded results |
| repo.compare | Diff file lists between two commits |

## Deployment

Primary (only supported path today): local stdio MCP, configured in the coding-agent MCP config. No network listener, no auth surface.

There is no HTTP transport and no cloud deploy path. Do not add multi-host deploy configs until an HTTP transport exists and is needed.

## What this is NOT

- Not a documentation generator (it reads existing docs, doesn't generate new ones)
- Not a vector database or semantic search engine (it's keyword-based, fast, deterministic)
- Not a code analysis tool (it doesn't parse ASTs or run linters)
- Not a public SaaS product (personal portfolio tool)
- Not a replacement for IDE features (it serves AI agents that can't see your filesystem otherwise)
