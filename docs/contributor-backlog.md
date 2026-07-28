# Contributor backlog

These issue-ready drafts cover work intentionally deferred from the 0.2 release candidate. Maintainers may copy them into GitHub issues after confirming priority and ownership.

## Publish 0.2 and verify a clean external installation

**Labels:** `release`, `documentation`  
**Scope:** Medium; maintainer-only publication access  
**Context:** Source and packed-fixture checks pass, but the package is not available from npm. Public instructions must remain source-first until publication succeeds.

**Desired outcome:** Publish a reviewed 0.2 package through an approved trusted-publishing path and prove that a new user can reach a first commit-pinned MCP answer.

**Relevant components:** `package.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `README.md`, `scripts/verify-package.mjs`, `CHANGELOG.md`.

**Suggested approach:** Review the complete release diff, confirm npm package ownership and provenance settings, run all release checks, publish without weakening package allowlists, then repeat the verifier from a clean environment without relying on the repository's pnpm store.

**Acceptance criteria:**

- CI passes on the release commit.
- `npm view repocontext` returns the intended version and metadata.
- A clean Node 20 or 22 environment installs the package and runs `repocontext doctor`.
- A fixture registry returns a source-cited first answer through stdio.
- README status and install instructions match the released artifact.

**Testing:** `pnpm install --frozen-lockfile`, `pnpm validate`, `pnpm build`, `pnpm verify:package`, `npm pack --dry-run --json`, and a networked clean-install smoke test.  
**Dependencies/blockers:** npm ownership, trusted-publishing approval, release commit/tag, and maintainer authorization. Do not label `good first issue`.

## Validate the eight-tool workflow with representative users

**Labels:** `research`, `help wanted`, `documentation`  
**Scope:** Medium; requires research capacity and participant consent  
**Context:** The evidence-first workflow is technically validated but has no external activation or repeated-use evidence.

**Desired outcome:** Determine whether technical and cross-functional users can install RepoContext, identify the right source, understand unknowns, and trust the provenance without maintainer coaching.

**Relevant components:** `_product-experience/`, `README.md`, `src/doctor.ts`, and all eight MCP tool descriptions in `src/server.ts`.

**Suggested approach:** Use synthetic repositories only, run the protocol in `_product-experience/06-outcome-measurement-plan.md`, record completion and attribution outcomes, and publish only anonymized findings approved by participants.

**Acceptance criteria:**

- At least one technical and one cross-functional workflow is observed.
- Findings separate install friction, retrieval quality, comprehension, and trust.
- No customer, private repository, credential, or participant-identifying data enters the repository.
- Recommendations identify whether to improve onboarding, existing tools, or documentation before proposing a new feature.

**Testing:** Re-run all tested workflows against the same commit-pinned fixtures and record fixture SHAs.  
**Dependencies/blockers:** Maintainer approval for recruitment and publication; participant consent. Not a `good first issue`.

## Research a shareable Context Brief after workflow validation

**Labels:** `research`, `enhancement`, `help wanted`  
**Scope:** Large; product and security design  
**Context:** A compact evidence brief may create a collaboration loop, but implementing it before user validation would be speculative and could duplicate existing tools or leak context.

**Desired outcome:** Decide whether a source-cited brief is needed, what minimum information it contains, and whether generation belongs in RepoContext or the MCP client.

**Relevant components:** `_product-experience/02-workflow-and-feature-design.md`, `src/server.ts`, exposure-policy code, and remote snapshot boundaries.

**Suggested approach:** Use the preceding workflow study, prototype outside the public MCP contract, threat-model sharing and redaction, and compare a client-composed brief against a server tool.

**Acceptance criteria:**

- Research demonstrates a repeated workflow that current tool composition cannot solve adequately.
- The proposal defines provenance, size bounds, unknown states, redaction, and policy behavior.
- A decision record recommends implement, defer, or reject with supporting evidence.
- No implementation changes the eight-tool contract before maintainer approval.

**Testing:** Synthetic fixture evaluation for correct citations, stale state, denied paths, missing evidence, and output bounds.  
**Dependencies/blockers:** Completion of representative-user workflow validation. Not a `good first issue`.

## Add tested MCP-client configuration guides

**Labels:** `documentation`, `good first issue`  
**Scope:** Small; one client per pull request  
**Context:** The README contains a generic MCP configuration. Client-specific command, environment, and Windows launcher behavior changes independently and should not be guessed.

**Desired outcome:** Add one concise, tested setup guide for a commonly used MCP client without expanding the server contract.

**Relevant components:** `README.md`, a new page under `docs/`, and the selected client's current public documentation.

**Suggested approach:** Verify source and published-package command forms on a clean fixture, document only supported settings, include `doctor`, and link from the README.

**Acceptance criteria:**

- Instructions are verified on a current released client version and identify that version.
- Linux/macOS and Windows command differences are documented when applicable.
- The guide reaches `doctor` and a first `wiki.catalog` call using synthetic repositories.
- No secrets, personal paths, or private repository names appear in examples.

**Testing:** Follow the guide from a clean environment and record the commands and versions in the pull request.  
**Dependencies/blockers:** Public npm release if the guide uses `npx`; otherwise use the documented source build.
