# MCP tool reference

RepoContext exposes eight read-only MCP tools plus one catalog resource and one documentation-audit prompt. Every successful content result that comes from Git includes a full commit SHA. Blocked, missing, or unavailable cases return explicit errors or empty evidence instead of inventing content.

All tools advertise `readOnlyHint: true`, `destructiveHint: false`, and `openWorldHint: false`.

## Documentation tools

### `wiki.catalog`

| | |
| --- | --- |
| **Job** | See which registered repositories are ready and how much documentation they expose. |
| **Input** | `view`: `repositories` (default), `sync`, or `stale`. |
| **Output** | Repository name, status, documentation count, HEAD SHA, stale flag, confidence. |
| **Provenance** | Catalog rows carry each repository's current HEAD SHA. |
| **Failure modes** | Empty registry, unavailable path, or non-Git root appears as blocked/unavailable rather than silent omission when listed. |

Example agent request: “List every registered repository and flag stale documentation.”

### `wiki.search`

| | |
| --- | --- |
| **Job** | Find documentation snippets across one or all repositories. |
| **Input** | `query` (1–200 characters); optional `repository`. |
| **Output** | Bounded hits with source path, line, snippet, commit SHA, and confidence. |
| **Provenance** | Each hit is from Git HEAD (or the snapshot component SHA in remote mode). |
| **Failure modes** | No matches return an empty list; denied paths never appear. |

Example: “Search all docs for bearer authentication.”

### `wiki.get`

| | |
| --- | --- |
| **Job** | Read one documentation page with its commit trace. |
| **Input** | `repository`, `sourcePath`. |
| **Output** | Title, body, commit SHA, confidence — or null/blocked when missing or denied. |
| **Provenance** | Page body is read with `git show HEAD:path` (local) or the snapshot file + recorded SHA. |

Example: “Open `docs/architecture.md` in the api repository.”

### `wiki.analyze`

| | |
| --- | --- |
| **Job** | Documentation gaps, coverage comparison, or a source-cited Context Brief. |
| **Input** | Discriminated `operation`: `gaps`, `compare`, or `brief`. Brief accepts `audience` and optional `changeRange` with hex revisions. |
| **Output** | Gap rows, comparison matrix, or a brief with `knownFacts`, `inferences`, `gaps`, `evidenceSetId`, and technical traces. |
| **Provenance** | Every known fact cites path, line, and full SHA. `evidenceSetId` is stable across audiences for the same evidence set. |

Example: “Generate a technical Context Brief for storefront and api.”

## Source tools

### `repo.inspect`

| | |
| --- | --- |
| **Job** | Inspect status, recent commits, manifests, tests, or recent changes without reading whole trees. |
| **Input** | `repository`; `operation`: `status` \| `commits` \| `manifest` \| `tests` \| `changes`; optional `limit` 1–50. |
| **Output** | Operation-specific JSON pinned to HEAD metadata. |
| **Notes** | Status may report dirty working-tree counts; content tools still serve HEAD only. |

### `repo.read`

| | |
| --- | --- |
| **Job** | Read a safe source slice with line numbers. |
| **Input** | `repository`, `sourcePath`; optional `lineStart` / `lineEnd`. |
| **Output** | Numbered lines, path, commit SHA — or a blocked response for sensitive or out-of-root paths. |
| **Security** | Always-deny patterns (`.env*`, credentials, keys, tokens, secrets) fail closed. Path traversal outside the repository root is rejected. |

### `repo.search`

| | |
| --- | --- |
| **Job** | Bounded code search with `git grep` at HEAD. |
| **Input** | `repository`, `query` (1–200). |
| **Output** | Up to 50 hits with path, line, snippet, and SHA. Sensitive paths are filtered. |

### `repo.compare`

| | |
| --- | --- |
| **Job** | List changed paths and commits between two revisions. |
| **Input** | `repository`, `base`, `head` — each a 7–40 character hexadecimal Git revision. |
| **Output** | Name-status changes, resolved full SHAs, commit count between. |
| **Failure modes** | Unknown revisions and non-hex inputs are rejected before comparison. |

## Resource and prompt

| Name | Kind | Purpose |
| --- | --- | --- |
| `repocontext://catalog` | Resource | JSON catalog of registered repositories. |
| `audit-documentation-gaps` | Prompt | Instructs an agent to audit README / AGENTS / architecture coverage with the tools above. |

## What agents should do next

1. Call `wiki.catalog` or run `doctor` when readiness is unclear.
2. Prefer `wiki.search` / `repo.search` before large reads.
3. Verify every claim with path, line, and full SHA before acting.
4. Treat `gaps` and brief `gaps` as missing evidence, not invented facts.
5. Use `repo.compare` or a brief `changeRange` when the question is about a release or regression window.

## Tool retention

All eight tools remain part of the public API. They form one workflow: catalog → search → read → analyze/compare. Do not add tools for write, deploy, semantic embedding search, or arbitrary shell execution.
