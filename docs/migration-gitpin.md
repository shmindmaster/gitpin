# Migration: RepoContext → GitPin (0.4.0)

## Why (product pivot, not just rename)

The name “RepoContext” collides with many open-source tools (often embedding-index or dump products). GitPin exits that category:

| Pivot layer | Change |
| --- | --- |
| **Product** | Trust / evidence for coding agents — not “more context” |
| **Differentiation** | Index-free HEAD-only; prove → verify loop; dirty never evidence |
| **Features** | `pin.prove` evidence packs, `pin.verify`, EvidenceBrief, candidate search |
| **Functionality** | Structured `kind` / `contract` / `citation.cite` / `next` on tool responses |
| **Naming** | `@shmindmaster/gitpin`, `pin.*`, `GITPIN_*` |

## What changed

| Item | 0.3.x | 0.4.0 |
| --- | --- | --- |
| npm package | `@shmindmaster/repocontext` | `@shmindmaster/gitpin` |
| CLI | `repocontext` | `gitpin` (`repocontext` bin alias kept temporarily) |
| MCP name | `io.github.shmindmaster/repocontext` | `io.github.shmindmaster/gitpin` |
| Tools | `wiki.*` / `repo.*` (8) | `pin.*` (12) including prove/verify and prove_set/verify_set |
| Brief type | `ContextBrief` schema v1 | `EvidenceBrief` schema v2 (`product`, `contract`) |
| Search responses | Raw hit arrays | `evidence-candidates` envelope with `next` → prove |
| Env | `REPOCONTEXT_*` | `GITPIN_*` (old names still accepted) |
| Config dir | `~/.repocontext` | `~/.gitpin` (old path still discovered) |

## Client config

```bash
npx -y @shmindmaster/gitpin@latest init --client codex
```

Or update MCP config:

```json
{
  "mcpServers": {
    "gitpin": {
      "command": "npx",
      "args": ["-y", "@shmindmaster/gitpin@latest"],
      "env": {
        "GITPIN_REGISTRY": "/absolute/path/to/repositories.yaml"
      }
    }
  }
}
```

Remove the old `repocontext` server entry to avoid dual servers.

## Tool call mapping

| Old | New |
| --- | --- |
| `wiki.catalog` | `pin.catalog` |
| `wiki.search` | `pin.search_docs` |
| `wiki.get` | `pin.get_doc` |
| `wiki.analyze` | `pin.analyze` |
| `repo.inspect` | `pin.inspect` |
| `repo.read` | `pin.read` |
| `repo.search` | `pin.search_code` |
| `repo.compare` | `pin.compare` |
| — | `pin.prove` (evidence pack; primary claim tool) |
| — | `pin.verify` (independent git show re-check) |

## Publishing

1. Publish `@shmindmaster/gitpin@0.4.0` via the tag workflow.
2. Optionally deprecate `@shmindmaster/repocontext` on npm with a message pointing at GitPin.
3. Publish MCP Registry metadata for `io.github.shmindmaster/gitpin`.
4. GitHub repository folder may remain `repocontext` until a deliberate GitHub rename; product branding is GitPin everywhere user-facing.
