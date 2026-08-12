# Deployment

GitPin publishes through GitHub-native surfaces: npm from tagged releases on `main`,
the MCP Registry, GitHub Pages for the site, and GitHub Actions for CI. There is no
long-running service to operate.

## Publishing surfaces

- **npm package:** `gitpin` (`package.json` `files` defines the publish surface; verify
  with `pnpm verify:package`).
- **GitHub Pages site:** `https://shmindmaster.github.io/gitpin/` — `pages.yml`
  runs `pnpm site:build` and deploys the resulting `.site-dist/` artifact.
- **MCP Registry:** `io.github.shmindmaster/gitpin` — registered via `publish-mcp.yml`.
- **GitHub Release:** created by `release.yml` on tagged commits.

## Shipping a release

1. Open a PR against `main`; it must pass `ci.yml` and the `evidence-gate.yml` PR
   evidence gate.
2. Merge to `main`.
3. Set `release_tag=vX.Y.Z`, tag the release commit, and push the tag. `release.yml`
   runs `pnpm validate`, `pnpm build`, and `pnpm verify:package`, verifies the tag,
   publishes the npm package, and creates the GitHub Release.
4. Wait for `release.yml` to succeed, then dispatch the two manual publishing
   workflows against the same tag:

   ```bash
   gh workflow run pages.yml --ref "$release_tag"
   gh workflow run publish-mcp.yml --ref "$release_tag" -f release_ref="$release_tag"
   ```

5. Verify that both dispatched runs succeeded and that the published package, Pages
   URL, and MCP Registry entry all reflect the new version. Historical releases
   remain immutable.
6. Run `pnpm verify:container` and `pnpm verify:remote` separately when those
   deployment surfaces are in scope; `release.yml` does not run them.

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
