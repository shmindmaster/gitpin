# Migration: RepoContext to GitPin (0.5.3)

## Why (product pivot, not just rename)

The name “RepoContext” collides with many open-source tools (often embedding-index or dump products). GitPin exits that category:

| Pivot layer | Change |
| --- | --- |
| **Product** | Trust / evidence for coding agents — not “more context” |
| **Differentiation** | Index-free HEAD-only; prove → verify loop; dirty never evidence |
| **Features** | `pin.prove` evidence packs, `pin.verify`, EvidenceBrief, candidate search |
| **Functionality** | Structured `kind` / `contract` / `citation.cite` / `next` on tool responses |
| **Naming** | `gitpin`, `pin.*`, `GITPIN_*` |

## What changed

| Item | 0.3.x RepoContext | 0.5.3 GitPin |
| --- | --- | --- |
| npm package | `@shmindmaster/repocontext` | `gitpin` |
| CLI | `repocontext` | `gitpin` (`repocontext` bin alias kept temporarily) |
| MCP name | `io.github.shmindmaster/repocontext` | `io.github.shmindmaster/gitpin` |
| Tools | `wiki.*` / `repo.*` (8) | `pin.*` (12) including prove/verify and prove_set/verify_set |
| Brief type | `ContextBrief` schema v1 | `EvidenceBrief` schema v2 (`product`, `contract`) |
| Search responses | Raw hit arrays | `evidence-candidates` envelope with `next` → prove |
| Env | `REPOCONTEXT_*` | `GITPIN_*` (old names still accepted) |
| Config dir | `~/.repocontext` | `~/.gitpin` (old path still discovered) |

## Client config

```bash
npx -y gitpin@0.6.3 init --client codex
```

Or update MCP config:

```json
{
  "mcpServers": {
    "gitpin": {
      "command": "npx",
      "args": ["-y", "gitpin@0.6.3"],
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

1. Publish `gitpin@0.5.3` via the tag workflow to verify npm trusted publishing end to end.
2. Optionally deprecate `@shmindmaster/repocontext` on npm with a message pointing at GitPin.
3. Publish MCP Registry metadata for `io.github.shmindmaster/gitpin`.
4. ~~GitHub repository folder may remain `repocontext` until a deliberate GitHub rename~~ — done on 2026-07-31. The repository is `shmindmaster/gitpin` and the site is `shmindmaster.github.io/gitpin/`. GitHub redirects the old paths, but every tracked URL now points at the new name directly.

## What deliberately still says `repocontext`

Per the table above, these are back-compat surfaces and are **not** bugs:

- the `repocontext` bin alias in `package.json`
- `REPOCONTEXT_*` environment variables (still accepted alongside `GITPIN_*`)
- `~/.repocontext` config discovery
- CHANGELOG entries describing 0.3.x, which are a historical record

The compatibility aliases above are intentionally limited to backwards-compatible entry points.
Verified demo/tooling `REPOCONTEXT_*` compatibility usage is limited to the following explicit entries:

- `scripts/demo-fixture.mjs`: `REPOCONTEXT_DEMO_ROOT` (legacy demo fixture root path override).
- `scripts/demo-terminal.ps1`: `REPOCONTEXT_DEMO_PACE_MS` (legacy pacing shim for demo terminal runs).
- `scripts/demo-workflow.mjs`: fallback reads `REPOCONTEXT_DEMO_PACE_MS` when `GITPIN_DEMO_PACE_MS` is absent.
- `scripts/record-demo.mjs`: `REPOCONTEXT_DEMO_VIDEO_DIR`, `REPOCONTEXT_DEMO_NARRATION_PROVIDER` (legacy video/narration overrides).
- `scripts/record-demo-qwen.ps1`: `REPOCONTEXT_DEMO_NARRATION_PROVIDER`, `REPOCONTEXT_QWEN_TTS_PYTHON`, `REPOCONTEXT_QWEN_TTS_CLI`.
- `scripts/verify-container.mjs`: `REPOCONTEXT_CONTAINER_PORT` (legacy fallback when `GITPIN_CONTAINER_PORT` is absent).
- `scripts/verify-package.mjs`: `REPOCONTEXT_PACKED_FIRST_ANSWER` marker and `REPOCONTEXT_PACKAGE_TARBALL`.
- `scripts/verify-citations.mjs`: `REPOCONTEXT_REGISTRY` (migration reference in compatibility help text).

Other `REPOCONTEXT_*` uses outside this list are not authorized as customer-facing compatibility features and should be treated as migration or internal implementation context only.
