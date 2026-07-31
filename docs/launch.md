# GitPin public launch package

Internal checklist and copy for the GitPin release and discovery launch. Do not invent metrics, user quotes, registry status, or package availability.

## Release gate

GitPin is launchable only when the exact same version is verified in the source tag, npm package, GitHub Release, Pages site, and official MCP Registry. A green source CI run alone is not a public release.

Required before announcement:

1. Publish the new GitPin version from a new version tag; do not reuse `v0.4.0`.
2. Verify clean-machine `npx -y gitpin@latest init --client codex` and first evidence output.
3. Verify all 12 `pin.*` tools and read-only annotations.
4. Publish matching MCP Registry metadata for `io.github.shmindmaster/gitpin`.
5. Deploy the current GitPin site and confirm canonical links, package links, and migration guidance.

## Golden path

```bash
npx -y gitpin@latest init --client codex
```

Then ask a coding agent:

1. Which registered repositories are ready? Use `pin.catalog`.
2. Where is authentication documented? Search, then treat results as candidates.
3. Prove the source with `pin.prove` and verify it with `pin.verify`.
4. Build an EvidenceBrief for a bounded cross-repository release question.

The trust moment is that the answer carries a path, line, and full commit SHA that a human can re-check with `git show`.

## Positioning

GitPin is a read-only MCP server for multi-repo evidence pinned to Git HEAD. It does not index, embed, write, commit, push, or claim that a search hit is proof. Search finds candidates; prove and verify close the evidence loop.

GitPin is maintained by Sarosh Hussain, who leads its technical direction. Pendoah is his company and operating context. Keep launch copy product-first and do not attribute unrelated products to Pendoah.

## Announcement draft

> Coding agents can quote the wrong branch, dirty worktree, or stale index with confidence.
>
> GitPin is a read-only MCP server that keeps multi-repo answers pinned to Git HEAD. Search finds candidates; `pin.prove` creates an evidence pack; `pin.verify` re-checks it with path, line, and full commit SHA.
>
> No database, embeddings, write access, or hosted account. Install with `npx -y gitpin@latest init --client codex`.
>
> https://github.com/shmindmaster/gitpin
>
> Maintained by Sarosh Hussain. Pendoah is his company and operating context.

## First week

| Window | Action |
| --- | --- |
| Day 0 | Publish npm, MCP Registry, GitHub Release, and Pages; verify the clean install |
| Day 1 | Post the factual announcement and answer technical questions |
| Days 1-7 | Watch install, `doctor`, citation, and registry issues; fix blockers before adding tools |
| Week 2 | Run EvidenceBrief validation with approved synthetic repositories |

## Do not claim

- Semantic or embedding search quality.
- Hosted multi-tenant SaaS.
- That dirty worktrees are searchable as evidence.
- User adoption, registry status, or package availability without current verification.
- That GitPin replaces code review, tests, source control, or repository-owned documentation.
