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
- fail closed without loading analytics when preference storage cannot be read;
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

Hosted review subsequently raised four findings. The one-way opt-out control incorrectly exposed toggle-style
`aria-pressed` state even though activation permanently disables the control; the attribute was removed and the
keyboard, disabled-state, persistence, and status coverage now explicitly assert the resulting button semantics. The
other three findings proposed replacing `advanced_disable_flags` with `advanced_disable_decide`. They were rejected
against the current official PostHog type contract at commit
`57f371e540968afaa8a0fe9aec8a53ef1db6b654`: `advanced_disable_flags` is the current option, while
`advanced_disable_decide` is explicitly deprecated in favor of it. The production option, request harness, and earlier
report statement therefore remain unchanged.

## Full validation evidence

- `pnpm validate` — passed on rerun: 15 Vitest files, 88 tests, lint, format check, typecheck, client/CI/env/MCP/tag
  verifiers, site build, and deterministic demo verification.
- `pnpm build` — passed.
- `pnpm verify:package` — passed for `gitpin-0.6.2.tgz`; clean install, initialization, doctor, context brief,
  first answer, PR evidence gate, and public docs were verified.
- `pnpm site:test` — passed 112/112 across Chromium, Firefox, WebKit, and mobile Chromium.
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

## Release workflow expectations

The repository self-gate intentionally remains pinned to the already-published `shmindmaster/gitpin@v0.6.1` during
the 0.6.2 candidate PR. Its explicit bootstrap comment and regression test require a separate post-publication PR to
advance the self-gate to `v0.6.2`. Pointing the candidate PR at a not-yet-existent immutable Action tag would prevent
the required check from materializing.

When separately authorized, the release sequence is:

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
7. Open the post-publication self-gate PR advancing `.github/workflows/evidence-gate.yml` to
   `shmindmaster/gitpin@v0.6.2`, then validate it against the released Action.

None of these external publication or configuration actions is performed by this patch.
