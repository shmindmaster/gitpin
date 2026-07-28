# RepoContext

[![Validate](https://github.com/shmindmaster/repocontext/actions/workflows/ci.yml/badge.svg)](https://github.com/shmindmaster/repocontext/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![MCP Protocol](https://img.shields.io/badge/MCP-1.30-blue.svg)](https://modelcontextprotocol.io)

### Give coding agents commit-pinned answers from the repositories that matter.

RepoContext is an open-source MCP server for teams that want Claude Code, Codex, Cursor, and other MCP clients to navigate multiple repositories without guessing. It returns bounded, read-only evidence with repository paths, line numbers, and Git commit SHAs.

```text
Agent question → RepoContext → commit-pinned docs and code evidence → answer you can verify
```

No database. No embeddings. No write tools. Git remains the source of truth.

> **Release status:** RepoContext 0.2 is a release candidate. Its source, tests, build, and packed-package flow are validated, but the npm package has not been published yet. Install from source until the first public package release is announced in this repository.

## Prerequisites

- Node.js 20 or newer
- Git available on `PATH`
- pnpm 11 for source development (`corepack enable` will provide the version declared by the project)

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

After the package is published, the command can be replaced with `npx -y repocontext`. On Windows, use `npx.cmd` when required by the client. The server uses stdio and writes protocol messages only to stdout.

Verify the registry before connecting an agent:

```bash
node dist/server.js doctor
```

`doctor` reports each repository's HEAD, documentation count, exposure confidence, and `ready`, `attention`, or `blocked` status. A stale checkout needs review; an unavailable repository or an empty registry blocks safe use.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `REPOCONTEXT_REGISTRY` | Yes for normal use | Absolute path to the repository registry YAML |
| `REPOCONTEXT_MCP_TOKEN` | HTTP only | Bearer token required by `/api/mcp` |
| `REPOCONTEXT_ALLOWED_HOSTS` | Recommended for HTTP | Comma-separated host allowlist |
| `PORT` | No | HTTP listening port; defaults to `3000` |

Registry paths may be relative to the registry file. See [configuration guidance](docs/configuration.md) for the complete schema and safety behavior.

## What agents get

| Tool | Useful evidence |
| --- | --- |
| `wiki.catalog` | Repository doc counts, HEAD SHA, and stale-document signals |
| `wiki.search` | Bounded documentation snippets with source path, line, and SHA |
| `wiki.get` | One commit-pinned documentation page |
| `wiki.analyze` | Missing README, architecture, agent instructions, and development guide coverage |
| `repo.inspect` | HEAD-pinned status, commits, manifests, tests, and recent changes |
| `repo.read` | Safe source slice with line numbers and provenance |
| `repo.search` | Bounded code matches with source path, line, snippet, and SHA |
| `repo.compare` | Changed paths and commit count between two revisions |

Every local read comes from `HEAD`; uncommitted and untracked content is excluded. When documentation changes locally, catalog results flag it as stale so agents do not mistake old committed evidence for current work.

## Why this exists

Coding agents are powerful inside one checkout and unreliable across a real system. The useful answer is rarely “search everything”; it is a small, inspectable set of evidence:

- Which service owns this behavior?
- What does the architecture document actually say at the current revision?
- Where is the implementation, and what changed between two commits?
- Which repositories are missing the documentation an agent needs to work safely?

RepoContext is built for those questions.

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

- The npm package is not published yet; source installation is the supported release-candidate path.
- Local reads are pinned to the checked-out `HEAD`. Dirty and untracked work is intentionally excluded and may make `doctor` report `attention`.
- The HTTP transport serves a generated documentation and manifest snapshot, not repository source code or Git history.
- Search is deterministic text matching, not semantic or embedding-based retrieval.
- Registries contain local filesystem paths and are intentionally excluded from the npm package and remote image.

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
| `pnpm validate` | Run lint, formatting, types, and tests |
| `pnpm build` | Compile the distributable JavaScript |
| `pnpm verify:package` | Pack, install, run `doctor`, and request a first MCP answer in an isolated fixture |
| `pnpm index:build` | Generate the commit-pinned HTTP snapshot |
| `pnpm verify:remote` | Verify a configured remote MCP endpoint |

Maintainers prepare a release with `pnpm install --frozen-lockfile`, `pnpm validate`, `pnpm build`, `pnpm verify:package`, and `npm pack --dry-run --json`. Package publication and GitHub release creation are manual owner actions until a reviewed trusted-publishing workflow exists.

For help, use [GitHub Discussions or issues](https://github.com/shmindmaster/repocontext/issues) as appropriate. See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow, [SECURITY.md](SECURITY.md) for private vulnerability reporting, [ROADMAP.md](ROADMAP.md) for planned work, and [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

[MIT](LICENSE)
