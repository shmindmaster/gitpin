# Task 3 completion report

## Status
- Scope completed in worktree `C:\wt\gitpin\launch-evidence-v060` on branch `agent/launch-evidence-v060`.
- Task 3 implementation and documentation changes were previously completed in worktree `C:\wt\gitpin\launch-evidence-v060`.
- This fix round addresses independent review issues and updates Task 3 privacy, protocol, and assertions.

## Scout findings integrated
- Preserved existing partial edits in:
  - `.github/ISSUE_TEMPLATE/launch_feedback.md`
  - `docs/website.md`
  - `site/analytics.js`
  - `site/index.html`
  - `tests/browser/site.spec.mjs`
  - `src/launch-readiness-task3.test.ts`
- Verified `data-analytics-event` surfaces against the real index HTML and aligned strict allowlists.
- Tightened event property behavior to reject unknown/missing/extra properties and reject unknown event names.
- Added explicit launch protocol and fixture records for reproducible synthetic sessions and explicit synthetic-only status.
- Added explicit template safety language so issue text is optional and not analytics.

## Files changed
- `.github/ISSUE_TEMPLATE/launch_feedback.md`
- `docs/website.md`
- `site/analytics.js`
- `site/index.html` (existing Task 3 markup from prior partial edits retained)
- `tests/browser/site.spec.mjs`
- `src/launch-readiness-task3.test.ts`
- `.superpowers/sdd/launch-readiness/task-3-measurement-protocol.md`
- `.superpowers/sdd/launch-readiness/task-3-measurement-fixture.json`
- `.superpowers/sdd/launch-readiness/task-3-report.md`
- `site/privacy.html`

## Decisions
- Keep schema strict for all click instrumentation and refuse partial or expanded payloads.
- Keep launch-funnel signals limited to intent and progression events; explicitly reject inferred installation/pass claims from site clicks.
- Preserve synthetic-only evidence path for observed-validation sessions and mark real sessions as pending and incomplete.
- Keep GitHub issue body as human feedback only; do not claim telemetry collection in-template.
- Keep existing analytics event taxonomy and page instrumentation mostly intact while adding deterministic invariants and checks.

## Commands and results
- `pnpm test -- src/launch-readiness-task3.test.ts`
  - Result: pass (`15` test files, `84` tests).
- `pnpm site:test -- --grep "launch-funnel analytics events only emit strict allowlisted payloads"`
  - Initial result: fail because the browser mock inspected the loaded SDK instead of PostHog's pre-load init queue; the harness was corrected.
  - Final result: pass (`4` browser variants).
- `pnpm validate`
  - Initial result: one formatter-only failure in the new cross-functional assertion; formatting was corrected.
  - Final result: pass (lint, format, typecheck, client/CI/env/registry/release checks, `84` tests, and site build).

## Self-review
- Verified strict reject behavior at browser runtime for:
  - unknown event names
  - unknown surface/property values
  - missing required property (`surface`)
  - extra funnel properties
  - extra CTA properties
- Updated protocol/fixture to explicitly define:
  - event sequence ordering and denominators/numerators
  - analysis windows and deduplication caveats
  - instrumentation/observed/inferred/PMF boundaries
  - two-session synthetic protocol for technical and cross-functional participants
  - exact fields for scoring: time-to-install, time-to-first-pass, unsafe-assumption, attribution correctness, friction
- Updated issue template to explicitly warn against repository/private/personal data and avoid analytics mischaracterization.

## Concerns
- Real participant sessions remain pending by design in this task scope; no actual sessions were completed.
- No production deployment or rollout gate changes were executed in Task 3.

## Commit
- Implementation commit: `3122c19ce7cde9e6a85e6ee8edadaed211db8eee`
- Report-reference commit: `457ed0980156f5b27546abeff83f6aef7fc83bd4`
- Fix round 1 commit: `014757dff4abe2f59aa1ae73903b9643bce2c143`

## Fix round 1

### Findings
- High risk: PostHog automatic pageview/pageleave collection was still enabled, which could emit URL/page context outside allowlist.
- Medium risk: `time_to_first_pass_seconds` was omitted from cross-functional session required captures despite task protocol requiring both sessions.
- Medium risk: launch schema validation in `src/launch-readiness-task3.test.ts` compared `launchEventSchema` to itself for property keys and did not directly align with fixture schema.

### Files
- `site/analytics.js`
- `docs/website.md`
- `site/privacy.html`
- `tests/browser/site.spec.mjs`
- `src/launch-readiness-task3.test.ts`
- `.superpowers/sdd/launch-readiness/task-3-measurement-protocol.md`
- `.superpowers/sdd/launch-readiness/task-3-measurement-fixture.json`
- `.superpowers/sdd/launch-readiness/task-3-report.md`

### Commands and results
- `pnpm test -- src/launch-readiness-task3.test.ts`: pass (`15` test files, `84` tests).
- `pnpm site:test -- --grep "launch-funnel analytics events only emit strict allowlisted payloads"`: pass (`4` browser variants) after correcting the PostHog init-queue mock.
- `pnpm validate`: pass after one formatter-only repair.

### Status
- Implemented, validated, and ready for scoped re-review.

### Concerns
- Cross-functional synthetic fixture still marks `time_to_first_pass_seconds` as `null` when `first_pass_intent` is not observed.
- Real participant sessions remain pending and unchanged.
