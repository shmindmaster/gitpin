# Roadmap

GitPin's roadmap is evidence-led. Planned work may change when validation shows a different user need. Feature requests should describe the workflow and provenance requirement, not only a proposed interface.

## Current product

- Twelve bounded, read-only `pin.*` MCP tools for discovery, evidence, verification, and decision support.
- Git `HEAD` pinning with path, line, content hash, and full commit provenance.
- Exposure policies that fail closed and sensitive-path blocking.
- Local stdio and bearer-authenticated, documentation-only HTTP transports.
- `init`, `doctor`, EvidenceBrief, deterministic tests, and clean packed install verification.
- Tested MCP configuration templates for major coding-agent clients.
- Node 20/22/24 CI and tag-triggered npm trusted-publishing automation.
- Static public website, cookieless analytics, and cross-browser regression tests.

## P0 release work

- Publish a version-matched `gitpin` artifact after the repository rename.
- Publish matching `io.github.shmindmaster/gitpin` metadata to the official MCP Registry.
- Align package, server metadata, launch copy, site copy, demos, and docs to the 12-tool contract.
- Verify a clean-machine install-to-first-evidence path.

## P1 validation and adoption

- Validate EvidenceBrief usefulness with technical and cross-functional users using synthetic fixtures.
- Improve fixtures for workspace repositories, stale documentation, malformed policies, and remote snapshots.
- Verify the documentation-only remote container in an approved hosting environment.

## Longer-term ideas

- Explore documentation-health signals without opaque scoring or generated claims.
- Evaluate monorepo package-boundary discovery without indexing non-Git umbrella folders.
- Evaluate additional Git-hosting and deployment examples based on contributor demand.

## Out of scope

- Repository writes, code generation, task execution, or deployment actions.
- Databases, embedding indexes, background workers, and hidden network retrieval.
- Exposing dirty, untracked, sensitive, or policy-denied repository content.
- Replacing code review, tests, source control, or repository-owned documentation.
