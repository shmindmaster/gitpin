# repocontext

Personal MCP server for cross-repo context across my product portfolio.

Gives AI coding agents (Claude Code, Cursor, Codex, OpenCode) safe, read-only access to documentation and code across the local SHMindMaster portfolio (product apps + tooling). Replaces the old ShWiki for agent context.

## What it does

- **8 MCP tools**: wiki.catalog, wiki.search, wiki.get, wiki.analyze, repo.inspect, repo.read, repo.search, repo.compare
- **Cross-repo search**: "How does auth work across all repos?" gets a real answer from actual code
- **Doc gap analysis**: "Which repos are missing architecture docs?"
- **Commit-pinned**: Every response says which commit the data came from
- **Read-only**: Zero writes to any repository. Ever.

## Quick start

```bash
cd C:\Repos\shmindmaster\repocontext
pnpm install
pnpm mcp:serve    # starts stdio MCP server with 8 tools
```

Configure `registry/repositories.yaml` to point at your repos (already configured for mine).

## Structure

```
src/
  server.ts     MCP entry point. 8 tools.
  registry.ts   Reads repositories.yaml.
  git.ts        Git operations (read-only, safe).
  wiki.ts       Doc discovery + search + gap analysis.
registry/repositories.yaml   Which repos to index.
templates/wiki.yaml          Per-repo exposure template.
```

## Validate

```bash
pnpm validate   # typecheck + tests
```

## Not public

This is a personal tool. It works for this machine’s portfolio layout (Windows, local git paths in `registry/repositories.yaml`). Not optimized for general distribution. If you want something similar for public use, check out [jCodeMunch](https://github.com/jgravelle/jcodemunch-mcp), [GitNexus](https://github.com/AugmendTech/gitnexus), or [claude-context](https://github.com/zilliztech/claude-context).
