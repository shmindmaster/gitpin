# Roadmap

RepoContext's roadmap is evidence-led. Planned work may change when validation shows a different user need. Feature requests should describe the workflow and provenance requirement, not only a proposed interface.

## Completed in the 0.2 release candidate

- Eight bounded, read-only MCP tools for cross-repository documentation and source evidence.
- Git `HEAD` pinning with path, line, and commit provenance.
- Exposure policies that fail closed and sensitive-path blocking.
- Local stdio and bearer-authenticated, snapshot-backed HTTP transports.
- A `doctor` onboarding check, deterministic test suite, and clean packed install-to-first-answer verification.

## Current priorities

- Complete maintainer review, CI verification, changelog review, and npm trusted-publishing setup.
- Verify installation from a clean machine after the first public package release.
- Validate the existing workflow with technical and cross-functional users before expanding the tool contract.

## Planned improvements

- Improve fixtures for workspace repositories, stale documentation, malformed policies, and remote snapshots.
- Document client-specific setup only where it can be tested and maintained.
- Add release provenance and automated package integrity checks after the publishing model is approved.

## Longer-term ideas

- Research a shareable, source-cited Context Brief after workflow validation demonstrates a real need.
- Explore more useful documentation-health signals without introducing opaque scoring or generated claims.
- Evaluate additional Git-hosting and deployment examples based on contributor demand.

## Out of scope

- Repository writes, code generation, task execution, or deployment actions.
- Databases, embedding indexes, background workers, and hidden network retrieval.
- Exposing dirty, untracked, sensitive, or policy-denied repository content.
- Replacing code review, tests, source control, or repository-owned documentation.
