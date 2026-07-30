# How GitPin compares

Honest comparison for developers choosing how agents should ground multi-repo answers. Strengths of alternatives are real; pick the tool that matches the **job**.

**Category exit:** GitPin is **not** competing as “another repo-context MCP.” That name family is crowded (indexes, dumps, remote GitHub browsers). GitPin’s job is **verifiable multi-repo evidence** from **Git HEAD** only.

| Dimension | GitPin | Filesystem MCP | Official Git MCP | GitHub MCP | Embedding / RAG indexers | Sourcegraph-class |
| --- | --- | --- | --- | --- | --- | --- |
| Product job | Prove claims with path/line/SHA | Edit local files | Mutate/inspect one Git repo | Platform APIs | Semantic retrieval | Org code intelligence |
| Indexing | **None** | None | None | Hosted API | Required | Required / continuous |
| Freshness | Immediate at local HEAD | Live files (incl. dirty) | Live Git | Remote state | Delayed by reindex | Sync-dependent |
| Evidence contract | `pin.prove` → `pin.verify` | No commit model | Tool-dependent | URLs / refs | Chunk IDs | Path + line when configured |
| Determinism | High for same HEAD | High for same tree | High | API-dependent | Embedding variance | High for exact search |
| Writes | **Never** to indexed repos | Often R/W | Often write/commit | Issues, PRs, more | Usually read | Read |
| Multi-repo | First-class YAML registry | Multiple mounts | Usually one cwd | Org/user scope | Often one corpus | Strong |
| Infra | Node + Git | None | Git | Network | DB / vectors / workers | Significant |
| Best at | Trustable agent citations humans re-check with `git show` | Local edits | Single-repo Git tasks | GitHub workflow | “Find similar code” | Enterprise search |

## When GitPin is the better fit

- Agents must **prove** where an answer came from (path, line, full SHA) and you want **`pin.verify` / `git show`** as the close of the loop.
- You work across **several local Git roots** and refuse embedding index lag.
- Policy forbids broad write tools or opaque retrieval.
- You need a reproducible **EvidenceBrief** for review, release, or cross-functional handoff.

## When another tool is stronger

- Agent must **edit** or run Git writes → filesystem / Git MCP.
- Need **Issues, PRs, Actions** → GitHub MCP.
- Need **semantic** similarity at org scale → embeddings / Sourcegraph-class.
- You only care about the **live dirty worktree** → filesystem MCP (GitPin intentionally excludes uncommitted content as evidence).

## Functionality that is product differentiation (not rename)

| Capability | Why it is not “repo context renamed” |
| --- | --- |
| `pin.prove` evidence pack | Claim-bound pack with `citation.cite`, content hash, verify next-step |
| `pin.verify` | Independent re-check of path@SHA; detects HEAD drift |
| Search as **candidates** | Hits refuse to be treated as final claims (`next` → prove) |
| EvidenceBrief | Multi-repo known/gap set with stable `evidenceSetId` |
| Dirty excluded | `pin.inspect` status shows work that will never be cited as HEAD evidence |
| Index-free | No SQLite/vectors/reindex—live `git show` / `git grep` at HEAD |

## Named ecosystem peers

| Peer | Stronger when… | GitPin stronger when… |
| --- | --- | --- |
| `mcp-repo-context`, `repo-ctx`, HutsonLabs `repo-context-mcp`, SRC | AST/call graphs, embeddings, local index DBs | No index lag; live HEAD + full SHA prove/verify |
| `codesearch`, `code-intel-mcp` | Hybrid/semantic search at scale | Zero embed model; citation contract |
| `sourceplane-mcp` | Multi-host GH/GL/BB sources | Local Git-root registry + EvidenceBrief |
| GitMCP / gitctx | Chat with **remote** GitHub without clone | Local multi-root, offline, private trees |
| Official filesystem / git MCP | Agent must edit or mutate Git | Read-only HEAD evidence loop |
| GitHub MCP | Issues, PRs, Actions | Local/private multi-root HEAD evidence |
| Context7 | Third-party **library docs** | **Your** repo docs/code at a SHA |
| Repomix / dump CLIs | One-shot full-repo paste | Live MCP prove/verify tools |

Research: [competitive landscape (corrected)](research/competitive-landscape-corrected-2026-07-30.md).

## Positioning statement

> **GitPin** gives coding agents **index-free, read-only, multi-repository evidence pinned to Git HEAD**, with a **prove → verify** tool loop and **path / line / full SHA** citations humans can re-check with `git show`.

That is a **trust product**, not a semantic retrieval product, and not a rebrand of “repo context.”
