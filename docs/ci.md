# CI EvidenceBrief

`gitpin brief` emits deterministic JSON to stdout. It never writes to an indexed repository or posts to a pull request. A workflow may redirect stdout to an explicitly chosen artifact.

After the matching GitPin version is published, this GitHub Actions job checks out one repository, creates its registry under the runner's temporary directory, generates an EvidenceBrief for the checked-out commit, and uploads the JSON artifact:

```yaml
name: GitPin evidence

on:
  pull_request:

permissions:
  contents: read

jobs:
  evidence:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - run: npm install --global @shmindmaster/gitpin@latest
      - name: Build registry
        shell: bash
        run: |
          cat > "$RUNNER_TEMP/repositories.yaml" <<YAML
          repositories:
            - name: current
              path: $GITHUB_WORKSPACE
              branches: [${GITHUB_BASE_REF:-main}]
          YAML
      - name: Generate EvidenceBrief
        shell: bash
        env:
          GITPIN_REGISTRY: ${{ runner.temp }}/repositories.yaml
        run: |
          gitpin doctor
          gitpin brief \
            --audience technical \
            --repository current \
            --change-repository current \
            --base "${{ github.event.pull_request.base.sha }}" \
            --head "${{ github.event.pull_request.head.sha }}" \
            > "$RUNNER_TEMP/evidence-brief.json"
      - uses: actions/upload-artifact@v4
        with:
          name: gitpin-evidence-brief
          path: ${{ runner.temp }}/evidence-brief.json
          if-no-files-found: error
```

For a multi-repository brief, add explicit checkout steps and registry rows. Use immutable revisions, avoid credentials in the registry, and keep pull-request commenting as a separate opt-in job with narrowly scoped permissions.

## Citation gate

Re-check notes or evidence packs that embed GitPin cite strings:

```bash
export GITPIN_REGISTRY="$RUNNER_TEMP/repositories.yaml"
node scripts/verify-citations.mjs --file notes.md
node scripts/verify-citations.mjs --pack pack.json
```

Exit code is non-zero on `mismatch`, `missing`, `blocked`, `contradicted`, or partial set failure. See [cite-spec.md](cite-spec.md).
