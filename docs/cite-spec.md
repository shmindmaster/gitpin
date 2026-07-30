# GitPin citation mini-spec

Stable cite formats for humans, agents, CI gates, and handoffs. All content cites are **Git HEAD evidence**, not dirty worktree state.

## Human cite (`citation.cite`)

```text
{repository}/{sourcePath}:{line} @ {fullSha}
{repository}/{sourcePath}:{lineStart}-{lineEnd} @ {fullSha}
{repository}/{sourcePath} @ {fullSha}
```

| Field | Rules |
| --- | --- |
| `repository` | Registry name (no `/`) |
| `sourcePath` | Repo-relative path; may contain `/` |
| `line` | Optional 1-based line |
| `lineStart-lineEnd` | Optional inclusive range |
| `fullSha` | Prefer 40-char hex; 7–40 accepted for input |

Missing commit: `… @ (no commit)` — not verifiable evidence.

**Examples**

```text
sample/README.md:3 @ abc123def4567890abc123def4567890abc123de
payments/docs/auth.md:10-14 @ abc123def4567890abc123def4567890abc123de
```

## Durable handle (`citation.handle`)

```text
gitpin:{repository}@{fullSha}:{sourcePath}
gitpin:{repository}@{fullSha}:{sourcePath}:{line}
```

Use handles for machine handoffs. Resolve only when the registered repo can still `git show` that path at that SHA.

## Repo pin (`citation.repoAtSha`)

```text
{repository}@{fullSha}
```

Catalog-level identity for a repo tip (or a historical tip you pinned in a pack).

## Claim-text check

`pin.verify` / CLI `--must-contain <text>`:

| Result | Meaning |
| --- | --- |
| `claimVerdict: supported` | Text present at SHA (scope: line if set, else whole file) |
| `claimVerdict: contradicted` | Path exists but text absent |
| `claimVerdict: unproven` | Path/SHA missing or blocked |
| `claimVerdict: null` | No `mustContain` requested |

`status: contradicted` is a hard fail for CI (exit code 1).

## Evidence set

`pin.prove_set` returns `kind: evidence-set` with:

- `evidenceSetId` — 16-hex digest of sorted `(repo, path, sha, line)`
- `items[]` — individual `evidence-pack` rows
- `next` → `pin.verify_set`

## Independent re-check

```bash
git show <sha>:<sourcePath>
gitpin verify --repository <n> --path <p> --sha <hex> [--line <n>] [--must-contain <text>]
gitpin verify --from-pack pack.json
gitpin verify-cites --file notes.md
```

JSON shapes: [schemas/](schemas/).
