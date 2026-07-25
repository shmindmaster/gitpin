# AGENTS.md - repocontext

## What this is

MCP server giving AI agents safe, read-only, commit-pinned context across multiple local git repos. No databases. No queues. No writes. Git is the data source.

## Architecture

Flat, 4-file TypeScript application. Domain-oriented, no over-engineering.

```
src/
  server.ts     MCP server entry. 8 tools. Wires registry + git + wiki.
  registry.ts   Reads repositories.yaml. Resolves repo paths.
  git.ts        Git operations: status, commits, file read, code search, compare.
  wiki.ts       Doc discovery, cross-repo search, gap analysis, wiki.yaml parsing.
```

No subdirectories in src/. Add a module ONLY when a file exceeds ~300 lines and has a clear bounded responsibility (e.g., drift-detection.ts, knowledge-cards.ts).

## Rules

1. Read-only. Zero writes to any indexed repository.
2. Commit-pinned. Every response includes the source commit SHA.
3. Sensitive files blocked at read time (.env, credentials, keys, tokens).
4. Each repo controls exposure via docs/wiki.yaml. Default: README + docs/ only.
5. Local-first. No network calls unless the user deploys the HTTP server.
6. No databases, no cache layers, no workers. Git + filesystem + YAML.

## Commands

```bash
pnpm install
pnpm mcp:serve        # Start MCP server (stdio)
pnpm typecheck        # TypeScript strict check
pnpm test             # Run tests
pnpm build            # Compile to dist/
```

## Conventions

- TypeScript strict. No `any` in new code (existing `any` from v0.1 is grandfathered).
- Named exports only.
- Errors must be actionable: say what broke and what to do.
- Business names: `search-docs`, `detect-drift`, `analyze-gaps`. Not `utils`, `helpers`.
- One file = one responsibility. Split when >300 lines.

## Do not

- Add a database or cache (git IS the source)
- Add write operations to repos
- Create empty directories or placeholder files
- Add authentication to the stdio transport
- Split into packages, microservices, or monorepos
- Add dependencies without a documented reason in the PR
