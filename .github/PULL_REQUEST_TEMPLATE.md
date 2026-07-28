## Problem

What user or maintainer problem does this change address? Link the issue when one exists.

## Approach

Describe the smallest implementation choice and any public MCP contract impact.

## Validation

- [ ] `pnpm validate`
- [ ] `pnpm build`
- [ ] `pnpm verify:package` when packaging, startup, registry, or MCP behavior changes
- [ ] Documentation updated when behavior or setup changes

List any check that could not run and explain why.

## Safety and provenance

- [ ] Repository operations remain read-only.
- [ ] Results remain commit-pinned with source provenance.
- [ ] No credentials, private registries, local paths, or proprietary fixtures are included.
- [ ] Exposure-policy and sensitive-path behavior is covered when relevant.
