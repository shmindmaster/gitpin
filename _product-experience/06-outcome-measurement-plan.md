# RepoContext outcome measurement plan

**Status:** proposed research plan; no product analytics or participant research has been authorized  
**Purpose:** test whether RepoContext improves safe cross-repository understanding, rather than merely increasing tool use.

## Primary hypotheses

| Hypothesis | Success condition | Failure signal |
| --- | --- | --- |
| H1: Commit-pinned, bounded evidence improves codebase understanding. | Technical participants locate the correct repository, source, and validation path faster than a normal exploratory baseline. | They still browse broadly or treat the server as another search box. |
| H2: Explicit stale, unavailable, and gap states reduce unsupported conclusions. | Participants name the limit and request the next evidence instead of guessing. | They ignore the warning or interpret it as a low-quality score. |
| H3: A Context Brief helps nontechnical collaborators make a correct next-step decision. | They correctly classify a proposal as proceed, investigate, or assign an owner without code translation. | They cannot explain what the brief knows, excludes, or cites. |
| H4: The product can activate without a dashboard. | Users share/copy the brief into their existing decision workflow. | They demand a separate portal before the brief is useful. |

## Research design

Use a small, moderated, comparative study. Each participant completes a realistic task with:

1. Normal repository and document exploration.
2. The existing eight-tool RepoContext workflow.
3. The proposed evidence brief, after the technical workflow is complete.

Prepare two fixtures: one healthy multi-repository system and one with a deliberately missing architecture document plus stale local documentation. Do not use customer repositories, secrets, or unreviewed source material.

### Participants

| Segment | Count | Recruitment profile |
| --- | --- | --- |
| Technical | 5 | Engineers, agent-heavy developers, technical leads, or platform owners who work across at least two repositories. |
| Collaborator | 5 | Product, design, support, operations, or leadership participants who review engineering change information but do not rely on raw code daily. |

### Tasks

1. “Which repository owns this behavior, and what must be validated before changing it?”
2. “A proposed change affects two repositories. Can it proceed, what is missing, and who should resolve it?”

Ask participants to state their answer, cite what they used, and name what they would do next. The moderator records only task outcomes and consented feedback; the product itself should not add telemetry.

## Measures

| Measure | Definition | Target for a promising P1 result |
| --- | --- | --- |
| Time to grounded conclusion | Time until the participant gives a sourced answer or explicitly declares a gap. | Better than baseline for 7 of 10 participants. |
| Correct source attribution | Correct repository, path, and revision identified. | 90% or higher across technical tasks. |
| Unsupported-claim rate | Statements not supported by the prepared fixture. | Lower than baseline; zero in the deliberate-gap scenario is the aspirational target. |
| Gap recognition | Participant names stale, unavailable, denied, or missing evidence. | 80% or higher. |
| Decision accuracy | Correct proceed / investigate / assign-owner classification. | 80% or higher for collaborators. |
| Explanation comprehension | Participant explains what the evidence does and does not establish. | 80% or higher. |
| Perceived burden | Participant identifies the smallest point of friction. | A single recurring blocker drives the next iteration. |

## Decision rules

- **Build P1 Context Brief:** Technical users activate within the target and collaborators meet decision-accuracy and explanation-comprehension targets.
- **Revise P0:** Setup, catalog state, or source trace prevents task completion more than once across the study.
- **Do not build a dashboard:** Participants can consume the brief in their existing workflow and do not demonstrate a durable unmet navigation need.
- **Stop or narrow the product:** Cross-repository evidence is not selected over ordinary repository exploration in the prepared tasks.

## Privacy and operational guardrails

- Obtain participant consent before recording notes or sessions.
- Use only synthetic or explicitly approved fixtures.
- Do not collect prompts, repository contents, commit SHAs, tokens, or participant identifiers in product telemetry.
- Store research notes outside indexed repositories and separate observed feedback from product decisions.
- External recruitment, user interviews, and publication of findings require maintainer approval.
