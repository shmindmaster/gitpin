# Tests

Every result below was executed and is linked to its run. Hosted runs are on ephemeral GitHub-hosted runners. Main is `90598a1` (#111), and the package is 0.6.4.

## Main, at its exact SHA

`Validate` ran on push to main for `90598a113345bcab83e4d06bc304d517c1076abe` on 2026-10-15: [run 38736417735](https://github.com/shmindmaster/gitpin/actions/runs/38736417735). All seven jobs passed.

| Job | Commands (from `ci.yml`) | Environment | Result |
|---|---|---|---|
| validate (22) | `pnpm install --frozen-lockfile`, `pnpm validate`, `pnpm build` | ubuntu-latest, Node 22 | **pass**. Vitest: **105/105 tests in 18/18 files** |
| validate (24) | Same | Node 24 | **pass**. Vitest: **105/105 tests in 18/18 files** |
| website | `pnpm exec playwright install --with-deps chromium firefox webkit`, `pnpm site:test` | Chromium, Firefox, WebKit | **124 passed** |
| package | `pnpm build`, `pnpm verify:package`, `pnpm audit --audit-level high`, `npm pack` | Node 24, npm 12 | **pass** |
| package-runtime (20) | `node scripts/verify-package.mjs artifacts/*.tgz` (the packed tarball) | Node 20 | **pass** |
| package-runtime (22) | Same | Node 22 | **pass** |
| package-runtime (24) | Same | Node 24 | **pass** |

`pnpm validate` chains the following:
- lint, format check and typecheck (Biome, `tsc`);
- client-config validation;
- the CI routing check (`verify-ci-runner-routing.mjs`, which since #113 also requires `workflow_dispatch`);
- the auto-merge controller test, the env example, the MCP Registry metadata and the release-tag check;
- vitest, the site build;
- the fail-to-pass artifact gate (`verify:artifact-gate-demo`).

CodeQL also passed at `90598a1` (run 38736416516).

## The repository's own PR evidence gate
`evidence-gate.yml` runs GitPin's gate on every PR against the base policy in `.gitpin/gate.yml`. It passed on:
- [#113](https://github.com/shmindmaster/gitpin/pull/113): one claim covering `ci.yml` and the routing script, with two line hashes.
- [#111](https://github.com/shmindmaster/gitpin/pull/111).

## Production smoke checks (2026-10-15)

| Check | Result |
|---|---|
| `npx -y gitpin@0.6.4 gate --base 56fcab9 --head df94cd3` on this repository (#113 alone, with its manifest) | `evidence-verified`, exit **0** |
| `npx -y gitpin@0.6.4 gate --base 56fcab9 --head 90598a1` (two PRs; only #111's manifest at head) | `failed`, `uncovered-change` on `.github/workflows/ci.yml` and `scripts/verify-ci-runner-routing.mjs`, exit **1**. These are exactly the two files #111 does not claim. |
| `npm view gitpin version` | 0.6.4 (release v0.6.4, 2026-09-16) |
| MCP Registry search `io.github.shmindmaster/gitpin` | 0.6.4 listed |
| Pages | Redeployed from `90598a1` ([run 38737568718](https://github.com/shmindmaster/gitpin/actions/runs/38737568718)); HTTP 200; the live footer now reads "independent open-source maintainer" |

## Local runs

| Command | Commit | Result |
|---|---|---|
| `node scripts/verify-ci-runner-routing.mjs` against main's old `ci.yml` and against the #113 change (Windows, Node 26) | #113 branch | fails without `workflow_dispatch`; passes with it |
| `node dist/server.js gate --base origin/main --head HEAD` (local build) on the #113 branch | #113 branch | `ok`, exit 0 |
| The films' terminal runs (9 commands on fixture GP1) | captured on `03c1e69`, re-run byte-identical at `e4c550e` | see [DEMOS.md](DEMOS.md) |

## Not covered by any executed run
- A real MCP client session over stdio or HTTP. The tools are covered by vitest, not by an end-to-end client.
- The HTTP transport on a deployed host. Only local tests (`src/http.test.ts`) cover it.
- The Action in a third-party consumer repository. Only this repository's own evidence gate exercises it.

## Gaps found and fixed while assembling this file
- **Main was not tested after auto-merge.** Pushes made with `GITHUB_TOKEN` don't start workflows, so `e4c550e` and `56fcab9` had no Validate run of their own. [#113](https://github.com/shmindmaster/gitpin/pull/113) adds `workflow_dispatch`, and the routing check now enforces it.
- **The live site was stale.** `pages.yml` deploys only on manual dispatch, so the site still showed the company attribution that #98 removed. It was redeployed from `90598a1` and checked live.
