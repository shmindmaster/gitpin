# Changelog

All notable changes to RepoContext are documented here. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and intends to use [Semantic Versioning](https://semver.org/spec/v2.0.0.html) after the first public release.

## [Unreleased]

### Added

- Add market deep-research notes, FAQ, and launch copy grounded in multi-agent competitive research.
- Harden repository path containment with realpath checks and refuse directory symlink traversal while indexing snapshots.
- Expand product-site Playwright coverage for navigation, keyboard audience tabs, skip link, network failures, and CI failure artifacts.

### Security

- Block symlink escapes that resolve outside a registered repository root before filesystem reads.

## [0.3.1] - 2026-07-30

### Added

- Add version-matched metadata and validation for publishing RepoContext to the official MCP Registry.
- Add a manual, GitHub OIDC-authenticated Registry publication workflow that verifies the npm artifact before publishing immutable metadata.
- Add public docs for the eight MCP tools, competitive comparison, troubleshooting, and launch checklist.

### Changed

- Clarify public beta positioning, five-minute quick start, and agent prompt examples in the README and product site.
- Require hexadecimal Git revisions for `repo.compare`, matching Context Brief change-range validation.
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

[Unreleased]: https://github.com/shmindmaster/repocontext/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/shmindmaster/repocontext/releases/tag/v0.3.1
[0.3.0]: https://github.com/shmindmaster/repocontext/releases/tag/v0.3.0
[0.2.4]: https://github.com/shmindmaster/repocontext/releases/tag/v0.2.4
[0.2.3]: https://github.com/shmindmaster/repocontext/releases/tag/v0.2.3
[0.2.2]: https://github.com/shmindmaster/repocontext/releases/tag/v0.2.2
[0.2.1]: https://github.com/shmindmaster/repocontext/releases/tag/v0.2.1
[0.2.0]: https://github.com/shmindmaster/repocontext/releases/tag/v0.2.0
