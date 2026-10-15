# GitPin Functional Verification

Scope: GitPin 0.6.4 at `e4c550e`. Everything below was read from source and docs; no test or command was run for this pack. Results are in [TESTS.md](TESTS.md).

## Roles

| Role | What they do | Permission model |
| --- | --- | --- |
| PR author or coding agent | Commits `.gitpin/change-evidence.json`, runs the gate locally | Git access to the repo only |
| Reviewer | Reads the report, rechecks locators with `git show` | Read access |
| CI owner | Installs `.gitpin/gate.yml` on the default branch, makes the check required | Repo admin. Policy change must be a separate merge |
| MCP client | Calls `pin.*` tools to find, prove and verify evidence | Local stdio: the process user. HTTP: bearer token in `GITPIN_MCP_TOKEN` |

There are no user accounts, sessions or roles inside GitPin. Access control is Git access, the repo's rulesets, and the HTTP bearer token.

## Journeys

| # | Journey | Command or action |
| --- | --- | --- |
| 1 | Install policy (once, separate trusted change) | Copy `templates/gate.yml` to `.gitpin/gate.yml` on the default branch |
| 2 | Run the gate locally | `gitpin gate --base <40-char sha> --head <40-char sha> [--root <repo>] [--policy <path>] [--repository <name>]` |
| 3 | Run the gate in CI | `uses: shmindmaster/gitpin@<release sha>` with `base-sha` and `head-sha`. See [docs/pr-evidence-gate.md](../pr-evidence-gate.md) |
| 4 | Fix a failed gate | Read `violations[]` in the JSON report, add a claim or locator, recommit, rerun. The film shows `uncovered-change` fixed by one locator |
| 5 | Prove a claim | `pin.prove` (MCP) returns path, line, full SHA, `contentSha256` |
| 6 | Verify a claim | `gitpin verify --repository <n> --path <p> --sha <hex> [--line <n>] [--must-contain <text>]`, or `--handle`, or `--from-pack` |
| 7 | Verify citations in a doc | `gitpin verify-cites --file notes.md` |
| 8 | Build a multi-cite set | `gitpin prove-set --from-json items.json` |
| 9 | Connect an MCP client | `gitpin init --client <name>`, then `gitpin doctor` |
| 10 | Serve over HTTP | `pnpm mcp:http` or `node dist/http.js` with `GITPIN_MCP_TOKEN` set; POST `/api/mcp`; `GET /healthz` |
| 11 | Plain-git recheck | `git show <sha>:<path>`, take the line range, SHA-256 it, compare to the locator |
| 12 | Hero demo | `pnpm demo:gate` builds a synthetic repo, fails with `uncovered-change`, adds one locator, passes |

The twelve MCP tools: `pin.catalog`, `pin.search_docs`, `pin.search_code`, `pin.prove`, `pin.prove_set`, `pin.get_doc`, `pin.read`, `pin.verify`, `pin.verify_set`, `pin.analyze`, `pin.inspect`, `pin.compare`. Contracts: [docs/tools.md](../tools.md). There is no `pin.gate` tool: the gate is CLI and Action only.

## Business rules (gate)

- Policy is read with `git show <base>:.gitpin/gate.yml`. The manifest is read with `git show <head>:<manifestPath>`. The working tree is never read.
- Both SHAs must be full 40-character hex. Short revisions are rejected.
- Required paths are the files in `git diff <merge-base>..<head>` that match `coverage.include` and not `coverage.exclude`, minus the manifest itself.
- Every required path must appear in some claim's `covers`, else `uncovered-change`.
- Each locator is a line range at `base` or `head`. The slice is the lines joined with `\n`, hashed with SHA-256, and must equal `contentSha256`. Max 200 lines per locator.
- `policyChanges: block` fails any PR that edits the policy file (`policy-change-blocked`).
- Limits in this repo's `.gitpin/gate.yml`: 100 changed paths, 50 claims, 8 locators per claim, 2 MiB per file. Schema maxima: 1000 paths, 100 claims, 16 locators, 10 MiB.
- A claim cannot cite the manifest (`manifest-self-citation`) or a sensitive path (`sensitive-evidence-path`; rules in `src/policy.ts`).
- Duplicate claim ids (`duplicate-claim-id`) and duplicate `covers` entries (`duplicate-cover`) fail.
- Deleted files are supported: cite them with `ref: base`.
- Git replace refs are ignored (`--no-replace-objects`), so a citation binds to the printed SHA.
- The gate runs no PR code and makes no network calls.

## Errors and exit codes

| Situation | Behaviour |
| --- | --- |
| All claims verified, all required paths covered | Report `status: ok`, exit 0 |
| Any violation | Report `status: failed`, exit 1, JSON report on stdout |
| Violation codes | `uncovered-change`, `content-hash-mismatch`, `evidence-unavailable`, `evidence-limit`, `duplicate-claim-id`, `duplicate-cover`, `policy-change-blocked`, `manifest-self-citation`, `sensitive-evidence-path` |
| Bad input or setup (short SHA, unknown option, missing or invalid policy, invalid manifest, over a limit, no merge base) | Exception, message on stderr, exit 1, no JSON report |
| `gitpin verify` and `verify-cites` | Exit 0 only when report status is `ok`; `missing`, `blocked`, `mismatch`, `contradicted` exit 1 |
| HTTP | 401 bad or missing token, 404 wrong path, 405 non-POST, 411/400/413 content-length problems, 421 host not allowed, 503 on `/healthz` when the registry is unusable |

Recovery is by recommit: there is no state to repair. Setup errors and gate failures both exit 1, so a caller has to read stdout to tell them apart.

## Data in and out

In: Git objects, `.gitpin/gate.yml` (YAML), `.gitpin/change-evidence.json`, and for MCP an optional `repositories.yaml` registry. Out: JSON report (`kind: gitpin-gate-report`), citations, the Action step summary. Nothing is stored. See [TECHNICAL.md](TECHNICAL.md).

## Known gaps

- No semantic check that a claim's `statement` matches the cited lines. `gitpin verify` and `pin.verify` offer an optional `mustContain`; the gate does not use it.
- No SARIF output. On the roadmap ([ROADMAP.md](../../ROADMAP.md)).
- No signed or attested receipts; the report carries a `reportId` hash only.
- The HTTP transport is stateless-per-request in code but built the stateful-era way (`sessionIdGenerator: undefined`, SDK `^1.32.1`). Conformance with the 2026-07-28 MCP spec (`server/discover`, routing headers) is not evidenced.
- `gitpin gate` is not exposed as an MCP tool.
- Setup errors and gate failures share exit code 1.
- No published case of the gate catching a real agent PR (not checked beyond the repo's own docs).
- Open PRs, pending and not evaluated here: #101 (faster git fixture tests, gate text output) and #102 (HTTP binds loopback by default, validates Origin). Dependabot PRs are also open (#89, #95, #97, #103 to #109).
