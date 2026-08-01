# Task 2 — Factual announcement and demo package

## Files changed
- `docs/launch.md`
- `docs/demos/release-evidence-brief.claims.json`
- `docs/demos/pr-gate-fail-to-pass.artifact.json`
- `docs/demos/pr-gate-fail-to-pass.md`
- `docs/demos/pr-gate-fail-to-pass.svg`
- `src/launch-readiness-truth.test.ts`
- `.superpowers/sdd/launch-readiness/task-2-report.md`

## Decisions
- Kept announcement and community copy strictly within v0.6.0 scope and removed language that could imply adoption/certification/security proof or product-market-fit claims.
- Added the required canonical versioned links for npm, GitHub Action workflow/setup, MCP Registry, GitHub release, and Pages.
- Built a deterministic synthetic fail-to-pass PR evidence artifact around fixed SHAs and one uncovered then covered locator on `docs/protocol.md`.
- Added a static visual artifact with `<title>/<desc>` and explicit alt text/caption references.
- Added focused tests to lock version, canonical links, coverage claims, and prohibited claim-boundary terms.
- Used only deterministic fixture values and repository-owned canonical paths.

## Commands and results
- `pnpm test -- src/launch-readiness-truth.test.ts`  
  Result: pass (`80 passed`)
- `pnpm validate`  
  Result: pass (all checks green), including:
  - `{"clients":4,"status":"valid"}`
  - `{"entries":8,"status":"valid"}`
  - `{"name":"io.github.shmindmaster/gitpin","version":"0.6.0","package":"gitpin","transport":"stdio","publication":"manual-oidc","status":"matched"}`
  - `{"tag":"v0.6.0","version":"0.6.0","serverVersion":"0.6.0","releaseDate":"2026-07-31","status":"matched"}`

## Commit
- Primary Task 2 implementation: `c09601dfe0352df7b230f9f1be58d999e512a50b`
- Task 2 report file (this file): `9fb0594f4f67a0f5f4dd9e3f2de0e0f8b6e3c3a2`

## Self-review
- Updated synthetic artifact and tests so the canonical release version is explicit in artifact markdown and JSON (`v0.6.0`).
- Confirmed claim-boundary filtering in copy by test assertions (`adoption`, `security proof`, `product-market-fit`, `certif`).
- Confirmed deterministic fail-to-pass flow in fixture JSON uses fixed SHAs, path, and line span.

## Concerns
- No functional concerns after validation. No remaining test or release-gate blockers.
- `.git` validation emits workspace-wide LF→CRLF notices for touched/unrelated files, but no content changes were made outside Task 2 scope.
