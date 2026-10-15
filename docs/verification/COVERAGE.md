# GitPin Coverage Matrix

Scope: GitPin 0.6.4 at `e4c550e`. Rungs use the evidence ladder: Planned, Implemented, Integrated, Tested, Demonstrated, Production-Verified.

How to read the rung column: it is the highest rung this pack can support from what was read or checked. Source and file paths give Implemented. A live trace through the pieces gives Integrated; none was run for this pack, so Integrated is claimed only where the repo's own test drives the real CLI entry point (and the result is in [TESTS.md](TESTS.md), not asserted here). "Tested" needs an executed command with a result; the test run column points to [TESTS.md](TESTS.md). "Demonstrated" comes from the delivered films, listed in [DEMOS.md](DEMOS.md). "Production-Verified" needs a deployed SHA plus a health check and a smoke test of the path; only the three checks in the deploy column were made.

## Evidence matrix

| Capability | Journey | Surface | Logic module | Integration | Test files | Test run | Demo | Deploy status | Rung |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PR evidence gate (`gitpin gate --base --head`) | Run gate locally; fix failed gate | CLI | `src/gate.ts`, `src/gate-policy.ts`, `src/gate-types.ts`, `src/cli-gate.ts` | Local `git` only | `src/gate.test.ts`, `src/gate-hero.test.ts` | see TESTS.md | see DEMOS.md: gate fails on `uncovered-change` at exit 1, a claim with line + sha256, gate passes at exit 0, plain-git sha256 recheck, `gate.ts` coverage code | npm `gitpin` 0.6.4 matches main's version (checked `npm view`) | Demonstrated (films); Tested pending TESTS.md |
| Coverage by merge-base diff and `uncovered-change` | Fix a failed gate | CLI | `src/gate.ts:48-60,169-173` | Local `git` | `src/gate.test.ts`, `src/gate-hero.test.ts` | see TESTS.md | see DEMOS.md | as above | Demonstrated (films) |
| Base policy, `policyChanges: block`, limits | Install policy; run gate | CLI, Action | `src/gate-policy.ts`, `src/gate.ts:61-67` | Local `git` | `src/gate.test.ts` (base policy, blocked policy change) | see TESTS.md | see DEMOS.md (policy trust boundary is not named in the facts given; check there) | as above | Implemented; Tested pending TESTS.md |
| Per-claim line-slice sha256 verify | Run gate; plain-git recheck | CLI, Action | `src/gate.ts:108-115` | Local `git` | `src/gate.test.ts` (hash mismatch, deleted file, replace refs) | see TESTS.md | see DEMOS.md | as above | Demonstrated (films) |
| Hero fixture `pnpm demo:gate` | Hero demo | CLI | `scripts/demo-gate-hero.mjs` | Synthetic scratch git repo | `src/gate-hero.test.ts` | see TESTS.md | see DEMOS.md | Local only; labelled synthetic | Demonstrated (films) |
| GitHub Action | Run gate in CI | Action | `action.yml`, `scripts/render-gate-action-report.mjs` | npm registry (installs `gitpin@0.6.4`), GitHub runner | `src/gate-action.test.ts`; self-run via `.github/workflows/evidence-gate.yml` | see TESTS.md; hosted workflow runs not checked | Not in the films' list above | Action pinned to release commit `514799c`; hosted runs not checked | Implemented; Integrated not checked |
| 12 `pin.*` MCP tools, stdio | Connect client; prove; verify | MCP | `src/server.ts`, `src/pin-tools.ts`, `src/wiki*.ts`, `src/git*.ts` | MCP SDK, local Git | `src/wiki.test.ts`, `src/git.test.ts`, `src/evidence.test.ts`, `src/structure.test.ts` | see TESTS.md | Not shown in the two films | npm 0.6.4; no real MCP client session checked | Implemented; Tested pending TESTS.md |
| MCP over HTTP (bearer, host allowlist, health) | Serve over HTTP | MCP | `src/http.ts` | MCP SDK Streamable HTTP | `src/http.test.ts` | see TESTS.md | Not shown | Container and remote deploy scripts exist (`Dockerfile.remote`, `scripts/verify-remote.mjs`, `deploy/`); no deployed instance checked | Implemented; works-locally-only as far as checked |
| Evidence prove / prove-set | Prove a claim | MCP, CLI | `src/evidence-prove.ts`, `src/evidence-set.ts`, `src/evidence-citation.ts` | Local Git | `src/evidence.test.ts` | see TESTS.md | Not shown | npm 0.6.4 | Implemented; Tested pending TESTS.md |
| Evidence verify / verify-set / verify-cites | Verify a claim; verify citations | MCP, CLI | `src/evidence-verify.ts`, `src/cli-verify.ts` | Local Git | `src/evidence.test.ts`, `src/cli.test.ts` | see TESTS.md | Plain-git recheck appears in the films (see DEMOS.md) | npm 0.6.4 | Implemented; Tested pending TESTS.md |
| Setup and health (`init`, `doctor`, `brief`) | Connect an MCP client | CLI | `src/onboarding.ts`, `src/doctor.ts`, `src/context-brief.ts` | Client config files on disk | `src/onboarding.test.ts`, `src/doctor.test.ts` | see TESTS.md | Not shown | npm 0.6.4 | Implemented; Tested pending TESTS.md |
| Pages site | View product page | Site | `site/`, `scripts/build-site.mjs` | GitHub Pages | `tests/browser/site.spec.mjs`, `tests/browser/analytics-privacy.spec.mjs`, `src/site-build.test.ts` | see TESTS.md | Not shown | https://shmindmaster.github.io/gitpin/ returned HTTP 200 (`curl -sI`, 2026-10-15); deployed SHA not checked | Production-Verified for reachability only; deployed SHA and content not checked |
| MCP Registry listing | Discover server | Registry | `server.json` | MCP Registry | `scripts/verify-mcp-registry.mjs` (run by `pnpm validate`) | see TESTS.md | Not shown | Registry lists `io.github.shmindmaster/gitpin` 0.6.4 as `isLatest: true`, status active (checked 2026-10-15) | Production-Verified for the listing; install from the registry not checked |
| npm package | Install `npx gitpin` | CLI | `package.json`, `scripts/verify-package.mjs`, `.github/workflows/release.yml` | npm | `src/launch-readiness-truth.test.ts` (version drift), `src/launch-readiness-task3.test.ts` | see TESTS.md | Not shown | `npm view gitpin version` returned 0.6.4, equal to main | Production-Verified for the published version; fresh-install smoke test not checked |

## Integrations

| Integration | Direction | Verification level | Evidence |
| --- | --- | --- | --- |
| npm (`gitpin`) | Publish; Action installs from it | Published version checked: 0.6.4. Install and run from the registry not checked | `npm view gitpin version` |
| MCP Registry | Publish; clients discover | Listing checked: 0.6.4 latest, active. Client install via registry not checked | Registry v0.1 search for `io.github.shmindmaster/gitpin` |
| GitHub Pages | Deploy site | HTTP 200 checked. Deployed SHA and content not checked | `curl -sI` on the homepage |
| GitHub Action | Consumer CI | Defined and self-run in this repo's workflow; hosted run results not checked | `action.yml`, `.github/workflows/evidence-gate.yml` |
| MCP clients (Claude Code, Codex, Cursor and others) | stdio and HTTP | Config templates validated by `pnpm verify:clients` (not run here). No live client session checked | `docs/clients.md`, `scripts/validate-client-configs.mjs` |
| GitHub rulesets and auto-merge | Required check, merge | Workflow exists; ruleset settings not checked | `.github/workflows/auto-merge-owner-prs.yml` |
| PostHog (site analytics) | Site to PostHog | Opt-out logic exists with a privacy spec; live capture not checked | `site/analytics.js`, `tests/browser/analytics-privacy.spec.mjs` |

## Lists

**UI without backend:** none found. The site is static and the product has no interactive UI.

**Backend without UI:** all of it by design (CLI, Action, MCP). Two items have no demo: the HTTP transport and the MCP tools (the films cover the gate only).

**Untested integrations (no executed test or live check in this pack):**
- GitHub Action as run on GitHub's hosted runners
- A real MCP client session over stdio or HTTP
- MCP Registry install path from a client
- A deployed HTTP instance
- Fresh `npx gitpin` install from npm

**Works locally only (as far as checked):**
- `pnpm demo:gate` (synthetic repo in a scratch directory)
- HTTP MCP server (tests use a local server)
- Local snapshot index (`pnpm index:build`)
- The gate against a real repository other than GitPin's own: not checked

**Pending, not evaluated:** PR #101 (faster git fixture tests, gate text output) and PR #102 (HTTP loopback by default, validate Origin). Both could change rows above once merged.
