# Changelog

All notable changes to RepoContext are documented here. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and intends to use [Semantic Versioning](https://semver.org/spec/v2.0.0.html) after the first public release.

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

### Security

- Remote snapshots exclude source code, dirty work, untracked files, sensitive paths, and local absolute source roots.
- Snapshot generation replaces only marked RepoContext output directories and rejects registered repository roots or their ancestors.
- Malformed exposure policies fail closed.

[0.2.0]: https://github.com/shmindmaster/repocontext/releases/tag/v0.2.0
