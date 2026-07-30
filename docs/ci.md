# CI evidence brief

`repocontext brief` emits deterministic JSON to stdout. It never writes to an indexed repository or posts to a pull request. A workflow may redirect stdout to an explicitly chosen artifact.

After `@shmindmaster/gitpin@0.3.1` is published, this GitHub Actions job checks out one repository, creates its registry under the runner's temporary directory, generates a technical brief for the checked-out commit, and uploads the JSON artifact:

```yaml
name: RepoContext evidence

on:
  pull_request:

permissions:
  contents: read

jobs:
  context:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - run: npm install --global @shmindmaster/gitpin@0.3.1
      - name: Build registry
        shell: bash
        run: |
          cat > "$RUNNER_TEMP/repositories.yaml" <<YAML
          repositories:
            - name: current
              path: $GITHUB_WORKSPACE
              branches: [${GITHUB_BASE_REF:-main}]
          YAML
      - name: Generate brief
        shell: bash
        env:
          GITPIN_REGISTRY: ${{ runner.temp }}/repositories.yaml
        run: |
          repocontext doctor
          repocontext brief \
            --audience technical \
            --repository current \
            --change-repository current \
            --base "${{ github.event.pull_request.base.sha }}" \
            --head "${{ github.event.pull_request.head.sha }}" \
            > "$RUNNER_TEMP/context-brief.json"
      - uses: actions/upload-artifact@v4
        with:
          name: repocontext-brief
          path: ${{ runner.temp }}/context-brief.json
          if-no-files-found: error
```

For a multi-repository brief, add explicit checkout steps and registry rows. Use immutable revisions, avoid credentials in the registry, and keep pull-request commenting as a separate opt-in job with narrowly scoped permissions.

## Citation gate (optional)

Re-check agent or PR notes that embed GitPin cite strings (`repo/path:line @ sha`):

```bash
export GITPIN_REGISTRY="$RUNNER_TEMP/repositories.yaml"
# after writing notes.md or pack.json from the agent:
pnpm exec tsx src/server.ts verify-cites --file notes.md
# or:
node scripts/verify-citations.mjs --file notes.md
# evidence pack from pin.prove_set:
node scripts/verify-citations.mjs --pack pack.json
```

Exit code is non-zero on `mismatch`, `missing`, `blocked`, `contradicted`, or partial set failure. See [cite-spec.md](cite-spec.md).
