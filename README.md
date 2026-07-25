<div align="center">

# repocontext

### Your AI agents can't see across your repos. Now they can.

**One MCP server. Every repo indexed. Commit-pinned. Read-only. Searchable.**

```
You: "How does auth work across our 12 microservice repos?"

Before repocontext:  Claude reads 1 repo. Guesses about the rest. Hallucinates.
After repocontext:   Claude searches all 12, reads the actual code at the exact
                     commit, cites the files, and shows you the drift.
```

```bash
npx repocontext init          # point it at your repos
npx repocontext index         # build the knowledge index
npx repocontext serve         # start the MCP server

# Add to Claude:
#   claude mcp add repocontext --url http://localhost:3100/mcp
```

[⚡ Quick Start](#-quick-start) · [🔧 8 MCP Tools](#-8-mcp-tools) · [📊 Gap Analysis](#-documentation-gap-analysis) · [❓ FAQ](#-faq)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-Streamable%20HTTP-%23a855f7.svg)](https://modelcontextprotocol.io)

</div>

---

## The Problem

You have 5, 10, 20 repos. Your AI agent can see **one of them**.

- Claude Code reads the repo it's in. It has no idea what's in your other 11 repos.
- Codex sees one working directory. Cross-repo questions get hallucinated answers.
- Cursor indexes your project folder. Shared libraries, other services, deployment configs — invisible.

So when you ask *"How does the payment webhook flow from the API repo through the worker repo into the dashboard repo?"* — your agent **makes it up**.

## The Fix

`repocontext` indexes your repos and exposes them through a single MCP server. Any MCP-compatible agent (Claude, Codex, Cursor, Windsurf, OpenCode, Copilot) gets:

- **Search** across all repos simultaneously
- **Read** exact file slices at exact commits (no stale data)
- **Compare** what changed between commits across repos
- **Analyze** documentation gaps ("which repos are missing API docs?")
- **Inspect** CI status, test health, manifests, and drift

All read-only. All commit-pinned. Your agents see the truth, not a stale guess.

---

## ☁️ One-Click Deploy (Self-Hosted)

Want repocontext running on your own infra? Click and go:

| Platform | Deploy | Config |
|----------|--------|--------|
| **Railway** | [![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/repocontext) | `deploy/railway/railway.toml` |
| **Render** | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/shmindmaster/repocontext) | `deploy/render/render.yaml` |
| **Fly.io** | `fly launch --config deploy/fly/fly.toml` | `deploy/fly/fly.toml` |
| **DigitalOcean** | [![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/shmindmaster/repocontext) | `deploy/digitalocean/app.yaml` |
| **Docker** | `docker build -t repocontext . && docker run -p 3100:3100 repocontext` | Coming soon |

> **Local-first by default.** You don't need to deploy anything. The MCP server runs locally via `pnpm mcp:serve`. Deploy only if you want a shared, remote MCP endpoint for your team.

---

## ⚡ Quick Start

### 1. Install & Initialize (60 seconds)

```bash
# Clone the repo
git clone https://github.com/shmindmaster/repocontext.git
cd repocontext
pnpm install

# Initialize — point it at your repos
pnpm init:repos
# → Prompts: "Where are your repos?" → e.g. ~/code/projects
# → Generates: registry/repositories.yaml with discovered repos
```

### 2. Index (one-time + on-demand)

```bash
pnpm index
# → Reads each repo's git history, docs, manifests
# → Builds: generated/catalog.json, documents.json
# → Commit-pinned: every entry says which commit it came from
```

### 3. Serve the MCP Server

```bash
pnpm mcp:serve
# → Streamable HTTP MCP server at http://localhost:3100/mcp
# → 8 read-only tools available to any MCP client
```

### 4. Connect Your Agent

```bash
# Claude Code
claude mcp add repocontext --url http://localhost:3100/mcp

# OpenCode
# Add to opencode.json → mcp → repocontext

# Codex
codex mcp add repocontext --url http://localhost:3100/mcp

# Or any MCP client: use the Streamable HTTP endpoint
```

---

## 🔧 8 MCP Tools

Every tool is **read-only** and **commit-pinned**. No writes. No mutations. Your agents look, they don't touch.

| Tool | What It Does | Example |
|------|-------------|---------|
| **`wiki.catalog`** | List all indexed repos with sync status, doc counts, staleness | *"Which repos haven't been indexed in a week?"* |
| **`wiki.search`** | Semantic search across all repo documentation | *"How do we handle auth tokens?"* |
| **`wiki.get`** | Get one doc page + its source commit trace | *"Show me the API docs for the payments service"* |
| **`wiki.analyze`** | Compare doc coverage across repos, find gaps | *"Which repos are missing READMEs or API docs?"* |
| **`repo.inspect`** | Status, commits, CI, tests, manifests, drift for one repo | *"Is the auth-service CI green? What's the latest commit?"* |
| **`repo.read`** | Read a file slice at a specific commit (safe, line-ranged) | *"Show me lines 50-100 of src/auth/middleware.ts at abc1234"* |
| **`repo.search`** | Code search within repo boundaries | *"Where is `validateToken` defined across all repos?"* |
| **`repo.compare`** | Diff changed files between two commits | *"What changed in the API repo between v2.1 and v2.2?"* |

### Example Conversation (Claude Code + repocontext)

```
You:    How does session auth flow from the web app to the worker service?

Claude: [uses wiki.search "session auth flow"]
        [uses repo.read → web-app/src/auth/session.ts:1-45 @ a3f2c1d]
        [uses repo.read → worker/src/handlers/auth.ts:12-67 @ b7e9a01]

        The flow works like this:
        1. web-app creates a session via session.ts (commit a3f2c1d)
        2. The session token is passed via X-Session header
        3. worker/src/handlers/auth.ts:34-41 validates the token
           and attaches the user context
        
        ⚠️ Note: The worker is on commit b7e9a01 (3 days old).
        The web-app was updated 2 hours ago. There may be drift
        in the token format — I see the web-app now sends
        v2 tokens but the worker still validates v1.
```

That last line — **detecting cross-repo drift** — is impossible without repocontext.

---

## 📊 Documentation Gap Analysis

```
$ repocontext analyze

  Documentation Coverage Report — 12 repositories
  ═══════════════════════════════════════════════

  Repository          README  API Docs  Arch Docs  Runbook  Tests
  ──────────────────────────────────────────────────────────────
  web-app              ✅       ✅        ✅        ✅       ✅
  api-service          ✅       ✅        ❌        ❌       ✅
  worker               ✅       ❌        ❌        ✅       ✅
  shared-lib           ✅       ✅        ✅        ❌       ✅
  infra                ❌       ❌        ✅        ❌       ❌
  mobile-app           ✅       ❌        ❌        ❌       ✅
  dashboard            ✅       ✅        ❌        ❌       ✅
  auth-service         ✅       ✅        ✅        ✅       ✅
  payments-service     ✅       ❌        ❌        ❌       ✅
  notification-svc     ❌       ❌        ❌        ❌       ✅
  admin-panel          ✅       ✅        ✅        ❌       ✅
  data-pipeline        ✅       ❌        ✅        ❌       ❌

  Coverage: 61% (44/72 slots filled)
  
  ⚠️ 5 repos missing API docs
  ⚠️ 3 repos missing architecture docs  
  ⚠️ 2 repos have no README at all
```

Share this. Your team will thank you.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────┐
│               Your Repos (read-only)              │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────────┐  │
│  │repo1│ │repo2│ │repo3│ │ ... │ │ repo-N  │  │
│  └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └────┬────┘  │
│     │       │       │       │         │         │
└─────┼───────┼───────┼───────┼─────────┼─────────┘
      │       │       │       │         │
      ▼       ▼       ▼       ▼         ▼
┌──────────────────────────────────────────────────┐
│           repocontext indexer (offline)           │
│  • Git history + commit metadata                  │
│  • docs/wiki.yaml → what each repo exposes        │
│  • Manifest validation (package.json, etc.)       │
│  • Sensitive-content scanning (blocks secrets)    │
│  • Generates: catalog.json + documents.json       │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│         repocontext MCP server (read-only)        │
│                                                   │
│  wiki.catalog  wiki.search  wiki.get  wiki.analyze│
│  repo.inspect  repo.read  repo.search  repo.compare│
│                                                   │
│  • Streamable HTTP (stateless by default)         │
│  • Optional bearer token auth                     │
│  • Commit-pinned responses (never stale)          │
└──────────────────────┬───────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  Claude  │ │  Codex   │ │  Cursor  │
    │  Code    │ │          │ │ Windsurf │
    │          │ │          │ │ OpenCode │
    └──────────┘ └──────────┘ └──────────┘
```

---

## 🔒 Safety Model

| Rule | How |
|------|-----|
| **Read-only** | 8 query tools. Zero write/mutation tools. Your repos are never modified. |
| **Commit-pinned** | Every response says which commit the data came from. No surprises. |
| **Secrets blocked** | `.env`, API keys, tokens, credentials, patient/client data — scanned and blocked at index time. |
| **Manifest-controlled** | Each repo's `docs/wiki.yaml` controls exactly what gets exposed. Nothing by default. |
| **Local-first** | Indexing runs on your machine. Nothing leaves unless you deploy the HTTP server. |

---

## 📋 Configuration

### `registry/repositories.yaml` (which repos to index)

```yaml
# Auto-discovered or manually added
repositories:
  - name: web-app
    path: ~/code/projects/web-app
    branches: [main]
    
  - name: api-service
    path: ~/code/projects/api-service
    branches: [main, develop]
    
  - name: shared-lib
    path: ~/code/projects/shared-lib
    branches: [main]
```

### `docs/wiki.yaml` (per-repo, what to expose)

Drop this in any repo you want to index:

```yaml
# Copy from: templates/wiki.yaml
version: 2
expose:
  - path: README.md
  - path: docs/architecture.md
  - path: docs/api/
    glob: "*.md"
exclude:
  - path: docs/internal/     # never expose internal docs
  - path: "*.secret.*"
```

---

## 🛠️ Local Development

```bash
pnpm install
pnpm dev              # Next.js dev server (docs UI)
pnpm test             # vitest
pnpm build            # production build
pnpm index            # rebuild the index
pnpm mcp:serve        # start MCP server (stdio)
pnpm mcp:serve:http   # start MCP server (HTTP on :3100)
pnpm validate         # full pre-release gate
```

---

## 🗺️ Roadmap

- [x] 8 MCP tools (catalog, search, get, analyze, inspect, read, code-search, compare)
- [x] Commit-pinned responses
- [x] Sensitive-content scanning
- [x] Manifest-controlled exposure (wiki.yaml)
- [x] Streamable HTTP transport (stateless)
- [x] Local-first indexing
- [ ] `npx repocontext` one-command setup
- [ ] GitHub App integration (index remote repos without cloning)
- [ ] Incremental indexing (only re-index changed commits)
- [ ] Team mode: shared index, per-member access controls
- [ ] Doc-drift alerts: "README is 30 days stale vs. last code change"
- [ ] VS Code / JetBrains extension for inline cross-repo search
- [ ] Docker image for self-hosted deployment

---

## 🧠 Knowledge Cards

Beyond docs, repocontext generates **Knowledge Cards** — deep per-module understanding that AI agents use to answer "how does X work?" without reading every file.

```
$ repocontext cards --repo payments-service

  💳 Payments Service — Knowledge Cards
  ══════════════════════════════════════

  📦 src/gateway/stripe.ts
     Handles Stripe webhook verification and payment intent creation.
     Depends on: shared-lib/crypto for signature validation.
     Consumers: web-app/checkout, admin-panel/refunds
     Last changed: commit e4f2a1d (2 days ago)

  📦 src/webhooks/handler.ts
     Routes webhooks to domain processors. Retry logic with
     exponential backoff. Dead-letter queue after 5 failures.
     Depends on: worker/queue, shared-lib/events
     ⚠️ Worker is on an older commit — may miss new event types.

  📦 src/ledger/reconcile.ts
     Daily reconciliation against bank statements. Flags
     discrepancies >$0.01 for human review.
     Depends on: data-pipeline/staging
     Human-gated: discrepancies route to finance team, never auto-resolved.
```

Cards are generated from code analysis + your annotations. **Your corrections are protected** — they won't be overwritten by the next auto-update.

---

## 📝 wiki_plan.yaml — Guided Generation

Like a design brief for your codebase documentation. Drop one in your repo before indexing and repocontext follows your intent:

```yaml
# .repocontext/wiki_plan.yaml (or templates/wiki.yaml)
version: 2

repowiki:
  # Template: "architecture" (technical) or "product" (feature-focused)
  template: "architecture"

  # Notes: inject guidance for the AI indexer
  notes:
    - text: "Focus on the payment flow, not internal utilities"
      author: "you"
    - text: "Document the auth boundary — it's the #1 source of cross-repo bugs"
      author: "you"

  # Documents: control what pages get generated
  documents:
    - title: "System Architecture"
      goal: "How services connect, where data flows, deploy topology"
    - title: "Payment Flow"
      goal: "End-to-end from checkout click to bank reconciliation"
      parent: "System Architecture"

# Knowledge Cards: focus the per-module cards
knowledgecard:
  notes:
    - text: "Prioritize cards for src/gateway/ and src/webhooks/"

# Scope: what files to look at
scope:
  include: ["src/**", "docs/**"]
  exclude: ["**/test/**", "**/migrations/**"]
```

Compatible with Qoder's `wiki_plan.yaml` schema — if you're coming from Qoder, your existing plans work here.

---

## 🔄 Drift Detection

The feature Qoder doesn't have: **cross-repo drift alerts.**

```
$ repocontext drift

  ⚠️  Cross-Repo Drift Detected (3 issues)
  ═══════════════════════════════════════

  1. TOKEN FORMAT MISMATCH
     web-app (commit a3f2c1d, 2h ago) now sends v2 auth tokens
     worker (commit b7e9a01, 3d ago) still validates v1 format only
     → Risk: All authenticated requests will fail for new sessions

  2. EVENT SCHEMA DRIFT
     payments-service added `refund.partial` event (commit e4f2a1d)
     notification-svc doesn't handle it yet (last commit: 12d ago)
     → Risk: Partial refunds won't trigger customer notifications

  3. API CONTRACT CHANGE
     shared-lib changed `UserResponse.avatar` from string → object
     mobile-app still expects string (commit f1a3b2c, 6d ago)
     → Risk: Avatar display crashes on mobile
```

This is what makes repocontext worth the install. Single-repo tools literally cannot do this.

---

## 🆚 vs. Alternatives

| | repocontext | Qoder RepoWiki | codebase-memory-mcp | Copilot Workspace | Manual |
|---|---|---|---|---|---|
| **Multi-repo** | ✅ Native | ❌ Single repo | ❌ Single repo | ❌ | 😢 |
| **Cross-repo drift** | ✅ Built-in | ❌ | ❌ | ❌ | ❌ |
| **MCP-native** | ✅ Any client | ❌ Qoder IDE only | ✅ | ❌ | ❌ |
| **Open source** | ✅ MIT | ❌ Commercial | ✅ | ❌ | ✅ |
| **Free** | ✅ | ❌ Credits | ✅ | ❌ | ✅ |
| **Commit-pinned** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Doc gap analysis** | ✅ Portfolio-wide | ❌ Per-repo | ❌ | ❌ | ❌ |
| **Knowledge Cards** | ✅ + annotations | ✅ | ❌ | ❌ | ❌ |
| **wiki_plan.yaml** | ✅ Qoder-compatible | ✅ (only option) | ❌ | ❌ | ❌ |
| **Human annotations** | ✅ Protected | ✅ | ❌ | ❌ | ❌ |
| **Secret scanning** | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| **Doc-drift alerts** | ✅ | ⚠️ Intra-repo only | ❌ | ❌ | ❌ |

**The one-liner:** Qoder gives one repo a brain. repocontext gives your entire codebase a shared brain that any AI agent can talk to. Free, open-source, MCP-native.

---

## Built By

[Sarosh Hussain](https://saroshhussain.com) — manages 10+ production repos across healthcare, fintech, legal, and logistics AI. Built repocontext because every AI agent he used could only see one repo at a time and kept hallucinating cross-repo answers.

**Production-tested** across:
- 10+ product repositories (TypeScript, Python, mixed stacks)
- Multiple concurrent AI coding agents (Claude Code, Codex, Cursor, OpenCode)
- 772+ hours of agent-assisted development on Upwork (Expert-Vetted)

---

## ⭐ Star This Repo

If you've ever asked your AI agent *"how does X work across repos?"* and gotten a hallucinated answer — star this.

- ⭐ **Star** → get updates when we ship GitHub App + incremental indexing
- 🍴 **Fork** → customize the indexers for your stack
- 🐛 **Issue** → tell us what your agents can't see and we'll build a tool for it
- 💬 **Discuss** → share your multi-repo horror stories

---

## License

MIT — use it, fork it, deploy it. If it stops your agent from hallucinating a cross-repo answer, star the repo.
