# Deep research: GitPin next features & differentiation (2026-07-30)

Second deep-research pass after the **product pivot** to GitPin (index-free multi-repo **evidence**, prove → verify). Prior docs covered crowded “repo context” naming and market pain; this pass targets **what to build next** that strengthens the trust niche without collapsing into RAG, dump tools, or write-capable Git MCPs.

## Method

| Channel | What it covered |
| --- | --- |
| Prior repo research | `deep-research-2026-07-30.md`, competitive landscape correction |
| Exa | Claim-verification MCPs, AI code provenance, proof packets |
| Firecrawl GitHub research | Commit-certified handles, multi-repo Git MCP peers |
| Web / arXiv signals | Protocol-layer claim verification, agent tool-description discipline |
| Product inventory | Current `pin.*` surface, evidence modules, backlog |

**Sources reviewed (order of magnitude):** ~40+ primary product pages/READMEs + prior ~100 landscape sources. Tavily Research API was over quota this session; conclusions do not depend on it.

## Market shift: “repo context” → “agent evidence / verification”

A distinct product layer is forming around **checkable agent claims**, not just retrieval:

| Product | Job | Storage / writes | vs GitPin |
| --- | --- | --- | --- |
| **truth** ([blasrodri/truth](https://github.com/blasrodri/truth)) | Verify what the agent claims **it just did** (routes, configs, “tests pass”, scope) against **working tree + diff + command receipts** | Local `.truth/` index; hooks | **Complementary.** Session self-claims on dirty tree, not multi-repo HEAD evidence packs |
| **ProofFlow** | Work contract → snapshot → claim → evaluation → proof packet | SQLite backend, many tools | Heavy ledger; different install story |
| **Cronozen proof** | Cryptographic hash-chain of AI decisions | Hosted API | Audit trail for decisions, not git content truth |
| **AgentOracle / web fact-check MCPs** | External claim verification (web, wiki, etc.) | Hosted / multi-source | Not your private Git roots |
| **agentdiff** | Which **agent/model** wrote which lines (ed25519) | Git refs | Authorship provenance; not “is this fact at HEAD true” |
| **CodeTalk** | “Why was this written” from commits + session notes | Local cache optional | Historical narrative; zero-LLM when possible |
| **jdocmunch** | Doc section index with **certified `repo@sha` handles** | Local index DB | Proves market wants **immutable cite handles**; they index, we don’t |
| **Matrix Scroll / Pramāṇa** | Crypto / protocol claim attestation | Protocol-layer | Different trust model (signatures vs git objects) |
| Indexing “repo-context*” long tail | Semantic / AST / vector multi-repo context | DB / embeddings | Crowded retrieval lane GitPin already exited |

**Implication:** Competing as “another multi-repo MCP” is still a dead end. Competing as **the index-free multi-repo evidence substrate** that feeds review, handoffs, and CI **citation checks** is open—and adjacent to (not overlapping) truth/agentdiff/ProofFlow.

### White space GitPin owns if we stay sharp

> **Multi-repository, index-free, read-only evidence from Git HEAD only: candidate hits → evidence packs → independent `git show` verification → decision briefs, with path / line / full SHA humans can re-check.**

Not:

- semantic retrieval
- “I fixed the bug this turn” (truth)
- who the AI author was (agentdiff)
- crypto decision ledgers (Cronozen / Matrix Scroll)

## What GitPin already has (do not re-solve)

| Capability | Role |
| --- | --- |
| 10 `pin.*` tools + `prove-with-git-head` prompt | Product loop surface |
| `evidence-candidates` / `evidence-pack` / `verification-report` | Contract envelopes |
| `pin.prove` + `pin.verify` + CLI verify | Prove → verify |
| EvidenceBrief + doctor + init | Packaging differentiation |
| Dirty excluded; sensitive paths blocked | Trust defaults |
| Multi-repo YAML registry | Fleet of local Git roots |

Gaps below are **productization of that contract**, not category re-entry.

## Ranked features to implement now

Effort: **S** ≤1 day · **M** 1–3 days · **L** multi-week.  
Risk: **Low** strengthens niche · **Med** dilutes if marketed wrong · **High** fights product identity.

### P0 — ship in the next slice (highest ROI)

| # | Feature | Why research supports it | Effort | Risk | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | **Durable `repo@sha` handles** on every content envelope | jdocmunch’s certified `owner/repo@40hexsha` shows handoffs need immutable handles, not floating repo names | S | Low | e.g. `gitpin:repo@fullsha:path:line`; resolve only if HEAD still matches or pin at that sha for verify |
| 2 | **`pin.verify` claim-text containment** | truth’s multi-verdict model; agents invent “the file says X” without checking bytes | S–M | Low | Optional `claimText` / `mustContain`; Supported / Contradicted / Unproven without LLM |
| 3 | **`pin.prove_set` / multi-cite pack** | ProofFlow packets & review “evidence packs”; single-path prove is incomplete for multi-repo answers | M | Low | Cap N paths (e.g. 8); one `evidenceSetId`; `next: pin.verify` per item or batch |
| 4 | **`pin.verify_set` batch re-check** | Same; CI and agent stop-hooks want one call | M | Low | Mirror CLI `gitpin verify --from-pack pack.json` |
| 5 | **Formal cite mini-spec + JSON Schema** | Interop with PR bots, skills, and human re-check; reduces agent parse failures | S | Low | Document `repo/path:line @ sha` + machine fields; publish under `docs/schemas/` |
| 6 | **Agent skill + client rule snippets** | Context7 pattern; tool-description research: workflow cues beat silent tools | S | Low | “Before any multi-repo factual claim: catalog → prove → verify.” Ship under `templates/` and README |
| 7 | **CI citation gate script** | Practitioner demand for PR evidence; Propelcode “evidence pack on PR” narrative | M | Low | Parse cites from markdown/JSON; re-run verify; exit non-zero on drift |

### P1 — strong differentiators still index-free

| # | Feature | Why | Effort | Risk |
| --- | --- | --- | --- | --- |
| 8 | **`pin.blame` as evidence** (bounded line range → cite + SHA) | GitKraken/cyanheads/GitHub MCP all expose blame; wrapping as **GitPin citations** (not raw blame dump) stays on-brand | M | Med if it becomes a generic git kitchen-sink |
| 9 | **HEAD drift signal mid-session** | Branch/HEAD drift is a top validated pain; catalog SHAs can go stale between turns | S–M | Low |
| 10 | **`pin.compare` → change-path candidates** | Changed paths as prove candidates (not just path lists) closes release-evidence loop | S | Low |
| 11 | **Prove from candidate handle** | Reduce agent re-typing path/line errors from search hits | S | Low |
| 12 | **Markdown EvidenceBrief / proof packet export** | ProofFlow’s export story for humans; keep deterministic, no LLM | M | Low |
| 13 | **Richer tool descriptions (when/before/never)** | MCP tool-design literature: WHEN to call + predecessor tools drive selection | S | Low |
| 14 | **Refuse envelope standardization** | Explicit `kind: unavailable | blocked | dirty-excluded` beats silent empty arrays | S | Low |

### P2 — valuable but not now (or not GitPin)

| Idea | Verdict |
| --- | --- |
| Embeddings / hybrid search | **No** — exits white space |
| Write / commit / PR tools | **No** — use GitHub MCP |
| Working-tree claim verify (“I added this route”) | **Partner with truth**, don’t clone |
| AI line authorship (agentdiff) | **Complement**, don’t absorb |
| Crypto decision chains | **Out of scope** |
| Full monorepo package graphs | Backlog research only |
| Hosted multi-tenant SaaS | Infra later; remote snapshot path already sketched |
| 20+ tools like ProofFlow | **Anti-pattern** (tools tax research) — keep ≤12–14 intent tools |

## Competitive “feature gaps” that look tempting but are traps

| Tempting feature | Why skip or reshape |
| --- | --- |
| AST / call graphs | Index-heavy peers already win there |
| “Chat with GitHub without clone” | GitMCP / gitctx lane |
| Task context bundles | repoctx / dump tools |
| Semantic similarity | codesearch / SRC |
| Hooks that block agent stop | truth’s product; optional future integration, not core |

## Positioning after this research

**Keep saying:**

> GitPin is the **committed multi-repo evidence** layer: index-free HEAD pins, prove packs, verify with `git show`.

**Stop saying / never claim:**

- “Best repo context MCP”
- “Semantic understanding of your codebase”
- “Verifies that the agent’s work is correct” (that’s truth + tests)

**Stack narrative (discovery gold):**

```text
Context7     → third-party library docs
GitPin       → your multi-repo HEAD evidence (path/line/SHA)
truth        → did this turn’s self-claims match the tree/diff/receipts?
agentdiff    → which agent authored which lines (optional governance)
GitHub MCP   → issues/PRs/Actions
filesystem   → edits (write path; not evidence)
```

## Recommended implementation order (next engineering slice)

1. Cite mini-spec + schemas + richer tool descriptions + skill/rules templates (**docs-first, S**).
2. Durable `repo@sha` handle field on prove/candidates/verify (**S**).
3. `mustContain` / claim-text verification on `pin.verify` (**S–M**).
4. Multi-cite pack + batch verify + CLI `--from-pack` (**M**).
5. CI gate script using pack/verify (**M**).
6. `pin.compare` → candidates; HEAD drift; optional bounded `pin.blame` evidence (**M**).

Do **not** expand tool count before multi-cite + batch verify land—those deepen the existing product job.

## Success metrics (if shipping P0)

| Metric | Pass signal |
| --- | --- |
| Time-to-first verified cite | &lt; 5 min from `npx` + init |
| Agent re-verify rate | Skill/rules increase `pin.verify` after `pin.prove` |
| CI gate false failures | Only real HEAD drift or missing path |
| Category confusion | HN/README comments say “evidence/verify” not “another RAG” |

## Selected sources

- https://github.com/blasrodri/truth — turn-level deterministic claim verification  
- https://github.com/hyperion-gpu/proofflow-v0.1 — proof packets / claim↔evidence  
- https://github.com/cronozen/proof — decision hash chains  
- https://github.com/codeprakhar25/agentdiff — AI line provenance  
- https://github.com/HUKAIR/CodeTalk — commit-grounded “why”  
- https://github.com/jgravelle/jdocmunch-mcp — certified `repo@sha` handles  
- https://arxiv.org/html/2605.20312v1 — Pramāṇa claim-verification protocol  
- https://dev.to/aws-heroes/mcp-tool-design-why-your-ai-agent-is-failing-and-how-to-fix-it-40fc — tool description as UX  
- Prior: `docs/research/deep-research-2026-07-30.md`, `competitive-landscape-corrected-2026-07-30.md`

## Ops note (unchanged from ship path)

`gitpin@0.5.1` was the manually bootstrapped npm release. `gitpin@0.5.3` is the first release intended to exercise GitHub Actions trusted publishing end to end after npm 12 compatibility validation. The former `@shmindmaster/repocontext` package was removed from npm on 2026-07-31; `@shmindmaster/gitpin` was an unpublished intermediate name.
