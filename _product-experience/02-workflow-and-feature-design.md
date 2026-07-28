# RepoContext workflow and feature design

**Status:** proposed design, derived from `_product-experience/00-discovery.md`  
**Decision:** Preserve the eight-tool MCP surface. Refine `wiki.analyze` with a bounded `brief` operation and add a CLI readiness check; do not add a dashboard, database, or autonomous agent workflow.

## Outcome and actors

| Actor | Outcome | What must be true |
| --- | --- | --- |
| Coding agent / engineer | Produce a safe implementation plan or answer from evidence. | Sources are bounded, commit-pinned, policy-allowed, and explicit about gaps. |
| Repository owner / technical lead | Make the right repositories and docs available with predictable limits. | Scope, policy, freshness, and failed repositories are visible before work starts. |
| Product, design, support, operations, or leadership collaborator | Review a technical conclusion and decide the next action. | The explanation is plain-language, cites source evidence, identifies unknowns, and does not require code fluency. |

## Current flow

```text
Configure registry → connect MCP client → agent calls several tools → agent writes an answer
```

The existing server provides reliable primitives, but first-run diagnosis is not yet a deliberate workflow and a human collaborator must trust an agent to translate the tool output. The current answer can be correct while still failing the review task: the reviewer cannot distinguish committed fact, stale evidence, missing evidence, and agent inference.

## Target flows

### A. First grounded answer (technical user)

```text
Install → repocontext doctor → connect MCP client → wiki.catalog → focused search/read/inspect → evidence-backed answer
```

1. The user supplies a registry.
2. `repocontext doctor` checks every entry without reading arbitrary source: Git root, HEAD availability, policy parse, documentation count, and stale/unavailable status.
3. The client starts the existing stdio MCP server.
4. The agent calls `wiki.catalog` before assuming the scope; it then narrows through `wiki.search`, `wiki.get`, `repo.inspect`, `repo.read`, `repo.search`, or `repo.compare`.
5. The agent reports facts with source path and SHA, separates inference, and names an evidence gap rather than filling it with confidence language.

**Why a CLI check:** It solves an onboarding and ownership job without creating a ninth MCP tool or weakening the protocol contract.

### B. Evidence brief (collaborator review)

```text
Question or proposed change → agent gathers RepoContext evidence → wiki.analyze(brief) → reviewable Markdown brief → decision or evidence request
```

1. The agent gathers source evidence through the existing tools.
2. It requests `wiki.analyze` with `operation: "brief"` and one audience: `engineering`, `product`, `support`, or `leadership`.
3. RepoContext returns compact Markdown/JSON built from committed facts. It does not invent an explanation from model reasoning.
4. The agent can add a separately labelled “agent interpretation” section, but cannot present it as RepoContext evidence.
5. A collaborator reviews the brief in the team’s existing tool. There is no separate dashboard to adopt.

## Context Brief contract

The proposed `brief` operation is an extension to an existing tool, so the server remains an eight-tool MCP server.

### Inputs

| Field | Required | Purpose |
| --- | --- | --- |
| `operation: "brief"` | Yes | Selects the bounded brief formatter. |
| `audience` | Yes | Controls terminology and level of detail, never the underlying evidence. |
| `repositories` | No | Limits the selected registered repositories; omission uses the catalog scope. |
| `question` | No | Gives the brief a human-readable title and query context. |
| `base` / `head` | No | Requests an explicit change range when both resolve in the same repository. |

### Outputs

| Section | Content | Evidence rule |
| --- | --- | --- |
| Scope and freshness | Repositories examined, HEAD SHA, snapshot/local mode, and stale or unavailable signals. | Always present. |
| What is known | Bounded statements from docs, manifests, tests, or commit comparison. | Every statement lists source path and commit SHA. |
| Ownership and impact | Repository/component associations and changed paths when evidence supports them. | Never infer ownership from a filename alone. |
| Gaps and limits | Missing documentation, unavailable repositories, denied paths, unresolved query results, and dirty-checkout warning. | Always present, even when empty. |
| Next safe action | Deterministic choices such as “inspect this document,” “validate this command,” or “name an owner.” | Clearly labelled as recommendation, not fact. |
| Technical trace | Expandable source list with path, line, SHA, and operation. | Always available; the audience setting only controls presentation. |

### Example language

```text
Known: The API repository describes payment capture in docs/payments.md at HEAD abc1234.
Limit: The storefront repository has local documentation changes, so its committed evidence may be stale.
Next safe action: Confirm whether the storefront change depends on the API's capture flow before implementation.
```

This is intentionally less exciting than a generated “system intelligence” score. It is more useful because a reviewer can check it.

## State model

| State | Meaning | User-facing response | Allowed next action |
| --- | --- | --- | --- |
| `unconfigured` | No registry or no valid entries. | Explain where the registry belongs and show an example. | Fix registry, then run doctor. |
| `unavailable` | Entry is not a Git root, cannot resolve HEAD, or snapshot is absent. | Name the repository and failure reason. | Fix path or build a valid snapshot. |
| `ready` | HEAD-pinned docs are available and policy is valid. | Show repository, doc count, and commit SHA. | Search or read evidence. |
| `stale` | Working-tree documentation differs from committed HEAD. | Say that committed evidence is older than local documentation. | Commit/review the doc change or treat it as outside evidence. |
| `grounded` | A request returned source-backed evidence. | Show the evidence plus source trace. | Make a labelled inference or continue inspection. |
| `gap` | The requested answer is not supported by committed, exposed evidence. | State exactly what is absent. | Request documentation, an owner, or a bounded source inspection. |

## Information architecture

```text
RepoContext
├── Readiness
│   └── registry, HEAD, policy, doc coverage, stale state
├── Evidence retrieval
│   ├── documentation: catalog, search, get, gaps
│   └── repository: status, manifests, tests, source, search, compare
└── Collaboration output
    └── Context Brief: known facts, gaps, next safe action, technical trace
```

The product should place freshness and gaps beside results, not behind a warning screen or a “confidence” metric. This follows the user-control and source-disclosure requirements in the [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18) and the explanation guidance in [Google PAIR](https://pair.withgoogle.com/guidebook/chapters/trust-and-explanations/crafting-helpful-explanations).

## Interaction rules

- Start every agent workflow with `wiki.catalog` or an explicit repository scope.
- Return no more context than the request needs; preserve paths, lines, commit SHAs, and policy outcomes.
- Use plain language first for a collaborator, with the technical trace available at the point of decision.
- Use `known`, `inference`, and `gap` labels instead of confidence percentages.
- Never treat dirty, untracked, denied, or unavailable material as evidence.
- Never send or persist source content beyond the configured transport. A brief is an on-demand response, not a stored knowledge base.

## Delivery sequence

### P0 — activation and truthfulness

1. Add `repocontext doctor` with explicit exit status and human-readable report.
2. Add a “first grounded answer” quickstart with a sample registry and expected catalog result.
3. Make `wiki.catalog` and `wiki.analyze` language consistently distinguish ready, stale, unavailable, and gap states.
4. Add fixtures that prove all failure states stay explicit and commit provenance remains present.

### P1 — collaboration brief

1. Add `wiki.analyze({ operation: "brief" })` with a strict schema and the output contract above.
2. Build the brief deterministically from existing evidence; do not call a model and do not add storage.
3. Test each audience view against the same evidence to prove that only phrasing and ordering change.
4. Add copyable Markdown examples to the README and documentation.

### P2 — opt-in review handoff

1. Offer a CI-friendly CLI command that emits a brief to stdout for a supplied commit range.
2. Publish a GitHub Action example that only validates and emits an artifact or pull-request comment when explicitly configured.
3. Keep the workflow read-only: no deployment, migration, credential change, or repository write beyond an opt-in review comment.

## Non-goals

- No semantic vector store, database, cache, queue, worker, or background indexer.
- No generic chat interface, project-management suite, or document portal.
- No automatic correctness score for repository documentation.
- No write access to indexed repositories.
- No attempt to replace issue trackers, design tools, code review, or human technical judgment.

## Acceptance signals

| Signal | Target | How to measure |
| --- | --- | --- |
| First grounded answer | A new technical user completes the configured task in 10 minutes or less. | Moderated task timing, including a failed configuration path. |
| Evidence attribution | At least 90% of participant conclusions cite the correct repository and source path. | Blind review against a prepared answer key. |
| Unknown detection | At least 80% of participants identify a deliberately missing doc as a gap rather than asserting an answer. | Scenario test with an omitted architecture document. |
| Brief usefulness | Nontechnical collaborators can correctly select proceed, investigate, or assign an owner without a developer translation. | Decision task and follow-up interview. |
| Trust calibration | Participants distinguish committed fact, stale evidence, and interpretation. | Short comprehension check after each brief. |

## Decision gate

Implement P0 first. Do not build P1 until at least five technical users can complete the activation task and explain the stale/unavailable states. Do not build P2 until both technical and collaborator tests show the brief changes a decision outcome or reduces review time.
