# GitPin v0.6.2 forward-patch SDD report

Date: 2026-08-01 (America/Chicago)

## Scope and outcome

This focused forward patch prepares GitPin 0.6.2 from exact base
`a9c6dc7ce3518cba7d10aea39e44f30e56072f25`. It changes only the website analytics privacy boundary, its
request-level tests, the version-coherence surfaces required for a release, and this evidence report.

The CLI, stdio MCP server, HTTP MCP server, package verifier, and container remain telemetry-free. No PostHog
project setting was changed, and this branch was not pushed, tagged, published, or deployed.

## Specification

The website must:

- expose a prominent native opt-out button on the homepage and privacy page;
- persist the opt-out when browser storage is available;
- avoid loading the PostHog SDK when an opt-out is already stored;
- stop subsequent capture immediately when opt-out is activated at runtime;
- fail closed without loading analytics when preference storage cannot be read, written, or cleaned up;
- inject the same configured PostHog project and API host into every analytics-enabled built page while leaving the
  repository source telemetry-free;
- add `$geoip_disable: true` to every permitted outbound event;
- prevent feature-flag and remote-configuration requests outside the explicit event transport;
- preserve the strict event/property/transport allowlist, `traffic_class`, autoplay silence, and removal of
  URL/referrer/browser/device and canary-shaped enrichment;
- distinguish the active browser controls from the still-unverified PostHog project-level raw-IP discard setting.

## TDD evidence

### Red

Command:

```powershell
pnpm exec playwright test tests/browser/analytics-privacy.spec.mjs --project=chromium --workers=1
```

Observed before implementation: 6 tests ran; 5 failed for the intended missing behaviors and the pre-existing hero
autoplay-silence behavior passed. The failures proved that the controls did not exist, a stored opt-out and unavailable
storage still loaded the SDK, runtime capture continued, and `$geoip_disable` was absent.

### Green

The same command passed 6/6 after the minimal implementation. The combined focused regression command then passed
11/11:

```powershell
pnpm exec playwright test tests/browser/site.spec.mjs tests/browser/analytics-privacy.spec.mjs --project=chromium --workers=1 --grep "analytics|autoplay|opt-out|storage|geo-IP|canary"
```

The request-level harness executes the real `site/analytics.js`, substitutes only the external PostHog SDK, and
inspects browser requests to the capture and feature-flag endpoints. It proves the SDK-load boundary, exact outbound
JSON, runtime stop, autoplay silence, canary absence, storage failure behavior, and absence of feature-flag requests.

Independent review then identified that PostHog could make an initialization-time `/flags` request outside
`before_send`. The strengthened request harness reproduced the issue: the focused geo-IP test failed with a canary in
that unexpected request. Adding `advanced_disable_flags: true` closed the bypass; the strengthened test and complete
suite were rerun before the remediation commit.

Hosted review initially raised six findings. The one-way opt-out control incorrectly exposed toggle-style
`aria-pressed` state even though activation leaves the one-way control disabled; the attribute was removed and the
keyboard, disabled-state, persistence, and status coverage now explicitly assert the resulting button semantics. The
three findings proposing replacement of `advanced_disable_flags` with `advanced_disable_decide` were rejected
against the current official PostHog type contract at commit
`57f371e540968afaa8a0fe9aec8a53ef1db6b654`: `advanced_disable_flags` is the current option, while
`advanced_disable_decide` is explicitly deprecated in favor of it. The production option, request harness, and earlier
report statement therefore remain unchanged.

The remaining two findings were valid. A browser could allow storage reads but reject writes, which allowed analytics
to initialize even though a runtime opt-out could not persist across navigation. A fixed, non-identifying storage
writability probe now verifies read, write, and removal before initialization without changing the existing opt-out
key; any failure disables analytics before SDK load. Red coverage observed three SDK loads across the original page,
reload, and navigation when `setItem` failed, plus one SDK load when probe cleanup failed. Both cases now produce zero
SDK or capture requests and preserve the pre-existing opt-out-key value.

The configured site build also injected the PostHog project only into `index.html`, leaving the analytics-enabled
privacy page unconfigured. The new build regression failed for both source/API-host emptiness and missing privacy-page
configuration. The builder now discovers every HTML page that loads `analytics.js`, requires empty configuration
placeholders, and injects the same project key and API host into each output page. Repository source and unconfigured
build output remain empty.

After both later remediations, the combined focused privacy/site command passed 13/13 and the configured-site build
regression passed 2/2.

A later independent review raised two more findings. The homepage's claim that analytics could be turned off
“permanently” overstated browser storage durability; a regression failed on that wording, and the homepage, privacy,
website, changelog, and launch surfaces now state that the browser-stored choice lasts until site data is cleared. The
second finding requested runtime-only storage-failure coverage. The new characterization test passed before any runtime
logic changed: after the SDK had loaded, a failed opt-out write stopped current-page capture immediately, reported that
persistence was unavailable, and caused both reload and navigation to fail closed without another SDK or capture
request while writes remained blocked. No product-code change was required for that already-correct behavior. The
complete Chromium privacy/site boundary passed 31/31 after the copy correction and added regression.

## Full validation evidence

- `pnpm validate` — passed after the remediations: 16 Vitest files, 90 tests, lint, format check, typecheck, client/CI/env/MCP/tag
  verifiers, site build, and deterministic demo verification.
- `pnpm build` — passed.
- `pnpm verify:package` — passed for `gitpin-0.6.2.tgz`; clean install, initialization, doctor, context brief,
  first answer, PR evidence gate, and public docs were verified.
- `pnpm site:test` — passed 124/124 across Chromium, Firefox, WebKit, and mobile Chromium.
- Focused release truth — 34/34 tests passed across `launch-readiness-task3`, `launch-readiness-truth`,
  `gate-action`, and `onboarding`.
- `pnpm verify:release-tag` — matched `v0.6.2`, package `0.6.2`, MCP runtime `0.6.2`, release date `2026-08-01`.
- `pnpm verify:mcp-registry` — matched `io.github.shmindmaster/gitpin` package `gitpin` version `0.6.2`, stdio,
  manual OIDC publication.
- `pnpm verify:artifact-gate-demo` — verified deterministic fail/pass fixture and artifact SHA-256
  `c81709e1438a998473132ee212b09cb83812ffc7e6d5aa13f84fb5821dad8a69`.

The first `pnpm validate` attempt had one unrelated 5-second timeout in the onboarding test named “returns a cited first
result from any non-empty exposed document”; 87/88 tests passed. The exact timed-out test then passed alone in 2.18
seconds, and the complete `pnpm validate` rerun passed 88/88. No product change was made for that non-reproducing timing
failure.

Two later full-validation attempts after evidence-only edits encountered unrelated Windows fixture contention. The first
had three 5-second Git-heavy timeouts followed by five `EPERM` cleanup failures on one temporary wiki directory; the
second had two 5-second onboarding timeouts. The affected gate test passed alone in 2.74 seconds, and the two affected
onboarding tests passed together in 6.98 seconds. No product change was made for these non-reproducing timing failures;
the exact pull-request head still requires the remote CI gate.

## Version surface inventory

The current release version is 0.6.2 in:

- package and Action metadata: `package.json`, `action.yml`;
- MCP and runtime metadata: `server.json`, `src/server.ts`;
- onboarding/runtime guidance: `src/onboarding.ts`, `src/registry.ts`, `templates/client-rules.md`;
- matching source and browser regression tests;
- current repository truth: `AGENTS.md`, `README.md`, `ROADMAP.md`, and `CHANGELOG.md`;
- setup and operational documentation: `docs/ci.md`, `docs/clients.md`, `docs/migration-gitpin.md`,
  `docs/pr-evidence-gate.md`, `docs/troubleshooting.md`, and `docs/website.md`;
- canonical launch copy: `docs/launch.md`;
- homepage Action snippet: `site/index.html`;
- deterministic demo generator and all three generated outputs: artifact JSON, Markdown, and SVG.

The dated 0.6.1 and 0.6.0 changelog history and links remain unchanged. `ROADMAP.md` retains its historical
“completed before the 0.6.1 candidate” heading.

## Release workflow and post-publication self-gate

The repository self-gate intentionally remained pinned to the already-published `shmindmaster/gitpin@v0.6.1` during
the 0.6.2 candidate PR, because pointing that PR at a not-yet-existent Action tag would prevent the required check from
materializing. After `v0.6.2` was published from `d2122379f4be315973a0bfa92bbd628e2cf7cfeb`, this separate follow-up
advances the self-gate to the matching immutable `shmindmaster/gitpin@v0.6.2` Action. Exact-head CI and independent
review remain required before that follow-up can merge.

The staged release sequence is:

1. Push the focused candidate and open a PR; require exact-head `evidence` and all Validate jobs plus independent
   review.
2. Merge only after those gates pass and the evidence manifest covers the complete final diff.
3. Create immutable tag `v0.6.2` on the merged main commit. The `Publish package` workflow validates, builds, verifies
   the packed artifact, publishes or verifies the exact npm `gitHead`, and creates the GitHub Release.
4. Dispatch `Publish to MCP Registry` with `release_ref=v0.6.2` only after npm exposes the exact tag commit.
5. Dispatch `Deploy website`; independently verify the deployed SHA/content, opt-out behavior, capture payload, and
   PostHog project destination.
6. Independently inspect the PostHog project-level raw-IP discard setting. Until that is verified, public copy must
   not claim server-side raw-IP discard.
7. Advance `.github/workflows/evidence-gate.yml` to `shmindmaster/gitpin@v0.6.2` in a separate post-publication PR,
   then validate its exact head against the released Action.

This patch performs no external publication or configuration action and is not pushed, opened, or merged.
