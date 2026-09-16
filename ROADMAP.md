# Roadmap

GitPin's roadmap is evidence-led. Planned work may change when validation shows a different user need. Feature requests should describe the workflow and provenance requirement, not only a proposed interface.

## Current product

- Read-only `gitpin gate` for base-trusted PR policy, changed-path coverage, and exact-commit evidence locators.
- GitHub Action that emits a deterministic report suitable for a required merge check.
- Twelve bounded, read-only `pin.*` MCP tools for discovery, evidence, verification, and decision support.
- Git `HEAD` pinning with path, line, content hash, and full commit provenance.
- 0.6.4 is the release candidate. The previous verified public release remains current until npm, MCP Registry, GitHub Release, and Pages receipts for 0.6.4 are independently verified. The candidate includes the Action/install snippets, deterministic demos, launch materials, and the legible gate-report failure annotation; historical releases remain immutable.
- Exposure policies that fail closed and sensitive-path blocking.
- Local stdio and bearer-authenticated, documentation-only HTTP transports.
- `init`, `doctor`, EvidenceBrief, deterministic tests, and clean packed install verification.
- Tested MCP configuration templates for major coding-agent clients.
- Node 20/22/24 CI and tag-triggered npm trusted-publishing automation.
- Static public website, cookieless analytics, and cross-browser regression tests.

## P0 release work (completed before the 0.6.1 candidate)

- [x] Publish a version-matched `gitpin` artifact after the repository rename.
- [x] Publish matching `io.github.shmindmaster/gitpin` metadata to the official MCP Registry.
- [x] Align package, server metadata, launch copy, site copy, demos, and docs to the 12-tool contract.
- [x] Verify a clean-machine install-to-first-evidence path.

## P1 validation and adoption

- Run the PR gate on real agent-authored changes and measure required-check retention, false blocking, and review decisions changed.
- Validate CrewScore named controls as a separate written-policy check without using its aggregate coverage score.
- Validate EvidenceBrief usefulness with technical and cross-functional users using synthetic fixtures.
- Improve fixtures for workspace repositories, stale documentation, malformed policies, and remote snapshots.
- Verify the documentation-only remote container in an approved hosting environment.

## Bounded security and public-interest work

The items below are current gaps suitable for grant-supported maintenance. They are not shipped features and no funding has been awarded.

1. **Threat model and abuse-case regression suite.** Publish the trust boundaries for base-commit policy, head-commit evidence, Git path resolution, line-slice hashing, local registry exposure, and the optional HTTP transport. Convert the highest-risk cases into deterministic allow/deny tests.
2. **Release provenance.** Make provenance explicit and independently verifiable across the npm package, source tag, GitHub release, and MCP Registry entry. Add attestations where the distribution surface supports them and fail release verification when the artifacts disagree.
3. **SARIF output for the PR evidence gate.** Translate existing deterministic gate violations into a versioned, prompt-free SARIF surface with schema checks and end-to-end Action tests. JSON remains the source report; SARIF is an interoperability adapter, not a second decision engine.
4. **OpenSSF Scorecard and findings-driven hardening.** Publish a Scorecard workflow, review each result against GitPin's actual threat model, and remediate supported findings without optimizing for a cosmetic score.
5. **Independent workflow validation.** Run the gate on consented agent-authored changes, publish the measurement protocol, and report false blocking, policy bypass attempts, and review decisions changed. Low or negative adoption results remain publishable outcomes.

The work preserves GitPin's MIT license, read-only architecture, local-Git verification path, and explicit exclusion of dirty worktrees. It does not add a database, hosted evidence dependency, repository write tools, or a claim that a matching locator proves semantic correctness.

## Longer-term ideas

- Explore documentation-health signals without opaque scoring or generated claims.
- Evaluate monorepo package-boundary discovery without indexing non-Git umbrella folders.
- Evaluate additional Git-hosting and deployment examples based on contributor demand.

## Out of scope

- Repository writes, code generation, task execution, or deployment actions.
- Databases, embedding indexes, background workers, and hidden network retrieval.
- Exposing dirty, untracked, sensitive, or policy-denied repository content.
- Replacing code review, tests, source control, or repository-owned documentation.
