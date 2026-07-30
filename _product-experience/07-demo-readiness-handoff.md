# RepoContext Demo Readiness Handoff

## Metadata

- Episode: `release-evidence-brief`
- Assessed product revision: `f4e5ee2688e584deb2fb139c89a4528e71f22b95`
- Assessed environment: `synthetic-local`
- Assessment owner: `product-experience-engineering`
- Persona: release engineering lead
- Workflow: Generate a source-cited multi-repository release brief

## Workflow Verdicts Before and After

Before the deterministic demo harness, the product could be validated from unit and integration tests but did not have a replayable, presentation-oriented multi-repository workflow. After the harness, one actual stdio MCP session demonstrates catalog, source search, commit comparison, leadership brief, technical brief, and stale-worktree handling against three isolated Git repositories. Verdict: `DEMO-READY / PASS / PROCEED`.

## Demo-Readiness Criteria

All eleven criteria pass. The machine-readable evidence is in `demo-readiness.json` and is validated with the Product Experience and product-demo-studio validators.

## Remediation Evidence

- `scripts/demo-fixture.mjs` creates three synthetic Git repositories and resets only the repository-local `.demo/runtime` directory.
- `scripts/demo-workflow.mjs` starts the built `dist/server.js` through the real stdio MCP transport and asserts returned catalog, search, comparison, and Context Brief data.
- `scripts/verify-demo-workflow.mjs` runs the workflow twice and proves the evidence-set identifier and commit references are stable.
- `pnpm demo:verify` is the repeatable acceptance command.

## Seed and Reset

The fixture is synthetic and contains `atlas-api`, `merchant-web`, and `support-ops`. It contains seven committed documentation files. `merchant-web` deliberately has a local uncommitted change, so the actual Context Brief shows one stale repository and an explicit exclusion guardrail. Run `pnpm demo:reset` before recording or `pnpm demo:verify` for an end-to-end reset plus verification.

## Persona and Permissions

The release engineering lead needs read-only access to local Git repositories and the local RepoContext stdio server. There are no tenant, identity, or authorization transitions in this product workflow. The fixture is isolated from production and user repositories; the demo does not write to any indexed repository.

## Hero Moments

The hero moment is the real `pin.analyze` Context Brief returning a single stable evidence-set identifier with `3` examined repositories, `7` committed documents, and `1` stale repository, while each result preserves the source repository and commit. The visible stale-worktree exclusion is the required trust guardrail.

## Remaining Rough Edges

The product is an MCP/CLI service, not a browser application. Windows Terminal's GPU surface records as black in the available host capture path. The demo therefore uses a programmatic terminal recording generated directly from the live MCP transcript, with transcript hashes in the episode manifest. This is a capture-format limitation, not a simulated product interaction.

## Limitations and Confidence

The fixture demonstrates local stdio behavior only; it does not substitute for the already released protected HTTP deployment verification. Browser-form, authentication, and responsive-layout checks are not applicable to the MCP workflow. Confidence is high for the demonstrated workflow because each displayed fact is asserted against the live server response and replayed twice from a reset fixture.

## Video Handoff Decision

`PROCEED`. Capture the bounded synthetic workflow using the generated transcript recording, keep the source commit and evidence-set identifier visible, disclose the synthetic fixture and local speech synthesis, and require a named human watch-through before any external publication.
