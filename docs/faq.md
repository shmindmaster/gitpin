# GitPin FAQ

## Why not call this “repo context”?

Because that category is crowded and usually means **indexes, dumps, or remote GitHub browsers**. GitPin’s job is different: **verifiable multi-repo evidence** from **Git HEAD** with path, line, and full SHA, closed by **`pin.verify`**.

## How is this different from filesystem MCP?

Filesystem MCP is for **reading and writing files**. It exposes create/write/edit tools and has **no commit model**. GitPin is **read-only**, serves **Git HEAD** (not dirty worktree as evidence), and implements **prove → verify**.

## How is this different from official git MCP?

`mcp-server-git` inspects **and mutates** a repository. GitPin never writes to indexed repos, supports a **multi-repo registry**, and optimizes for **cited claims**, not Git automation.

## How is this different from GitHub MCP?

GitHub MCP is for **platform** workflows (issues, PRs, Actions). GitPin is for **local Git roots** (including private/offline) at HEAD. They compose: GitHub MCP for PRs, GitPin for cited local source/docs.

## How is this different from embedding / “repo-context*” indexers?

Indexes excel at **semantic** similarity but introduce **reindex lag**, branch drift, and opaque chunks. GitPin trades semantic search for **immediate HEAD freshness** and **reproducible citations**. Search results are explicitly **candidates**, not claims.

## What is the agent workflow?

1. `pin.catalog` — map roots and SHAs  
2. `pin.search_docs` / `pin.search_code` — find candidates  
3. `pin.prove` — evidence pack with `citation.cite`  
4. `pin.verify` — re-check path@SHA  
5. `pin.analyze` brief — multi-repo EvidenceBrief when deciding across services  

Prompt `prove-with-git-head` encodes this loop.

## Why does search not return “the answer”?

By design. Hits are **`evidence-candidates`** with a `next` step to `pin.prove`. Treating grep hits as final claims is how agents invent confidence. GitPin forces the prove/verify product behavior.

## Can GitPin modify repositories?

**No.** MCP tools are read-only. `init` writes only an **external** registry YAML (default `~/.gitpin/`), never indexed repos. Snapshot builds write a separate output directory for HTTP images.

## What about dirty worktrees?

Uncommitted edits are **not evidence**. `pin.inspect` with `operation: status` can show dirty state so agents and humans know what is excluded.

## Migration from RepoContext 0.3.x?

See [migration-gitpin.md](migration-gitpin.md). Package `gitpin`, tools `pin.*`, env `GITPIN_*`. Supported compatibility aliases are the `repocontext` bin, `REPOCONTEXT_*` environment variables, `~/.repocontext`, and `.repocontext/wiki.yaml`; the removed `wiki.*` and `repo.*` tools are not served.
