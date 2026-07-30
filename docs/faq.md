# FAQ

Answers grounded in the implemented product and [deep research](research/deep-research-2026-07-30.md).

## Why not use the official filesystem MCP server?

Filesystem MCP is for **reading and writing files**. It exposes create/write/edit/move tools and has **no commit model**. RepoContext is **read-only**, serves **Git HEAD** (not dirty worktree as evidence), and returns **path + line + full SHA**. Use filesystem MCP when the agent must edit; use RepoContext when the agent must **prove** committed context across repos.

## Why not use the official Git MCP server?

`mcp-server-git` inspects **and mutates** a repository (stage, commit, branch, reset). RepoContext never writes to indexed repos and first-class supports a **multi-repo registry**. Use Git MCP for local Git automation; use RepoContext for **verifiable multi-repo evidence**.

## Why not use the GitHub MCP server?

GitHub MCP is for **GitHub’s platform** (issues, PRs, Actions, remote APIs). RepoContext is for **local Git roots** (including private offline trees) with HEAD-pinned content. They compose well: GitHub MCP for PR workflow, RepoContext for cited local source/docs.

## Why not use embeddings / codebase indexes?

Indexes excel at **semantic** “find similar” and large fleets, but they introduce **reindex lag**, branch/rebase drift, and opaque chunks. RepoContext trades semantic search for **immediate HEAD freshness** and **reproducible citations**. Prefer Sourcegraph-class or graph MCP tools when structure/semantics dominate.

## Why is commit pinning useful?

Agents cache earlier tool results as if they were eternal facts. Branch switches, pulls, and multi-agent checkouts create **branch-state drift**. Pinning answers to a **full SHA** makes each fact auditable with `git show <sha>:<path>` and stops dirty work from masquerading as committed truth.

## How is this different from `git grep`?

`git grep` is a CLI for one repo. RepoContext packages **multi-repo registry**, **doc catalog/search**, **exposure policy**, **sensitive-path blocking**, **Context Briefs**, **doctor/init**, and **MCP-native** structured results agents can chain—always with provenance fields.

## Can RepoContext modify repositories?

**No.** MCP tools are read-only. `init` writes only an **external** registry YAML (default `~/.repocontext/`), never the indexed repos. Snapshot builds write a separate output directory for HTTP images.

## Does it support large monorepos?

It supports **large Git roots** with bounded search/read caps. It does **not** model pnpm/Nx package ownership graphs inside one Git root (roadmap research). Multi-package systems that are **separate Git repositories** are the designed multi-repo case.

## Which clients work?

Claude Code, Codex, Cursor, Windsurf, Zed, Continue (and any MCP client that runs a stdio command + env). `init --client <name>` prints paste-ready config. Native activation remains a client-side check.

## Does the agent see my uncommitted edits?

**Not as evidence.** Content tools read **HEAD**. Catalog/doctor can report **stale/attention** when tracked docs differ from HEAD so the agent knows the worktree is dirty.

## Is there telemetry?

CLI and MCP transports send **none**. Optional cookieless website analytics only if you configure a dedicated PostHog project key at site build time.

## How do I verify a result?

Check the returned **path**, **line**, and **40-character commit SHA**, then run `git show <sha>:<path>` (or open the file at that revision in your Git UI).
