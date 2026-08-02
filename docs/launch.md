# GitPin Tuesday announcement package

Internal checklist and copy for the GitPin announcement. Lead with the base-trusted required PR evidence gate. The local MCP is supporting infrastructure for gathering commit-pinned evidence, not the primary product wedge. Do not invent metrics, user quotes, registry status, or package availability.

## Release gate

GitPin is announcement-ready only when the required PR gate can be installed from the released Action, run against a real merge-base diff, and independently re-check exact evidence at the pull-request head. The same version must also be verified in the source tag, npm package, GitHub Release, Pages site, and official MCP Registry. A green source CI run alone is not a public release.

Required before announcement:

1. Verify the released Action reads `.gitpin/gate.yml` from the trusted base commit and the submitted manifest from the pull-request head.
2. Verify a real pull request fails for uncovered material paths or mismatched line hashes and passes only with full-SHA, re-checkable evidence.
3. Make the `evidence` job a required branch check and keep its permissions read-only.
4. Verify the same version in the source tag, npm package, GitHub Release, Pages site, and MCP Registry metadata.
5. Verify clean-machine local MCP setup and all `pin.*` read-only annotations as a supporting evidence-retrieval path.

## Primary demo: required PR evidence

```bash
gitpin gate --base <full-base-sha> --head <full-pr-head-sha>
```

Show one bounded pull request:

1. The trusted base policy defines which changed paths require evidence.
2. The pull-request head supplies named claims that cover those material paths.
3. Each locator is re-hashed at the exact base or head commit.
4. The required check reports uncovered paths, mismatched hashes, and full commit SHAs before merge.

The trust moment is that a pull request cannot weaken the policy used to judge itself, and a reviewer can independently re-check every accepted locator with `git show`.

## Supporting demo: local evidence retrieval

After publication, use `npx -y gitpin@0.6.2 init --client codex` when an agent needs local, index-free evidence across repositories. Search results are candidates; `pin.prove` and `pin.verify` produce path, line, line hash, and full-SHA evidence for the PR manifest. This MCP workflow supports the gate but is not required to use it.

## Positioning

GitPin is a base-trusted required check for agent-authored pull requests. It compares the merge-base diff with named claims, requires coverage for material changed paths, and re-checks exact line hashes at full commit SHAs. It verifies evidence integrity—not whether a claim is semantically true.

For engineering managers, the value is visible coverage of the files an agent changed. For release owners, it is a deterministic required check bound to the exact pull-request head. For governance and review owners, it is a narrow trust boundary: policy from base, evidence from head, read-only execution, and no arbitrary command execution.

The local MCP remains available for multi-repository evidence pinned to Git HEAD. It does not index, embed, write, commit, or push. Search finds candidates; prove and verify help assemble evidence the gate can independently re-check.

GitPin is maintained by Sarosh Hussain, who leads its technical direction. Pendoah is his company and operating context. Keep launch copy product-first and do not attribute unrelated products to Pendoah.

## Announcement draft

> Agent-authored pull requests can look complete while material files are uncovered or their evidence points at stale code.
>
> GitPin is a base-trusted required PR evidence gate. It compares the merge-base diff with named claims, checks that material changed paths are covered, and re-hashes exact line slices at the full pull-request-head SHA before merge.
>
> The pull request cannot weaken the policy used to judge itself. GitPin is read-only, executes no PR code, and reports evidence integrity—not semantic truth.
>
> Start with the GitHub Action. Use the optional local MCP when an agent needs index-free, multi-repository evidence to populate the manifest.
>
> https://github.com/shmindmaster/gitpin
>
> Maintained by Sarosh Hussain. Pendoah is his company and operating context.

## Canonical announcement candidate (v0.6.2)

These are the canonical targets for the release package. Do not announce until the release gate above verifies every destination:

- npm: https://www.npmjs.com/package/gitpin
- GitHub release target: https://github.com/shmindmaster/gitpin/releases/tag/v0.6.2
- GitHub Actions evidence gate workflow: https://github.com/shmindmaster/gitpin/actions/workflows/evidence-gate.yml
- MCP Registry entry search (live): https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.shmindmaster/gitpin&limit=20
- Project site: https://shmindmaster.github.io/gitpin/
- GitHub Action setup:
  - `uses: shmindmaster/gitpin@v0.6.2` in workflow YAML
  - CLI bootstrap after publication: `npx -y gitpin@0.6.2 init --client codex`

## Show HN draft

**GitPin 0.6.2: commit-level PR evidence with a browser analytics opt-out**

GitPin is a base-trusted PR gate that compares the merge-base diff and validates evidence claims against exact file, line, and full-SHA locations. It is designed so reviewers can independently re-check every accepted locator with `git show`.

For merge requests that include material file changes, GitPin enforces that required paths are covered by committed evidence. A missing locator blocks merge. This is not a quality-scoring product and it does not infer semantics from search hits.

Release setup for this version:

```bash
npx -y gitpin@0.6.2 init --client codex
gitpin gate --base <full-base-sha> --head <full-head-sha>
uses: shmindmaster/gitpin@v0.6.2
```

Relevant links:

- https://github.com/shmindmaster/gitpin
- https://www.npmjs.com/package/gitpin
- https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.shmindmaster/gitpin&limit=20

## LinkedIn draft

After the release gate is complete, this draft may state: GitPin 0.6.2 is the shipped PR evidence gate for agent-authored changes with a browser-stored website analytics opt-out that lasts until site data is cleared. It enforces material-path coverage and validates locators at exact commit SHAs using canonical handle or cite formats from the mini-spec, for example:

- canonical cite: `task-2-synthetic-pr-fixture/docs/protocol.md:5 @ 57bce1a312f6153e171b515c41727ff81e77fb3c`
- canonical handle: `gitpin:task-2-synthetic-pr-fixture@57bce1a312f6153e171b515c41727ff81e77fb3c:docs/protocol.md:5`

The focus is narrow: deterministic evidence integrity, not semantic certainty or platform-wide scoring. This is a review gate, not a replacement for testing, source control review, or human judgment.

Try the setup:
`gitpin gate --base <full-base-sha> --head <full-head-sha>`

## X draft

GitPin 0.6.2 blocks merges when material PR changes lack commit-pinned evidence. Add valid coverage, rerun, and the gate passes with exact SHA/path/line citations. It checks evidence integrity, not semantic truth. Action: `uses: shmindmaster/gitpin@v0.6.2`.

## Adaptable community post draft

After the release gate is complete, this draft may state: GitPin 0.6.2 enforces commit-pinned PR evidence for material diff paths and adds a browser-stored website analytics opt-out that lasts until site data is cleared. The gate requires coverage for changed files and checks exact file-line evidence against full SHA sources at merge time. It is intended as a trust-boundary control for review, not as a rollout claim or replacement for human code review.

Quick rollout setup:
1) Install: `npx -y gitpin@0.6.2 init --client codex`
2) Configure `.gitpin/gate.yml` on the trusted base commit
3) Add `.gitpin/change-evidence.json` in PR heads
4) Enable `uses: shmindmaster/gitpin@v0.6.2` on PR checks
5) Verify in CI with deterministic pass/fail outputs before merge

If your audience needs concrete proof of behavior, point them to the deterministic artifact in `docs/demos/pr-gate-fail-to-pass.md` and the synthetic fixture in the same directory.

## First week

| Window | Action |
| --- | --- |
| Day 0 | Re-run the required gate on a bounded pull request and verify the deployed setup guide |
| Day 1 | Post the factual gate-first announcement and answer trust-boundary questions |
| Days 1-7 | Track whether users reach a first passing required check; fix setup and report-comprehension blockers before adding features |
| Week 2 | Validate the gate with engineering managers, release owners, and governance or review owners using approved synthetic repositories |

## Do not claim

- Semantic or embedding search quality.
- Hosted multi-tenant SaaS.
- That dirty worktrees are searchable as evidence.
- Unverified user-traction claims, registry status, or package availability without current verification.
- That GitPin replaces code review, tests, source control, or repository-owned documentation.
- That a passing locator proves the claim is semantically true.
