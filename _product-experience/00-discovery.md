# RepoContext product discovery

**Status:** research-backed direction; user validation has not yet occurred  
**Date:** 2026-07-28  
**Decision:** Keep RepoContext focused on verifiable, cross-repository context. Add a human-readable evidence brief as a second surface, not a generic AI workspace or dashboard.

## Outcome

A coding agent or a collaborator should be able to answer, in minutes rather than an exploratory hunt:

1. Which repository owns this behavior?
2. What is true at a specific committed revision?
3. What changed, what is undocumented, and what requires a human decision?

The answer must identify its source paths, commit SHA, freshness, and coverage limits. A collaborator who does not read code must be able to understand the conclusion without being asked to trust an opaque summary.

## Research method and limits

This is desk research plus a product/code audit. It used official protocol and product documentation, two recent research papers on codebase navigation and AI-assistant needs, and direct review of adjacent open-source projects. It did **not** include interviews, telemetry, or usability sessions. Findings about nontechnical users are therefore informed design hypotheses, not validated market claims.

| Evidence | Confirmed finding | Product implication | Confidence |
| --- | --- | --- | --- |
| [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18) | People must understand and control data exposure and tool operations; hosts must protect data and gain consent. | Keep read-only defaults, explicit scope, sensitive-path denial, and clear transport differences. Never hide what a tool can access. | High |
| [GitHub Copilot repository instructions](https://docs.github.com/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot) | Agents need a repository summary, architecture, build/test/validation steps, and working command sequences to avoid repeated exploration and failure. | Optimize for structured, current evidence about those exact facts; surface missing coverage rather than pretending it exists. | High |
| [Code Compass need-finding study](https://arxiv.org/html/2405.06271v1) | Participants struggled to connect code with relevant documentation and repeatedly switched among IDE, docs, and online sources. | Put documentation and code evidence in one bounded response, with a source link and line-level reference. | Medium-high |
| [Developer needs for AI assistants](https://dl.acm.org/doi/10.1145/3786583.3786883) | Qualitative interviews identify codebase navigation, onboarding, proactive documentation, maintenance, workflow optimization, and control as distinct needs. | Do not reduce the product to search. Support onboarding, evidence retrieval, and documentation-gap detection as separate jobs. | Medium-high |
| [Google PAIR guidance](https://pair.withgoogle.com/guidebook/chapters/trust-and-explanations/crafting-helpful-explanations) | Trust improves when systems disclose influential data sources, limitations, and next actions at the moment a person decides whether to use an output. Different audiences need different explanation depth. | Every conclusion needs provenance, freshness, explicit gaps, and an audience-appropriate explanation—not a confidence score. | High |
| [GitMCP](https://github.com/idosal/git-mcp) and [Context7](https://github.com/upstash/context7) | The category already has low-friction MCP access to public repository docs and up-to-date library docs. | Differentiate on multi-repository, commit-pinned evidence, stale-working-tree signals, policy-controlled exposure, and a collaboration-ready brief. | Medium |

CrewScore is a useful public-project communication reference: immediate value, a short install path, declared limits, visible quality checks, and a clear contribution path. It is not evidence that its specific feature set should be copied. See the [CrewScore repository](https://github.com/shmindmaster/crewscore).

## Users, jobs, and pain points

### 1. Coding agent and hands-on engineer

**Job:** Safely understand an unfamiliar or distributed system before changing it.

**Current pain:** Context is fragmented across repositories, source, docs, workflows, and issue history. The agent either searches broadly, assumes the first relevant-looking file is authoritative, or asks the engineer to manually assemble context. Documentation can be stale even while a local checkout looks current.

**Need:** A small evidence set that says where the answer came from, at what commit, whether the checkout has changed since then, and what evidence is absent.

**Product response:** Keep `wiki.catalog`, `wiki.search`, `wiki.get`, `repo.inspect`, `repo.read`, `repo.search`, and `repo.compare` deterministic and bounded. Improve their orchestration, not their autonomy.

### 2. Technical lead, repository owner, or platform engineer

**Job:** Make agents productive without giving them uncontrolled access or repeatedly explaining the same system.

**Current pain:** Setup is easy to misconfigure; the effective repository scope is hard to see; poor documentation is discovered only after an agent makes a weak plan; and an opaque retrieval layer is difficult to audit.

**Need:** A visible registry health check, explicit exposure policy, reproducible source provenance, and a prioritized documentation-coverage view.

**Product response:** Make first-run readiness and coverage failures first-class. A useful result is sometimes “this repository is unavailable” or “this claim has no committed evidence.”

### 3. Product, design, support, operations, and leadership collaborators

**Job:** Understand technical ownership, change impact, known gaps, and the next decision without interpreting raw code search.

**Current pain:** They receive an agent answer that is either too technical to verify or too simplified to trust. They cannot tell which repository was inspected, whether the information is current, or whether an assertion is observed fact versus an inference.

**Need:** A concise, reviewable brief in plain language with sources, scope, freshness, and unanswered questions. They do not need a source-code browser or a generic chatbot.

**Product response:** Provide an on-demand, deterministic **Context Brief** produced from the same MCP evidence. It should translate evidence structure into a decision artifact while preserving source paths and commit SHAs.

## Product thesis

**RepoContext is the evidence layer for agents working across repositories; Context Brief is the collaboration layer for humans reviewing their work.**

The technical user gets fast, bounded retrieval. The nontechnical collaborator receives a short explanation of the same evidence: affected repositories, what changed or is known, source trace, freshness, gaps, and the next safe action. Neither surface should claim semantic completeness or replace review.

## Constraints that remain product advantages

- Git, not a database or vector index, remains the source of truth.
- Reads stay commit-pinned; dirty and untracked work are not silently treated as evidence.
- Sensitive paths remain denied before read or snapshot.
- Stdio may serve local source only to the configured client; HTTP remains documentation-only and bearer-protected.
- Brief generation is on demand. It introduces no worker, queue, database, telemetry pipeline, or write access to indexed repositories.

## Risks and disconfirming evidence to seek

| Risk | Why it matters | Validation needed |
| --- | --- | --- |
| A brief may merely duplicate an agent's prose. | It adds no product value unless it makes review materially faster and safer. | Compare a sourced brief with a normal agent answer in a decision-review task. |
| Nontechnical collaborators may prefer existing issue trackers and docs. | A new destination would slow adoption. | Test export/copy into the team’s existing review channel before designing a UI. |
| Users may not understand SHA or stale states. | Provenance could become visual noise. | Test plain-language freshness labels with an expandable technical trace. |
| Cross-repository context may not be the first adoption wedge. | Setup could be too much for a single-repository user. | Measure time-to-first-grounded-answer with one and three repositories. |
| “Documentation gaps” can be mistaken for a quality score. | Teams could optimize counts rather than clarity. | Require each gap to state the missing artifact and the affected task. |

## Validation plan before committing major product scope

Recruit five technical participants (agent-heavy engineers, tech leads, or platform owners) and five collaborators who routinely make decisions from engineering information. Use two realistic tasks:

1. Identify the owner and validation path for a cross-repository change.
2. Decide whether a proposed change can proceed, is blocked by missing evidence, or needs a named owner.

Compare normal repository exploration, the existing eight-tool workflow, and an evidence brief. Capture completion time, correct source attribution, correct identification of unknowns, and whether participants would act without asking a developer to translate the result. Recruitment and external interviews require separate maintainer authorization.
