# AGENTS.md - repocontext

## What this is

MCP server giving AI agents safe, read-only, commit-pinned context across multiple local git repos. No databases. No queues. No writes. Git is the data source.

## Architecture

Small, domain-oriented TypeScript application with one shared MCP contract and two transports.

```
src/
  server.ts     Shared 8-tool MCP contract and stdio entry point.
  http.ts       Bearer-authenticated Streamable HTTP transport.
  snapshot.ts   Git-only, commit-pinned HTTP snapshot builder.
  registry.ts   Reads repositories.yaml and resolves local/snapshot modes.
  git*.ts       Read-only Git content, history, and inspection operations.
  wiki*.ts      Doc discovery, cross-repo search, gap analysis, and indexing.
```

Keep one bounded responsibility per file. Do not split into packages or services.

## Rules

1. Read-only. Zero writes to any indexed repository.
2. Commit-pinned. Every response includes the source commit SHA.
3. Sensitive files blocked at read time (.env, credentials, keys, tokens).
4. Each repo may control exposure via docs/wiki.yaml. Default: supported documentation files across the repository.
5. Local stdio may expose source code. The HTTP image exposes only the generated documentation/manifests snapshot.
6. No databases, no cache layers, no workers. Git + filesystem + YAML.
7. The registry contains Git repository roots only. Non-Git umbrella folders are not indexed.
8. HTTP requests require bearer authentication; never log or commit its token.

## Commands

```bash
pnpm install
pnpm mcp:serve        # Start MCP server (stdio)
pnpm mcp:http         # Start authenticated HTTP server
pnpm index:build      # Build HEAD-pinned HTTP snapshot
pnpm lint             # Biome static lint rules
pnpm format:check     # Verify formatting
pnpm typecheck        # TypeScript strict check
pnpm test             # vitest unit tests
pnpm validate         # lint + format + typecheck + test
pnpm build            # Compile to dist/
pnpm verify:package   # Packed install-to-first-answer check
```

Starter registry: `registry/repositories.yaml`. User registries may use paths relative to the registry file or absolute paths.

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
- Put source files, dirty work, untracked files, secrets, or local absolute paths in the remote image
- Split into packages, microservices, or monorepos
- Add dependencies without a documented reason in the PR
