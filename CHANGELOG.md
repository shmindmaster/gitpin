# Changelog

All notable changes to GitPin (formerly RepoContext) are documented here. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.3] - 2026-08-13

### Changed

- Align package, MCP, Action, documentation, website, and generated demo release surfaces on the verified 0.6.3 release.

### Fixed

- Emit a legible error annotation when the gate report fails, so required-check failures are actionable.

## [0.6.2] - 2026-08-01

### Changed

- Align package, MCP, Action, documentation, website, and generated demo release surfaces for the 0.6.2 artifacts published from `d2122379f4be315973a0bfa92bbd628e2cf7cfeb`.
- Send `$geoip_disable: true` on every permitted website analytics event, disable feature-flag and remote-configuration requests, and preserve the strict event and property allowlist.

### Fixed

- Add a keyboard-operable website analytics opt-out to the homepage and privacy page that persists until site data is cleared; a stored opt-out prevents SDK loading, runtime activation stops subsequent capture, and unavailable browser storage fails closed.
- Clarify that browser GeoIP suppression is active for every permitted event; the dedicated production GitPin PostHog project's raw-IP discard setting was verified separately, and other deployments must verify their own injected project.

## [0.6.1] - 2026-08-01

### Added

- Add the deterministic synthetic PR-gate fail-to-pass release artifact and native interactive website hero for the already-merged release candidate.

### Changed

- Classify explicitly marked human QA analytics as `synthetic_qa`, keep unmarked browser traffic classified as production, and continue suppressing automated test traffic.
- Align package, MCP, Action, documentation, website, and generated demo release surfaces on the 0.6.1 candidate.

### Fixed

- Harden deterministic artifact verification against malformed shapes and checksum tampering.
- Constrain launch analytics to the allowlisted event and transport fields before delivery.

## [0.6.0] - 2026-07-31

### Added

- Add a read-only `gitpin gate` command that loads policy from the trusted base commit, binds a submitted manifest to the exact head commit, compares the merge-base diff, and verifies full-SHA line-slice evidence hashes.
- Add the GitPin Evidence Gate GitHub Action, deterministic JSON reports, base evidence for deletions, bootstrap templates, and documented CrewScore named-control composition.

### Changed

- Reposition GitPin around agent-delivery assurance and required PR evidence rather than repository-context retrieval.

## [0.5.3] - 2026-07-31

### Fixed

- Accept npm 12's package-keyed `npm pack --json` output while retaining compatibility with earlier npm array output.
- Run the CI package gate with the same pinned npm 12 toolchain used by releases.

## [0.5.2] - 2026-07-31

### Changed

- Upgrade releases to npm CLI 12 and enforce trusted-publishing requirements in repository validation: GitHub-hosted release execution, OIDC permissions, supported Node/npm versions, npm registry configuration, matching repository identity, and no long-lived npm token fallback.

## [0.5.1] - 2026-07-31

### Changed

- Publish GitPin under the available unscoped npm package `gitpin`.
- Document `@shmindmaster/repocontext` as the published predecessor and remove the unpublished `@shmindmaster/gitpin` intermediate identity from install instructions.

## [0.5.0] - 2026-07-31

### Added

- Durable citation handles: `citation.handle` (`gitpin:repo@sha:path:line`) and `citation.repoAtSha`.
- `pin.prove_set` / `pin.verify_set` multi-cite packs (max 8) with stable `evidenceSetId`.
- `pin.verify` `mustContain` claim-text check (`claimVerdict`: supported | contradicted | unproven).
- CLI: `verify --from-pack`, `verify --handle`, `verify --must-contain`, `verify-cites --file`, `prove-set --from-json`.
- Cite mini-spec (`docs/cite-spec.md`), JSON Schemas (`docs/schemas/`), skill + client-rule templates, CI gate script `scripts/verify-citations.mjs`.
- Research: next-feature differentiation pass (`docs/research/deep-research-gitpin-features-2026-07-30.md`).

### Changed

- MCP surface is **12** read-only `pin.*` tools (was 10).
- Tool descriptions encode when/before workflow cues for agent tool selection.

## [0.4.0] - 2026-07-30

### Changed

- **Full product pivot (not rename-only)** to GitPin: trust/evidence job, prove→verify functionality, and category exit from “repo context.”
- Package/MCP identity: `gitpin`, `io.github.shmindmaster/gitpin`, CLI `gitpin` (legacy `repocontext` bin alias retained).
- Tool surface reorganized around the product loop: discover → candidates → prove → verify → decide.
- Search tools return `evidence-candidates` envelopes with `citation` and `next: pin.prove` (hits are not claims).
- Read/get_doc return evidence-oriented slices with contract metadata.
- Context Brief renamed to **EvidenceBrief** (`type`, `product`, `contract`, schemaVersion 2).
- Prefer `GITPIN_*` and `~/.gitpin` (legacy `REPOCONTEXT_*` / `~/.repocontext` remain aliases).

### Added

- Shared `evidence` module: citations, evidence packs, verification reports, product contract constants.
- `pin.prove` evidence packs with optional `claim`, `contentSha256`, `citation.cite`, and `next: pin.verify`.
- `pin.verify` MCP tool (same contract as CLI `gitpin verify`) — independent `git show` re-check and HEAD match status.
- Prompt `prove-with-git-head` encodes the full product loop (not just “cite SHA”).
- Competitive landscape correction documenting crowded `repo-context*` peers.

### Security

- Block symlink escapes that resolve outside a registered repository root before filesystem reads.

## [0.3.1] - 2026-07-30

### Added

- Add version-matched metadata and validation for publishing RepoContext to the official MCP Registry.
- Add a manual, GitHub OIDC-authenticated Registry publication workflow that verifies the npm artifact before publishing immutable metadata.
- Add public docs for the eight MCP tools, competitive comparison, troubleshooting, and launch checklist.

### Changed

- Clarify public beta positioning, five-minute quick start, and agent prompt examples in the README and product site.
- Require hexadecimal Git revisions for `pin.compare`, matching Context Brief change-range validation.
- Align security support language with the published npm package.

## [0.3.0] - 2026-07-29

### Added

- Add `repocontext init --client <name>` for safe npm-first onboarding from install to a commit-pinned first fact.

### Changed

- Make the public website's primary activation path the published npm package.

## [0.2.4] - 2026-07-29

### Fixed

- Keep managed HTTP health probes available when the MCP host allowlist is enabled, while continuing to reject MCP calls sent to unrecognized hosts.

## [0.2.3] - 2026-07-29

### Fixed

- Corrected the published `npx` MCP configuration and issue-support guidance in the packaged README.
- Verify those public README assertions during every packed install-to-first-answer check.

### Changed

- Publish GitHub Releases from the trusted version-tag workflow, with duplicate-safe behavior for retried releases.
- Point package and repository metadata at the public site and complete the static site's privacy and crawler-discovery surface.

## [0.2.2] - 2026-07-28

### Security

- Require explicit, valid request lengths for the HTTP MCP endpoint and reject chunked or oversized bodies before MCP transport handling.

### Fixed

- Verify that the advertised MCP server version matches the package version during every release gate.

## [0.2.1] - 2026-07-28

### Fixed

- Corrected public release, installation, client-configuration, website, and roadmap guidance after the npm launch.
- Made release verification dispatchable against an existing immutable version tag and fixed its shell quoting.

## [0.2.0] - 2026-07-28

### Added

- Bearer-authenticated, snapshot-backed Streamable HTTP transport and health endpoint.
- `doctor` command for registry, freshness, and documentation-readiness checks.
- Repository exposure policy, snapshot, HTTP contract, packaging, and source-structure tests.
- Clean packed install-to-first-answer verification.
- Biome linting and formatting gates.
- Public configuration, deployment, security, contribution, and roadmap documentation.
- Standard MCP catalog resource and documentation-audit prompt.
- Deterministic Context Briefs with audience-specific presentation, invariant evidence IDs, source traces, explicit gaps, and bounded commit-range evidence.
- A stdout-only `brief` CLI for CI artifact handoff.
- Tested Cursor, Windsurf, Zed, and Continue configuration examples.
- Tag-triggered npm trusted-publishing workflow and Node 20/22/24 CI matrix.
- Static product site, manual GitHub Pages deployment, isolated cookieless website analytics adapter, and cross-browser Playwright regression suite.
- A packaged, secret-free environment template with automated completeness validation.

### Changed

- Refactored Git and wiki operations into bounded domain modules while retaining the existing public MCP contract.
- Updated the MCP SDK to use patched HTTP transport dependencies.
- Repositioned installation and documentation for a public 0.2 release candidate.
- Resolved abbreviated comparison revisions to full commit SHAs before returning evidence.
- Strengthened packed-package verification with a clean npm dependency install, `doctor`, Context Brief, and first MCP answer.
- Pruned development dependencies from the remote image and run the HTTP process as the unprivileged `node` user.
- Updated the test runner and GitHub Actions to their current Node 24-based releases.
- Updated the TypeScript compiler to 7 and explicitly scoped ambient types to Node.js.

### Security

- Remote snapshots exclude source code, dirty work, untracked files, sensitive paths, and local absolute source roots.
- Snapshot generation replaces only marked RepoContext output directories and rejects registered repository roots or their ancestors.
- Malformed exposure policies fail closed.

[Unreleased]: https://github.com/shmindmaster/gitpin/compare/v0.6.3...HEAD
[0.6.3]: https://github.com/shmindmaster/gitpin/releases/tag/v0.6.3
[0.6.2]: https://github.com/shmindmaster/gitpin/releases/tag/v0.6.2
[0.6.1]: https://github.com/shmindmaster/gitpin/releases/tag/v0.6.1
[0.6.0]: https://github.com/shmindmaster/gitpin/releases/tag/v0.6.0
[0.5.3]: https://github.com/shmindmaster/gitpin/releases/tag/v0.5.3
[0.5.2]: https://github.com/shmindmaster/gitpin/releases/tag/v0.5.2
[0.5.1]: https://github.com/shmindmaster/gitpin/releases/tag/v0.5.1
[0.5.0]: https://github.com/shmindmaster/gitpin/releases/tag/v0.5.0
[0.4.0]: https://github.com/shmindmaster/gitpin/releases/tag/v0.4.0
[0.3.1]: https://github.com/shmindmaster/gitpin/releases/tag/v0.3.1
[0.3.0]: https://github.com/shmindmaster/gitpin/releases/tag/v0.3.0
[0.2.4]: https://github.com/shmindmaster/gitpin/releases/tag/v0.2.4
[0.2.3]: https://github.com/shmindmaster/gitpin/releases/tag/v0.2.3
[0.2.2]: https://github.com/shmindmaster/gitpin/releases/tag/v0.2.2
[0.2.1]: https://github.com/shmindmaster/gitpin/releases/tag/v0.2.1
[0.2.0]: https://github.com/shmindmaster/gitpin/releases/tag/v0.2.0
