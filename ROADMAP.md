# Roadmap

RepoContext's roadmap is evidence-led. Planned work may change when validation shows a different user need. Feature requests should describe the workflow and provenance requirement, not only a proposed interface.

## Completed in the 0.2 release

- Eight bounded, read-only MCP tools for cross-repository documentation and source evidence.
- Git `HEAD` pinning with path, line, and commit provenance.
- Exposure policies that fail closed and sensitive-path blocking.
- Local stdio and bearer-authenticated, snapshot-backed HTTP transports.
- A `doctor` onboarding check, deterministic test suite, and clean packed install-to-first-answer verification.
- Deterministic, source-cited Context Briefs for technical and cross-functional audiences.
- Tested MCP configuration templates for Cursor, Windsurf, Zed, and Continue.
- Node 20/22/24 CI and tag-triggered npm trusted-publishing automation.
- Static public website, cookieless analytics, and cross-browser regression tests.

## Current priorities

- Validate the existing workflow with technical and cross-functional users before expanding the tool contract.

## Planned improvements

- Improve fixtures for workspace repositories, stale documentation, malformed policies, and remote snapshots.
- Validate Context Brief usefulness with technical and cross-functional users using synthetic fixtures.
- Verify the documentation-only remote container in an approved hosting environment.

## Longer-term ideas

- Explore more useful documentation-health signals without introducing opaque scoring or generated claims.
- Evaluate monorepo package-boundary discovery without indexing non-Git umbrella folders.
- Evaluate additional Git-hosting and deployment examples based on contributor demand.

## Out of scope

- Repository writes, code generation, task execution, or deployment actions.
- Databases, embedding indexes, background workers, and hidden network retrieval.
- Exposing dirty, untracked, sensitive, or policy-denied repository content.
- Replacing code review, tests, source control, or repository-owned documentation.
