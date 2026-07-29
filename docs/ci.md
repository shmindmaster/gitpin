# CI evidence brief

`repocontext brief` emits deterministic JSON to stdout. It never writes to an indexed repository or posts to a pull request. A workflow may redirect stdout to an explicitly chosen artifact.

After `@shmindmaster/repocontext@0.2.2` is published, this GitHub Actions job checks out one repository, creates its registry under the runner's temporary directory, generates a technical brief for the checked-out commit, and uploads the JSON artifact:

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
      - run: npm install --global @shmindmaster/repocontext@0.2.2
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
          REPOCONTEXT_REGISTRY: ${{ runner.temp }}/repositories.yaml
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
