# AGENTS.md — repocontext

## Mission

repocontext is an open-source MCP server that gives AI agents safe, searchable,
commit-pinned context across a developer's entire multi-repo codebase.

Read this file, the README, and package.json before making any change.

## Architecture

Domain-oriented modular monolith. One MCP server process. Zero workers, zero queues,
zero databases. Git repos are the data source — repocontext reads, never writes.

```
src/
├── app/                    # Entry points (mcp-server.ts)
├── modules/
│   ├── indexing/           # Build catalog.json + documents.json from repos
│   ├── search/             # Cross-repo doc search + gap analysis
│   ├── repo-inspection/    # Status, commits, manifests, tests, changes
│   ├── drift-detection/    # Cross-repo schema/contract/token mismatch alerts
│   └── knowledge-cards/    # Per-module deep understanding with annotations
├── platform/
│   ├── git/                # Git operations via simple-git (read-only)
│   ├── config/             # Registry parsing (repositories.yaml)
│   ├── mcp/                # MCP transport (stdio + HTTP)
│   └── safety/             # Path traversal prevention, sensitive file blocking
├── tests/
└── docs/
```

## Rules

1. **Read-only.** repocontext never writes to any indexed repository. Zero exceptions.
2. **Commit-pinned.** Every response must include the commit SHA the data came from.
3. **Secrets blocked.** .env, credentials, tokens, keys — scanned and blocked at read time.
4. **Manifest-controlled.** Each repo's wiki.yaml controls what gets exposed. Default: README only.
5. **Local-first.** Indexing runs on the developer's machine. Nothing leaves unless they deploy the HTTP server.
6. **Simple.** No microservices, no queues, no databases, no Kubernetes. Git repos + YAML + TypeScript.

## Commands

```bash
pnpm install
pnpm dev              # Start MCP server (stdio)
pnpm test             # Run tests
pnpm build            # Production build
pnpm typecheck        # TypeScript check
pnpm lint             # ESLint
```

## Conventions

- TypeScript strict mode. No `any`. No `@ts-ignore`.
- Named exports. No default exports.
- Error messages must be actionable: say what went wrong and what to do about it.
- Tests in tests/ mirroring src/ structure.
- Docs in docs/. One canonical source per subject.
- Business-oriented names: `search-docs`, `detect-drift`, `analyze-gaps`. Not `utils`, `helpers`, `manager`.

## Do not

- Add a database or cache layer (git IS the data source)
- Add write operations to any git repo
- Add authentication complexity for the local stdio mode
- Create parallel structures for the same concept
- Add dependencies without a documented reason
