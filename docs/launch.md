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

Use `npx -y gitpin@latest init --client codex` when an agent needs local, index-free evidence across repositories. Search results are candidates; `pin.prove` and `pin.verify` produce path, line, line hash, and full-SHA evidence for the PR manifest. This MCP workflow supports the gate but is not required to adopt it.

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
- User adoption, registry status, or package availability without current verification.
- That GitPin replaces code review, tests, source control, or repository-owned documentation.
- That a passing locator proves the claim is semantically true.
