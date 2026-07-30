# Public launch package

Internal checklist and copy for RepoContext’s public beta / broader announcement. Do not invent metrics or user quotes.

## Release verdict (2026-07-30)

**Ready for public beta.** npm `0.3.0` already ships a trustworthy install-to-first-answer path. Broad “discovery launch” should wait until **0.3.1** is on npm **and** listed in the official MCP Registry, with this documentation set merged.

## Golden-path demo (shareable)

**Story:** An agent answers a multi-repo release question with path, line, and full commit SHA—and refuses to treat a dirty worktree as committed evidence.

```bash
# From a clean machine
npx -y @shmindmaster/repocontext@latest init --client codex
# Paste printed MCP config into the client, then ask:

# 1) Which repositories are ready?
#    → wiki.catalog (view: sync)

# 2) Where is authentication documented?
#    → wiki.search query: "bearer authentication"

# 3) Prove the source
#    → wiki.get / repo.read and verify path + line + full SHA

# 4) What changed between two release commits?
#    → repo.compare with hex base/head

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

npx -y @shmindmaster/repocontext@latest init --client codex
https://github.com/shmindmaster/repocontext
```

### Show HN

**Title:** RepoContext – commit-pinned, read-only multi-repo context for coding agents (MCP)

**Body outline:**

1. Problem: agents mix dirty files, wrong commits, and uncited summaries.
2. What it is: eight MCP tools, Git as source of truth, registry of local roots.
3. What it is not: RAG, vector DB, write tools, GitHub automation.
4. 30-second try: `npx … init --client codex`.
5. Ask HN: multi-repo agent workflows and trust boundaries.

### GitHub release notes focus

- Install-to-first-cited-fact via `init`
- Trust boundary table
- Link to docs/compare.md and docs/tools.md
- MCP Registry identity when published (`io.github.shmindmaster/repocontext`)

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
