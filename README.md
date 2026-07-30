# RepoContext

[![Validate](https://github.com/shmindmaster/repocontext/actions/workflows/ci.yml/badge.svg)](https://github.com/shmindmaster/repocontext/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![MCP Protocol](https://img.shields.io/badge/MCP-1.30-blue.svg)](https://modelcontextprotocol.io)
[![npm](https://img.shields.io/npm/v/@shmindmaster/repocontext.svg)](https://www.npmjs.com/package/@shmindmaster/repocontext)

### Commit-pinned context for coding agents—read-only, multi-repo, and verifiable.

RepoContext (`@shmindmaster/repocontext`) is an open-source [MCP](https://modelcontextprotocol.io) server that gives Claude Code, Codex, Cursor, Windsurf, Zed, Continue, and other MCP clients **bounded evidence from the Git repositories you register**. Content search and read results carry a **path, line number, and full commit SHA**; catalog and comparison results stay commit-pinned. Dirty worktrees are never presented as committed truth.

> **Name is crowded.** Other projects also use “repo-context” / “RepoContext” (often with embeddings, SQLite indexes, or one-shot dumps). This package is deliberately **index-free**. See [docs/compare.md](docs/compare.md) and [competitive landscape](docs/research/competitive-landscape-corrected-2026-07-30.md).

```text
Agent question → RepoContext (Git HEAD only) → cited docs/code → you verify the SHA
```

**No database. No embeddings. No write tools. No local reindex lag.** Git and the filesystem are the source of truth.

| You want… | RepoContext |
| --- | --- |
| Multi-repo agent context without a vector index | Yes |
| Path + line + commit provenance on results | Yes |
| Agents that can edit or push your repos | No — by design |
| Semantic “find similar code” search | No — use a code-intel/RAG tool |

> **Release status (public beta):** [`@shmindmaster/repocontext`](https://www.npmjs.com/package/@shmindmaster/repocontext) is on npm (Node 20/22/24 verified). Official MCP Registry: [`io.github.shmindmaster/repocontext`](https://registry.modelcontextprotocol.io/) (v0.3.1, active). Prefer the latest published version.

RepoContext's Registry identity is `io.github.shmindmaster/repocontext`. The version-matched
[`server.json`](server.json) points Registry-capable clients to the same public npm package and canonical repository.

Product site: [shmindmaster.github.io/repocontext](https://shmindmaster.github.io/repocontext/). Website analytics are optional, cookieless, and isolated; the CLI and MCP transports contain **no telemetry**.

**Docs:** [Tools](docs/tools.md) · [Compare](docs/compare.md) · [FAQ](docs/faq.md) · [Clients](docs/clients.md) · [Troubleshooting](docs/troubleshooting.md) · [Architecture](docs/architecture.md) · [Competitive landscape](docs/research/competitive-landscape-corrected-2026-07-30.md) · [Launch notes](docs/launch.md)

## Prerequisites

- Node.js 20 or newer to run the published package
- Node.js 22.13 or newer for source development (required by pnpm 11)
- Git available on `PATH`
- pnpm 11 for source development (`corepack enable` will provide the version declared by the project)

## Start with the published package

From a committed Git repository with a README or other supported documentation, run:

```bash
npx -y @shmindmaster/repocontext@latest init --client codex
```

`init` creates `~/.repocontext/repositories.yaml` outside the indexed repository, runs the same readiness checks as
`doctor`, returns one commit-pinned documentation result, and prints a paste-ready MCP configuration. It never changes
the indexed repository. Choose `claude-code`, `codex`, `cursor`, `windsurf`, `zed`, or `continue`; repeat
`--repository <path>` to register multiple Git roots, or use `--registry <path>` for a separate registry.

An identical rerun is safe and leaves the registry unchanged. If the destination already contains different
configuration, `init` refuses to overwrite it and tells you how to choose another path.

## Install from source

```bash
git clone https://github.com/shmindmaster/repocontext.git
cd repocontext
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

Create `repocontext.repositories.yaml` in a location readable by RepoContext:

```yaml
repositories:
  - name: storefront
    path: ../storefront
    branches: [main]
  - name: api
    path: ../api
    branches: [main]
```

Paths are relative to the registry file. Each entry must be a Git repository root.

Configure an MCP client with the compiled stdio server and the registry path:

```json
{
  "mcpServers": {
    "repocontext": {
      "command": "node",
      "args": ["/absolute/path/to/repocontext/dist/server.js"],
      "env": {
        "REPOCONTEXT_REGISTRY": "/absolute/path/to/repocontext.repositories.yaml"
      }
    }
  }
}
```

For the published package, replace the source-server command with `npx` and `args: ["-y", "@shmindmaster/repocontext@latest"]`. On Windows, use `npx.cmd` when required by the client. The server uses stdio and writes protocol messages only to stdout.

Verify the registry before connecting an agent:

```bash
node dist/server.js doctor
```

`doctor` reports each repository's HEAD, documentation count, exposure confidence, and `ready`, `attention`, or `blocked` status. A stale checkout needs review; an unavailable repository or an empty registry blocks safe use.

Generate a deterministic Context Brief for a technical or cross-functional review:

```bash
node dist/server.js brief --audience technical --repository storefront
```

The JSON result separates `knownFacts`, `inferences`, and `gaps`; cites every known fact with a source path, line, and full commit SHA; and includes an `evidenceSetId` that stays the same across audience presentations. Add `--change-repository`, `--base`, and `--head` for a bounded commit-range brief. See [CI evidence-brief guidance](docs/ci.md).

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `REPOCONTEXT_REGISTRY` | Recommended | Explicit registry YAML path; conventional workspace and home paths are also discovered |
| `REPOCONTEXT_MCP_TOKEN` | HTTP only | Bearer token required by `/api/mcp` |
| `REPOCONTEXT_ALLOWED_HOSTS` | Recommended for HTTP | Comma-separated hostname allowlist; omit schemes and ports |
| `REPOCONTEXT_INDEX_PATH` | Snapshot builds only | Override the generated snapshot directory |
| `REPOCONTEXT_MCP_URL` | Remote verification only | Full `/api/mcp` endpoint checked by `pnpm verify:remote` |
| `POSTHOG_REPOCONTEXT_PROJECT_KEY` | Website build only | Optional public PostHog project key; blank keeps analytics disabled |
| `HOST` | No | HTTP bind address; defaults to `0.0.0.0` |
| `PORT` | No | HTTP listening port; defaults to `3000` |

Use [`.env.example`](.env.example) as a reference when configuring a shell, container, or hosting platform. RepoContext does not parse `.env` files itself; pass the values through the process environment and keep real tokens out of source control.

Registry paths may be relative to the registry file. See [configuration guidance](docs/configuration.md) for the complete schema and safety behavior.

## What agents get

| Tool | Useful evidence |
| --- | --- |
| `wiki.catalog` | Repository doc counts, HEAD SHA, and stale-document signals |
| `wiki.search` | Bounded documentation snippets with source path, line, and SHA |
| `wiki.get` | One commit-pinned documentation page |
| `wiki.analyze` | Documentation gaps, coverage comparison, or a deterministic source-cited Context Brief |
| `repo.inspect` | HEAD-pinned status, commits, manifests, tests, and recent changes |
| `repo.read` | Safe source slice with line numbers and provenance |
| `repo.search` | Bounded code matches with source path, line, snippet, and SHA |
| `repo.compare` | Changed paths and commit count between two hexadecimal revisions |

Every local read comes from `HEAD`; uncommitted and untracked content is excluded as evidence. When documentation changes locally, catalog results flag it as stale so agents do not mistake dirty work for committed truth. Full input/output notes: [docs/tools.md](docs/tools.md).

### Example agent prompts

```text
Use wiki.catalog (view: sync). For each repository, report name, status, docCount, and commitSha.

Search documentation for "authentication" with wiki.search. For the top hit, call wiki.get and
quote the cited lines with path, line number, and full commit SHA.

In repository <name>, use repo.search for the symbol that implements that behavior, then repo.read
a tight line range. Do not invent paths. If a path is blocked, say so.

Use repo.compare with base=<sha> and head=<sha> (full or 7+ hex characters) and summarize changed paths.
```

## Why this exists

Coding agents are powerful inside one checkout and unreliable across a real multi-repo system. Common failure modes:

- Answers that **cannot be verified** (no path, line, or commit).
- Context mixed from the **wrong branch**, a **stale index**, or a **dirty worktree**.
- Setup that needs **embeddings, workers, or write-capable** filesystem tools.

RepoContext targets a narrower job: return a small, inspectable set of evidence an agent (and a human) can re-check in Git.

**Primary audience:** developers using MCP coding agents across several local repositories.
**Secondary:** release and platform engineers who need a source-cited Context Brief; teams that require a read-only trust boundary.

See [how RepoContext compares](docs/compare.md) for filesystem MCP, GitHub MCP, and embedding indexers.

## Five-minute quick start

```bash
# 1. From a committed Git repository
npx -y @shmindmaster/repocontext@latest init --client codex

# 2. Paste the printed MCP config into your client

# 3. Ask the agent (examples)
#    - "Call wiki.catalog and list each repository with its commit SHA."
#    - "Search docs for bearer authentication and cite path, line, and SHA."
#    - "Read the matching file slice with repo.read and confirm the commit."
#    - "Compare two release SHAs with repo.compare."
```

Success looks like: a ready doctor report, a first context line with a **40-character SHA**, and eight read-only tools in the client. If anything fails, see [troubleshooting](docs/troubleshooting.md).

## Repository exposure policy

By default, RepoContext indexes supported documentation files (`.md`, `.mdx`, `.rst`, `.adoc`, `.txt`) committed anywhere in a registered repository. Add `docs/wiki.yaml` or `.repocontext/wiki.yaml` to narrow exposure:

```yaml
collections:
  - id: public-context
    include:
      - README.md
      - docs/**/*.md
safety:
  deny:
    - docs/internal/**
```

Malformed policies fail closed. Sensitive paths—including environment files, credentials, keys, tokens, and secrets—are blocked before reads and omitted from remote snapshots. See [the policy template](templates/wiki.yaml).

## Self-hosted HTTP

Stdio is the full-code transport. For a documentation-only HTTP deployment, build a HEAD-pinned snapshot and run the supplied container:

```bash
pnpm validate
pnpm index:build
docker build -f Dockerfile.remote -t repocontext:local .
docker run --rm -p 3000:3000 -e REPOCONTEXT_MCP_TOKEN="replace-with-a-strong-token" repocontext:local
```

The HTTP server exposes `GET /healthz` and bearer-authenticated `POST /api/mcp`. It contains committed documentation, selected manifests, and workflow metadata—not local source or working-tree changes. See [deployment guidance](docs/remote-deployment.md).

## What RepoContext is not

| Is | Is not |
| --- | --- |
| Deterministic Git-derived evidence | A vector database or opaque retrieval layer |
| A read-only MCP server | A repository writer, task runner, or deployment tool |
| A bounded search and context layer | A replacement for code review or testing |
| A documentation coverage signal | Proof that documentation is correct |

## Known limitations

- Local reads are pinned to the checked-out `HEAD`. Dirty and untracked work is intentionally excluded and may make `doctor` report `attention`.
- The HTTP transport serves a generated documentation and manifest snapshot, not repository source code or Git history.
- Search is deterministic text matching, not semantic or embedding-based retrieval.
- User registries containing local filesystem paths are excluded from the npm package and remote image. Snapshot builds generate a separate registry containing only image-local paths.
- Client configuration schemas are verified from current official documentation; native-client activation remains a local client check.

## Development

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm build
pnpm mcp:serve
```

| Command | Purpose |
| --- | --- |
| `pnpm lint` | Run Biome static lint rules |
| `pnpm format:check` | Verify formatting without changing files |
| `pnpm format` | Format source and configuration files |
| `pnpm typecheck` | Run strict TypeScript checks |
| `pnpm test` | Run the Vitest suite |
| `pnpm validate` | Run lint, formatting, types, client/environment/release validation, unit tests, and the site build |
| `pnpm build` | Compile the distributable JavaScript |
| `pnpm verify:package` | Pack, install, run `doctor`, and request a first MCP answer in an isolated fixture |
| `pnpm verify:container` | Build a fresh docs-only image, verify its authenticated HTTP contract, then remove the disposable container and image |
| `pnpm verify:clients` | Parse and validate the four documented client configuration blocks |
| `pnpm verify:env` | Validate the complete, secret-free environment template |
| `pnpm index:build` | Generate the commit-pinned HTTP snapshot |
| `pnpm verify:remote` | Verify a configured remote MCP endpoint |
| `pnpm site:serve` | Run the static product site locally |
| `pnpm site:test` | Run Chromium, Firefox, WebKit, and mobile browser regression tests |
| `pnpm site:build` | Build the deployable site, with analytics disabled unless configured |
| `pnpm demo:verify` | Reset an isolated synthetic Git fixture twice and prove the live MCP workflow returns stable evidence and commit references |
| `pnpm demo:record` | Produce a captioned local video candidate from the stdout of a fresh, live MCP workflow using only the synthetic fixture |

## Reproducible demo

RepoContext includes a deterministic release-evidence demonstration for contributors and maintainers. It creates three throwaway local Git repositories, including one deliberately stale worktree, then uses the built stdio MCP server to catalog sources, compare commits, and generate a Context Brief. It never reads or writes an indexed user repository.

```bash
pnpm demo:verify
pnpm demo:record
```

The video renderer writes its resettable transcript, captions, and provenance manifest under the ignored `.demo/` directory. Its master video is placed in `Videos/RepoContext` by default. The included narration is local synthetic speech and the fixture is visibly disclosed; a named human watch-through is still required before external publication. The storyboard, truth sheet, and claim ledger are in [docs/demos](docs/demos).

Maintainers prepare a release with `pnpm install --frozen-lockfile`, `pnpm validate`, `pnpm build`, `pnpm verify:package`, and `npm pack --dry-run --json`. A tag-triggered OIDC workflow is included; npm package ownership and the `release.yml` trusted-publisher relationship must be configured before the first tag is pushed.

For help, use [GitHub issues](https://github.com/shmindmaster/repocontext/issues). See [client setup](docs/clients.md), [website and analytics](docs/website.md), [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [ROADMAP.md](ROADMAP.md), and [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
