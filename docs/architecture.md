# Architecture

RepoContext is a compact TypeScript MCP server for commit-pinned repository context. It has one eight-tool contract and two transports.

```text
Local Git repositories ──read HEAD──> RepoContext stdio ──> coding agent

Committed docs and manifests ──build snapshot──> authenticated HTTP ──> coding agent
```

## Design rules

- Git and the filesystem are the only data sources; there is no database, embedding index, queue, or background worker.
- Repository reads are pinned to `HEAD`. Dirty and untracked content is never presented as source evidence.
- Each result carries source provenance. Search results include a source path and line; document and file reads include a commit SHA.
- The server exposes eight read-only MCP tools. It does not edit repositories, run arbitrary commands, or deploy applications.
- Sensitive paths are rejected at read time. Invalid exposure policies fail closed.

## Modules

| Module | Responsibility |
| --- | --- |
| `src/server.ts` | Shared MCP tool contract and stdio entry point |
| `src/http.ts` | Bearer-authenticated Streamable HTTP transport and health endpoint |
| `src/registry.ts` | Loads a portable YAML registry and resolves paths relative to it |
| `src/git.ts` | Commit-pinned repository inspection, source reads, search, and comparison |
| `src/wiki.ts` | Metadata-first documentation catalog, bounded search, page reads, and gap analysis |
| `src/policy.ts` | Exposure-policy parsing and hard sensitive-path denial |
| `src/snapshot.ts` | Builds a documentation/manifests-only remote image from Git HEAD |

## Data flow

1. A registry names Git roots and allowed branches.
2. Catalog reads Git trees and status metadata, not every document body.
3. Documentation search returns a bounded set of matching snippets.
4. File and page reads retrieve the requested bytes from `HEAD` with their commit SHA.
5. The snapshot builder copies only selected committed files, records provenance, and runs gitleaks before producing a container input.

## Limits

- Documentation pages are capped at 100 KB.
- Documentation and code search results are bounded to avoid flooding an MCP context window.
- Remote snapshots deliberately omit source files and commit history; use stdio when source search or comparison is needed.
