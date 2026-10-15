# GitPin Verification Pack

Pack for GitPin 0.6.4. The code was read at `e4c550e`; the suites ran at main `90598a1`. This is evidence about the product, not marketing. Where a check was not run it says "not checked".

## Purpose

GitPin checks that what a pull request says it changed matches what the diff actually changed, and that every claim points at exact committed content. The check is deterministic Git and SHA-256. There is no model, database or index in the gate.

Agents write PRs whose descriptions overstate the diff. GitPin makes a reviewer's job "re-run one `git show` and compare a hash" instead of "trust the description".

## Users

- PR authors and coding agents: commit a change-evidence manifest, run the gate locally.
- Reviewers: read the JSON report and recheck any locator with plain `git show`.
- CI owners and platform or security engineers: make the gate a required check.
- MCP clients (Claude Code, Codex, Cursor and others): call the `pin.*` tools to find, prove and verify evidence.

## What makes it different

- Policy comes from the base commit, so a PR cannot weaken its own gate.
- Coverage comes from the real merge-base diff, not from what the PR says it touched.
- Evidence is a line slice plus its SHA-256 at a full commit SHA, rechecked with `git show`, never from a working tree.
- Honest scope: it proves coverage, location, revision and hash. It does not prove the claim text is true. See [docs/pr-evidence-gate.md](../pr-evidence-gate.md).

Existing assessment (reused, not rewritten): `reports\showcase\gitpin.md` in the AgentHub dispatch runtime folder (assessment dated 2026-10-14).

## Capability inventory

| Capability | Where | Notes |
| --- | --- | --- |
| PR evidence gate: `gitpin gate --base --head` | `src/gate.ts`, `src/gate-policy.ts`, `src/cli-gate.ts` | Exit 0 or 1, JSON report on stdout. [docs/pr-evidence-gate.md](../pr-evidence-gate.md) |
| 12 `pin.*` MCP tools over stdio | `src/server.ts`, `src/pin-tools.ts` | Read-only. [docs/tools.md](../tools.md) |
| Same tools over HTTP (`/api/mcp`, bearer token) | `src/http.ts` | [docs/remote-deployment.md](../remote-deployment.md) |
| Evidence prove and verify (CLI `verify`, `prove-set`, `verify-cites`) | `src/evidence-*.ts`, `src/cli-verify.ts` | [docs/cite-spec.md](../cite-spec.md) |
| Citations (`repo/path:line @ fullSha`, `gitpin:` handles) | `src/evidence-citation.ts` | |
| GitHub Action | `action.yml`, `scripts/render-gate-action-report.mjs` | Runs the published npm `gitpin` at a pinned version. [docs/ci.md](../ci.md) |
| Pages site | `site/`, `scripts/build-site.mjs`, `.github/workflows/pages.yml` | https://shmindmaster.github.io/gitpin/ |
| MCP Registry listing | `server.json`, `.github/workflows/publish-mcp.yml` | `io.github.shmindmaster/gitpin` |
| Hero fixture: `pnpm demo:gate` | `scripts/demo-gate-hero.mjs`, `src/gate-hero.test.ts` | Synthetic repo, fail then pass. [docs/demos/](../demos/) |
| Setup and health: `init`, `doctor`, `brief` | `src/onboarding.ts`, `src/doctor.ts`, `src/context-brief.ts` | Not covered in depth in this pack |

## Pack contents

- [FUNCTIONAL.md](FUNCTIONAL.md): roles, journeys, rules, errors, gaps.
- [TECHNICAL.md](TECHNICAL.md): architecture diagram, auth, CI/CD, and the line-level trace of `gitpin gate`.
- [COVERAGE.md](COVERAGE.md): capability-by-evidence matrix and integrations.
- [TESTS.md](TESTS.md): executed test commands and results (written separately).
- [DEMOS.md](DEMOS.md): film catalog (written separately).
- [READINESS.md](READINESS.md): verdict and status block (written separately).

Delivered films, recorded at `e4c550e`:

- `D:\OneDrive - Maya Modest LLC\Videos\Portfolio\GitPin\01 - The Gate That Wants Evidence.mp4`
- `D:\OneDrive - Maya Modest LLC\Videos\Portfolio\GitPin\02 - The Gate in 30 Seconds.mp4`
