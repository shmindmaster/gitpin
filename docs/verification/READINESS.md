```yaml
product: GitPin
repo: C:\Repos\shmindmaster\gitpin (github.com/shmindmaster/gitpin)
commit: 90598a113345bcab83e4d06bc304d517c1076abe
verdict: Verified End-to-End Ready
functional_ready: yes
demo_ready: partial
production_ready: yes
deployed_sha: "npm gitpin 0.6.4 (release v0.6.4); MCP Registry 0.6.4; Pages at 90598a1"
tests: "vitest: 105/105 (18 files) x node22/node24 @ 90598a1 run 38736417735; site Playwright: 124/124 @ 90598a1; package + package-runtime node20/22/24: pass @ 90598a1; CodeQL: pass @ 90598a1; PR evidence gate: pass on #111, #113; prod smoke: npx gitpin@0.6.4 gate exit 0 (covered) and exit 1 (uncovered-change) on this repo 2026-10-15"
films: ["D:\\OneDrive - Maya Modest LLC\\Videos\\Portfolio\\GitPin\\01 - The Gate That Wants Evidence.mp4", "D:\\OneDrive - Maya Modest LLC\\Videos\\Portfolio\\GitPin\\02 - The Gate in 30 Seconds.mp4", "D:\\OneDrive - Maya Modest LLC\\Videos\\Evergreen\\Proof Clips\\02 - GitPin Evidence Gate.mp4"]
blockers: []
next_action: "Produce the C technical deep dive (trust boundary, MCP prove/verify, hash-mismatch recovery) and the vertical short planned in DEMOS.md; then migrate the HTTP transport to MCP spec 2026-07-28 (stateless)."
updated: 2026-10-15T13:30:00Z
```

# Readiness

**Verdict: Verified End-to-End Ready.** The scope is the PR evidence gate, the evidence prove and verify path, the CLI, the npm package, the Action in this repository, and the site.

The core journey is proven at every rung: an agent PR claims nothing and fails, one line-hash claim is added, and it passes.
- It is tested on main's exact SHA (vitest on Node 22 and 24, the packed tarball on Node 20, 22 and 24).
- It is demonstrated in real recordings.
- It is production-verified: the npm `gitpin@0.6.4` gate ran against this repository's own history and produced both outcomes correctly.

| Readiness | Rating | Why |
|---|---|---|
| Functional | **yes** | 105/105 vitest across 18 files at `90598a1`. The gate's coverage, policy-from-base, hash mismatch, deleted file and replace-refs cases are all covered. The repository's own PR evidence gate passed on #111 and #113. |
| Demo | **partial** | Film 01 (1:35), the 30 s social cut and the proof clip are real recordings, with QA in [DEMOS.md](DEMOS.md). The C deep dive and vertical short are planned, not made. An MCP client session and the Action failing a PR in the Checks UI are not filmed. |
| Production | **yes** | npm 0.6.4 and the MCP Registry listing 0.6.4 match main's version. The published gate was smoke-tested (exit 0 and exit 1 on real history). Pages was redeployed from `90598a1`, with the live content checked. |

## Evidence ladder for the core capability (`gitpin gate --base --head`)

| Rung | Evidence |
|---|---|
| Implemented | `src/gate.ts`, `src/gate-policy.ts`, `src/cli-gate.ts`, `src/cli-verify.ts` |
| Integrated | The 17-hop trace in [TECHNICAL.md](TECHNICAL.md), from the CLI argument to the exit code |
| Tested | [Validate 38736417735](https://github.com/shmindmaster/gitpin/actions/runs/38736417735) at `90598a1` (`src/gate.test.ts`, `src/gate-hero.test.ts`) |
| Demonstrated | `01 - The Gate That Wants Evidence.mp4`: exit 1 on `uncovered-change`, then exit 0 with `evidence-verified` |
| Production-Verified | `npx -y gitpin@0.6.4 gate` on this repository, 2026-10-15: exit 0 for a covered change, exit 1 with `uncovered-change` on exactly the 2 unclaimed paths |

Per-capability rungs are in [COVERAGE.md](COVERAGE.md).

## Fixed during this verification
- **Main was not being tested after auto-merge.** `GITHUB_TOKEN` pushes don't start workflows, so `e4c550e` and `56fcab9` had no Validate run. [#113](https://github.com/shmindmaster/gitpin/pull/113) adds `workflow_dispatch`, and `verify-ci-runner-routing.mjs` now requires it.
- **The live site was stale.** It still showed the company attribution removed in #98, because `pages.yml` only deploys on dispatch. It was redeployed from `90598a1` (run 38737568718), and the footer was verified live.

## Risks and known limits (disclosed, not blockers)
- **The gate proves committed content, not semantic correctness.** Claim text is checked only through optional `mustContain`, and the gate's own message says so.
- **The MCP HTTP transport is stateful-era** (`sessionIdGenerator: undefined`, SDK ^1.32.1). Migrating to spec 2026-07-28 (stateless, `server/discover`) is not done. No deployed HTTP instance exists.
- **Roadmap items not shipped:** SARIF output, signed evidence receipts and release attestation verification.
- **Two root causes remain.** The auto-merge token's pushes don't start workflows, so main is tested by push only when a merge is made by hand, otherwise by dispatch. The site deploys only on manual dispatch.

## Next highest-value action
1. Make the C deep dive "Inside the gate's trust boundary", then the vertical short ([DEMOS.md](DEMOS.md)), with local narration.
2. Migrate the MCP HTTP transport to spec 2026-07-28, then film a real MCP client running `pin.prove` and `pin.verify`.
