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

## Fix round 1
- Finding: launch documentation still contained `gitpin@latest` install/bootstrap commands, which conflict with version-correct 0.6.0 launch artifacts.
- Files changed:
  - `docs/launch.md`
  - `src/launch-readiness-truth.test.ts`
  - `.superpowers/sdd/launch-readiness/task-2-report.md`
- Verification run: `pnpm test -- src/launch-readiness-truth.test.ts` and `pnpm validate`
- Status: implemented

## Terminal review correction (2026-08-01)

- The original fixed-SHA artifact was rejected because its commits and handwritten gate output were not reproducible.
- `scripts/build-pr-gate-fail-to-pass-artifact.mjs` now creates a temporary synthetic Git repository with fixed identities and timestamps, runs the built GitPin 0.6.0 gate for the fail and pass heads, and generates the JSON, Markdown, and SVG from the real reports.
- Reproducible fixture evidence:
  - base `43439f836e8f7ac27e5f41587caba435b758a4cc`
  - failing head `f0137d966ec3283719c095b46215adffb08588ce` with exit status `1`
  - passing head `57bce1a312f6153e171b515c41727ff81e77fb3c` with exit status `0`
  - artifact SHA-256 `3e0947288f8c1264292c8f797393d5a980664cc1a596a9c243c8c801fdef5641`
- Launch commands now use the pinned non-hanging `npx -y gitpin@0.6.0 init --client codex` setup path, and evidence examples use the canonical full-SHA citation and handle formats.
- Verification: generator `--verify`, `pnpm validate` (`15` files / `84` tests), and `pnpm site:test` (`40` browser tests) all passed.
- The terminal closeout commit contains the executable fixture, corrected artifacts/copy, and regression tests; no release, deployment, push, or publication was performed.
