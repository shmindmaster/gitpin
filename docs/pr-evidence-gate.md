# PR evidence gate

`gitpin gate` is a read-only required check for agent-authored and human-authored pull requests. It compares the actual merge-base diff with a committed change-evidence manifest, then verifies every evidence locator against an exact base or head commit.

It verifies **coverage, location, revision, and content hash**. It does not prove semantic correctness, successful runtime behavior, authorship, authorization, or compliance.

## Trust boundary

```text
trusted policy  = git show <base>:.gitpin/gate.yml
submitted data  = git show <head>:<policy.manifestPath>
actual change   = git diff <merge-base(base,head)>..<head>
```

The gate never reads policy or evidence from the dirty working tree. A PR therefore cannot weaken its own policy. The manifest intentionally omits `headSha`: a committed file cannot contain the SHA of the commit that contains it. GitPin binds the manifest to `headSha` when it reads the file with `git show`, and emits full-SHA citations in the report.

## Bootstrap

Copy [`templates/gate.yml`](../templates/gate.yml) to `.gitpin/gate.yml` on the default branch. Policy installation must be a separate trusted change; the first protected PR can only run after the base branch contains the policy.

Every later PR commits `.gitpin/change-evidence.json`. Each material claim:

- lists the changed paths it covers;
- contains one or more exact base/head evidence locators;
- hashes the normalized line slice (`lineStart..lineEnd`, joined with `\n`) with SHA-256.

Base evidence supports deletions. The manifest itself is excluded from coverage and cannot cite itself. Sensitive paths cannot be exposed as evidence.

## GitHub Actions

```yaml
name: Agent delivery assurance

on:
  pull_request:

permissions:
  contents: read

jobs:
  evidence:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
          ref: ${{ github.event.pull_request.head.sha }}
      - uses: shmindmaster/gitpin@v0.6.2
        with:
          base-sha: ${{ github.event.pull_request.base.sha }}
          head-sha: ${{ github.event.pull_request.head.sha }}
```

Use `pull_request`, never `pull_request_target`. Give the job `contents: read`, no secrets, and make it a required workflow with a GitHub ruleset so a PR cannot replace its own enforcement workflow.

## Optional separate check: CrewScore named controls

CrewScore is a separate product and is not required to use GitPin. Teams may add it as another required check when they also want to test whether named written controls are present before execution. Keep the checks independent and use explicit CrewScore controls—not its aggregate coverage score—as policy gates.

```yaml
  written-controls:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
          ref: ${{ github.event.pull_request.head.sha }}
      - name: Load trusted CrewScore policy
        shell: bash
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
        run: git show "$BASE_SHA:.crewscore.yml" > "$RUNNER_TEMP/crewscore.yml"
      - uses: shmindmaster/crewscore@v0.6.9
        with:
          scan-path: .
          config: ${{ runner.temp }}/crewscore.yml
          threshold: ""
```

This optional example uses CrewScore's currently published `v0.6.9` Action. CrewScore observes written text only. It does not prove runtime enforcement, agent obedience, certification, or compliance. Pin its Action version and ruleset, and keep `.crewscore.yml` on the trusted base branch.

## Local CLI

```bash
gitpin gate --base <full-40-character-sha> --head <full-40-character-sha>
```

Exit `0` means all required changed paths have material claims and all locators match committed content. Exit `1` means the gate failed. The deterministic JSON report goes to stdout.

GitPin's own repository runs this Action on every pull request as an end-to-end self-test of the published package and base-trusted policy.
