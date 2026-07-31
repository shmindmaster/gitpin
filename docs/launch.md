# Public launch package

Internal checklist and copy for RepoContext’s public beta / broader announcement. Do not invent metrics or user quotes.

## Release verdict (2026-07-30)

**Ready for public beta / discovery launch.** npm `@shmindmaster/gitpin@0.3.1`, GitHub Release `v0.3.1`, and official MCP Registry listing (`io.github.shmindmaster/gitpin`, status **active**) are live as of 2026-07-30. Research basis: [docs/research/deep-research-2026-07-30.md](research/deep-research-2026-07-30.md).

## Golden-path demo (shareable)

**Story:** An agent answers a multi-repo release question with path, line, and full commit SHA—and refuses to treat a dirty worktree as committed evidence.

```bash
# From a clean machine
npx -y @shmindmaster/gitpin@latest init --client codex
# Paste printed MCP config into the client, then ask:

# 1) Which repositories are ready?
#    → pin.catalog (view: sync)

# 2) Where is authentication documented?
#    → pin.search_docs query: "bearer authentication"

# 3) Prove the source
#    → pin.get_doc / pin.read and verify path + line + full SHA

# 4) What changed between two release commits?
#    → pin.compare with hex base/head

# Maintainer demo (synthetic fixture, never user repos):
pnpm demo:verify
```

**Aha moment:** same question after a local uncommitted edit still returns the **committed** line, while catalog/doctor report **stale/attention**—so the agent cannot silently mix dirty files into “facts.”

## Primary audience

**Primary:** Individual developers and small teams using MCP coding agents (Claude Code, Codex, Cursor, Windsurf, Zed, Continue) across **multiple local repositories**.

**Secondary:** Release / platform engineers who need a source-cited Context Brief for cross-functional handoff; security-conscious teams that reject write-capable or black-box context tools.

## Channels and posts (templates)

### README / website one-liner

Commit-pinned context for coding agents—read-only, multi-repo, path + line + SHA, no embeddings.

### X / short post

```text
Coding agents guess across repos.

RepoContext is a read-only MCP server that answers from Git HEAD only—
with path, line, and full commit SHA. No DB. No embeddings. No write tools.

npx -y @shmindmaster/gitpin@latest init --client codex
https://github.com/shmindmaster/gitpin
```

### Show HN

**Title:** RepoContext – commit-pinned, read-only multi-repo context for coding agents (MCP)

**Body (draft for human posting):**

```text
Agents confidently quote code that is on the wrong branch, only in a dirty worktree,
or never existed. Filesystem MCP tools often write. Embeddings lag after rebase.

RepoContext is a small MCP server that answers only from Git HEAD across the repos
you register—every useful hit carries path, line, and full commit SHA. No database,
no embeddings, no write tools.

npx -y @shmindmaster/gitpin@latest init --client codex

https://github.com/shmindmaster/gitpin

Curious how others pin multi-repo agent context without a vector store.
```

### LinkedIn

```text
Coding agents fail quietly when repository context is wrong—wrong branch, dirty tree,
or an index that still thinks last week’s API exists.

I open-sourced RepoContext: a read-only MCP server for multi-repo, commit-pinned
evidence (path + line + full SHA). Git stays the source of truth.

Try: npx -y @shmindmaster/gitpin@latest init --client codex
Repo: https://github.com/shmindmaster/gitpin
```

### Client auto-invoke rule (paste into AGENTS.md / Cursor rules)

```text
When answering questions about architecture, ownership, docs, or implementation across
registered local repositories, use RepoContext MCP tools (wiki.* / repo.*) and cite
path, line, and full commit SHA. Do not invent file contents. Prefer pin.catalog
before broad search. Treat gaps and blocked paths as real absences.
```

### Likely objections (see docs/faq.md)

| Objection | Short answer |
| --- | --- |
| Just use filesystem MCP | That tool writes; no commit pin |
| Just use git MCP | Mutates repos; not multi-repo registry-first |
| Just use embeddings | Better semantics; worse lag and opaque cites |
| Just use git grep | One repo CLI; no policy, brief, doctor, MCP chain |
| Can it write? | No |
| Monorepos? | Git roots yes; package graphs later |

### GitHub release notes focus

- Install-to-first-cited-fact via `init`
- Trust boundary table
- Link to docs/compare.md and docs/tools.md
- MCP Registry identity when published (`io.github.shmindmaster/gitpin`)

## First-day / first-week / first-month

| Window | Actions |
| --- | --- |
| Day 0 | Merge registry PR, tag 0.3.1, npm + MCP Registry publish, deploy site if needed, seed 3 GitHub issues from backlog |
| Day 1 | Post short demo + Show HN / relevant communities; watch issues and doctor failures |
| Week 1 | Answer every issue; capture install friction; no new tools unless a blocker |
| Month 1 | Run moderated validation (SH-2395); decide hosted docs-only remote; publish one user-validated brief story if consented |

## Success metrics (honest)

| Metric | Why it matters | Guardrail |
| --- | --- | --- |
| Successful `init` + first cited fact | Activation | Do not add CLI telemetry; infer from issues and support |
| Stars / forks / npm downloads | Discovery | Vanity alone is insufficient |
| Quality issues filed | Real usage | Empty issues may mean no users |
| Repeat agent workflows described by users | Retention | Prefer qualitative proof early |
| Registry listing present | Ecosystem discovery | Binary gate for “broad” launch |

## Do not claim

- Semantic or embedding search quality
- Guaranteed older-version security maintenance windows
- Hosted multi-tenant SaaS
- That dirty worktrees are searchable as evidence
- Stars or adoption numbers that are not measured
