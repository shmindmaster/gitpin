# Contributor backlog

Everything below requires an external dependency, release decision, or additional evidence. These are issue-ready drafts, not claims that the work is complete.

## Publish 0.2 and verify public installation

**Suggested labels:** `release`, `infra`, `help wanted`

**Problem:** Source and tarball checks pass, but `@shmindmaster/repocontext` is not yet published on npm. The tag workflow cannot authenticate until the package exists and npm trusts `.github/workflows/release.yml`.

**Why it matters:** The public `npx -y @shmindmaster/repocontext@0.2.0` onboarding path and provenance badge cannot be verified locally.
**Relevant files:** `package.json`, `.github/workflows/release.yml`, `scripts/verify-package.mjs`, `README.md`.

**Expected outcome:** A reviewed `v0.2.0` tag publishes through npm OIDC, and clean Node 20, 22, and 24 environments reach `doctor`, a Context Brief, and a first MCP answer without cloning the repository.

**Acceptance criteria:**

- Register `shmindmaster/repocontext` and `release.yml` as the npm trusted publisher with `npm publish` permission.
- Push the reviewed `v0.2.0` tag only after exact-head CI is green.
- Confirm npm provenance and package metadata.
- Run `npx -y @shmindmaster/repocontext@0.2.0 doctor` from clean Node 20, 22, and 24 environments.
- Update README release status only after those checks pass.

**Proof:** `npm view @shmindmaster/repocontext@0.2.0 --json`, `npx -y @shmindmaster/repocontext@0.2.0 doctor`, and the published workflow run URL.

## Deploy the public website with isolated analytics

**Suggested labels:** `release`, `website`, `analytics`, `help wanted`

**Problem:** The static website, browser matrix, and manual Pages workflow are merged, and a dedicated RepoContext PostHog project exists. GitHub Pages is not configured, the PostHog project still has IP anonymization and server-side cookieless hashing disabled, and no repository variable connects the site to analytics.

**Why it matters:** GitHub's short repository-traffic window cannot measure landing-page comprehension or install conversion, while mixing RepoContext into another application's PostHog project would contaminate events and privacy settings.
**Relevant files:** `site/`, `tests/browser/site.spec.mjs`, `.github/workflows/pages.yml`, `docs/website.md`.

**Expected outcome:** A public HTTPS site serves the reviewed artifact and sends only anonymous website events to an isolated RepoContext PostHog project.

**Acceptance criteria:**

- Configure GitHub Pages to deploy through GitHub Actions and run the manual `Deploy website` workflow.
- Enable cookieless server hashing and IP anonymization in the dedicated `RepoContext` PostHog project.
- Keep autocapture and session replay disabled, then set `POSTHOG_REPOCONTEXT_PROJECT_KEY` as a repository variable.
- Verify `$pageview`, `cta_clicked`, and `audience_changed` contain no repository, filesystem, question, citation, MCP, token, or client-config data.
- Confirm the production URL in Chromium and rerun the committed browser matrix.

**Proof:** `pnpm site:test`, the Pages deployment URL, and a PostHog event query grouped by event name with no disallowed properties.

## Validate the Context Brief with representative users

**Suggested labels:** `research`, `help wanted`, `type:validation`

**Problem:** Deterministic brief behavior is tested, but usefulness and comprehension are not user-validated.

**Why it matters:** Automated correctness does not prove that technical or cross-functional users make faster, safer decisions from the artifact.
**Relevant files:** `src/context-brief.ts`, `src/cli.ts`, `docs/ci.md`, `README.md`.

**Expected outcome:** Synthetic-fixture sessions establish whether users understand known facts, gaps, freshness, and the next safe action without maintainer coaching.

**Acceptance criteria:**

- Observe at least one technical and one cross-functional workflow using approved synthetic repositories.
- Record task completion, correct source attribution, and unsafe-assumption rates.
- Separate install friction from retrieval, comprehension, and trust findings.
- Add only anonymized, consented findings and actionable product changes.

**Proof:** Re-run `pnpm validate` and the documented fixture tasks against recorded commit SHAs.

## Verify the documentation-only remote reference deployment

**Suggested labels:** `infra`, `security`, `help wanted`

**Problem:** Container and HTTP contracts are locally testable, but no approved hosted endpoint exists.

**Why it matters:** Runtime host controls, bearer-secret injection, TLS, host allowlisting, and immutable image provenance require external infrastructure.
**Relevant files:** `Dockerfile.remote`, `deploy/digitalocean-app.yaml.example`, `docs/remote-deployment.md`, `scripts/verify-remote.mjs`.

**Expected outcome:** An approved host serves only the generated snapshot through authenticated Streamable HTTP.

**Acceptance criteria:**

- Deploy an immutable reviewed image through the authorized provider path.
- Confirm `/healthz`, unauthenticated `401`, the eight read-only tools, and one catalog call.
- Inspect the image to confirm source, dirty work, local roots, and secrets are absent.
- Record teardown, rotation, and ownership instructions outside the public repository when sensitive.

**Proof:** `REPOCONTEXT_MCP_URL=... REPOCONTEXT_MCP_TOKEN=... pnpm verify:remote`.

## Evaluate monorepo package-boundary discovery

**Suggested labels:** `research`, `enhancement`

**Problem:** `repo.inspect(operation: "manifest")` detects polyglot manifests but does not model pnpm, Turborepo, or Nx package ownership.

**Why it matters:** Agents need package boundaries in large repositories without turning non-Git umbrella folders into registry entries.
**Relevant files:** `src/git-inspection.ts`, `src/git-shared.ts`, `src/git.test.ts`.

**Expected outcome:** Decide whether a bounded package tree can be derived from committed manifests without adding storage or broad filesystem scanning.

**Acceptance criteria:**

- Use synthetic pnpm, Turborepo, and Nx fixtures.
- Specify package-root, workspace-pattern, and commit-provenance behavior.
- Preserve the existing manifest response fields and Git-root registry rule.
- Implement only if the output remains bounded and deterministic.

**Proof:** `pnpm test -- src/git.test.ts` with all three fixture families.
