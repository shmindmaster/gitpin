# Deployment

GitPin publishes through GitHub-native surfaces: npm from tagged releases on `main`,
the MCP Registry, GitHub Pages for the site, and GitHub Actions for CI. There is no
long-running service to operate.

## Publishing surfaces

- **npm package:** `gitpin` (`package.json` `files` defines the publish surface; verify
  with `pnpm verify:package`).
- **GitHub Pages site:** `https://shmindmaster.github.io/gitpin/` — deployed by
  `pages.yml` from the built `site/` output.
- **MCP Registry:** `io.github.shmindmaster/gitpin` — registered via `publish-mcp.yml`.
- **GitHub Release:** created by `release.yml` on tagged commits.

## Shipping a release

1. Open a PR against `main`; it must pass `ci.yml` and the `evidence-gate.yml` PR
   evidence gate.
2. Merge to `main`.
3. Tag the release commit and push the tag. `release.yml` builds, verifies
   (`verify:package`, `verify:container`, `verify:remote`), and publishes the npm
   package; `pages.yml` and `publish-mcp.yml` run on the release to refresh the site and
   registry entry.
4. Verify: the published package, the Pages URL, and the MCP Registry entry all reflect
   the new version; historical releases remain immutable.

## Local verification

- `pnpm verify:package` — confirms the publish surface matches `package.json` `files`.
- `pnpm verify:ci` — validates CI runner routing assumptions.
- `pnpm verify:mcp-registry` — validates the MCP registry entry.
- `pnpm verify:release-tag` — validates release tag consistency.

## Rollback

npm releases are immutable; to correct a bad release, publish a new patch/minor version
and document the issue in the CHANGELOG. Pages deploys can be reverted by redeploying a
previous workflow run from the GitHub Actions UI. See `docs/remote-deployment.md` for
remote deployment notes and `docs/troubleshooting.md` for common failure modes.
