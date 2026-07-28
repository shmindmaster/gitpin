# Changelog

All notable changes to RepoContext are documented here. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and intends to use [Semantic Versioning](https://semver.org/spec/v2.0.0.html) after the first public release.

## [Unreleased]

### Added

- Bearer-authenticated, snapshot-backed Streamable HTTP transport and health endpoint.
- `doctor` command for registry, freshness, and documentation-readiness checks.
- Repository exposure policy, snapshot, HTTP contract, packaging, and source-structure tests.
- Clean packed install-to-first-answer verification.
- Biome linting and formatting gates.
- Public configuration, deployment, security, contribution, and roadmap documentation.

### Changed

- Refactored Git and wiki operations into bounded domain modules while retaining the existing public MCP contract.
- Updated the MCP SDK to use patched HTTP transport dependencies.
- Repositioned installation and documentation for a public 0.2 release candidate.

### Security

- Remote snapshots exclude source code, dirty work, untracked files, sensitive paths, and local absolute source roots.
- Malformed exposure policies fail closed.

[Unreleased]: https://github.com/shmindmaster/repocontext/compare/v0.1.1...HEAD
