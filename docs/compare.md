# How RepoContext compares

Honest comparison for developers choosing a repository-context path for coding agents. Strengths of alternatives are real; pick the tool that matches the job.

**Important:** the phrase “repo context” is **not unique**. Multiple open-source MCP/CLI products use names like `mcp-repo-context`, `repo-context`, `repo-ctx`, `repoctx`, and `Repo Context`. See [competitive landscape (corrected)](research/competitive-landscape-corrected-2026-07-30.md). This package is `@shmindmaster/repocontext` / `io.github.shmindmaster/repocontext` — an **index-free, read-only, Git-HEAD-pinned** multi-repo MCP, not a vector-index or dump tool.

| Dimension | RepoContext | Filesystem MCP | Official Git MCP (typical) | GitHub MCP | Embedding / RAG indexers | Sourcegraph-class search |
| --- | --- | --- | --- | --- | --- | --- |
| Setup | One `npx init` + registry | Mount paths | Git tools in one repo | OAuth / token | Indexer + storage | Hosted or large self-host |
| Indexing | None | None | None | Hosted API | Required | Required / continuous |
| Freshness | Immediate at local HEAD | Live files (including dirty) | Live Git | Remote platform state | Delayed by reindex | Depends on sync |
| Commit precision | HEAD-pinned content + explicit compare | No commit model | Git operations | PR/ref APIs | Often branch-level or fuzzy | Strong when configured |
| Determinism | High for same HEAD | High for same tree | High | API-dependent | Embedding variance | High for exact search |
| Citations | Path, line, full SHA | Path (sometimes line) | Tool-dependent | URLs / refs | Often chunk IDs | Path + line |
| Writes | Never to indexed repos | Often read-write | Often includes write/commit | Issues, PRs, more | Usually read | Read |
| Multi-repo | First-class registry | Multiple mounts | Usually one cwd | Org/user scope | Often one corpus | Strong |
| Trust boundary | Narrow, documented | Broad FS access | Repo FS + Git | Platform permissions | Corpus + vendor | Enterprise controls |
| Infra | Node + Git | None | Git | Network | DB / vectors / workers | Significant |
| Semantic search | No (text only) | No | No | Limited | Yes | Hybrid |
| Best at | Verifiable multi-repo agent evidence | Local file edits | Single-repo Git tasks | GitHub workflow automation | “Find similar code” | Org-wide code intelligence |

## When RepoContext is the better fit

- Agents must show **where** an answer came from (path, line, SHA).
- You work across **several local Git roots** (services, apps, shared libraries).
- You want **no local reindex lag** and **no embedding drift**.
- Security or process policy forbids broad write tools or opaque retrieval.
- You need a **reproducible** brief for review, release, or cross-functional handoff.

## When another tool is stronger

- You need the agent to **edit files** or run Git writes → filesystem / Git MCP.
- You need **Issues, PRs, Actions, or org APIs** → GitHub MCP.
- You need **semantic** “find code like this” across huge monorepos → embeddings / Sourcegraph-class tools.
- You only care about the **live dirty worktree** the human is editing → filesystem MCP (RepoContext intentionally excludes uncommitted content as evidence).

## Named ecosystem peers (corrected research, 2026-07-30)

| Peer | Stronger when… | This package stronger when… |
| --- | --- | --- |
| `mcp-repo-context`, `repo-ctx`, HutsonLabs `repo-context-mcp`, SRC | You want AST/call graphs, embeddings, SQLite/Lance indexes | You refuse index lag and want live Git HEAD + full SHA |
| `codesearch`, `code-intel-mcp` | Multi-repo hybrid/semantic search at scale | You want zero embed model / no Zoekt index |
| `sourceplane-mcp` | Multi-host sources (GH/GL/BB + local) with allowlists | Local Git-root registry + docs/code wiki tools + Context Brief |
| GitMCP / gitctx | Chat with a **remote** GitHub repo without cloning | Local multi-root, offline, private trees |
| Official filesystem / git MCP | Agent must edit or mutate Git | Read-only + HEAD-only evidence contract |
| GitHub MCP server | Issues, PRs, Actions, remote GH | Local/private multi-root HEAD evidence |
| Context7 | Third-party **library docs** freshness | **Your** repo docs/code at a SHA |
| Repomix / dump CLIs (`repo-context` generators) | One-shot full-repo paste into a chat | Live MCP tools + bounded cited evidence |
| codebase-memory / Sourcegraph-class | Call graphs, org-scale semantic search | Zero index infra, reproducible cites |

Full corrected landscape: [research/competitive-landscape-corrected-2026-07-30.md](research/competitive-landscape-corrected-2026-07-30.md). Earlier notes (pain points still useful): [research/deep-research-2026-07-30.md](research/deep-research-2026-07-30.md). FAQ: [faq.md](faq.md).

## Positioning statement (validated against the implementation + market research)

> RepoContext gives coding agents **read-only, multi-repository context pinned to Git HEAD**, with **path/line/SHA provenance** and **no indexing infrastructure**.

That is a product advantage for trust and reproducibility—not a claim of better semantic retrieval. Complementary to Context7 (dependency docs) and GitHub MCP (platform workflows).
