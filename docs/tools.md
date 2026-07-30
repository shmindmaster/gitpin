# GitPin tool reference (`pin.*`)

Ten read-only MCP tools. This is **not** a “repo context dump” surface. Tools implement an **evidence product loop**:

```text
pin.catalog → search (candidates) → pin.prove → pin.verify
                 ↘ pin.analyze brief (multi-repo decision evidence)
```

Successful content results include a **full commit SHA** (or an explicit blocked/missing status). Dirty worktrees are never treated as evidence.

All tools set `readOnlyHint: true`.

## Product contract

| Field | Meaning |
| --- | --- |
| `product` | Always `gitpin` on structured evidence responses |
| `contract` | `index-free-git-head-evidence` |
| `kind` | `catalog` · `evidence-candidates` · `evidence-pack` · `evidence-slice` · `evidence-doc` · `verification-report` · `EvidenceBrief` |
| `citation.cite` | Copy-paste claim locator: `repo/path:line @ fullSha` |
| `next` | Suggested next tool (`pin.prove` / `pin.verify`) |

## Discover

### `pin.catalog`

List registered repositories. `view`: `repositories` | `sync` | `stale`.

Default `repositories` view returns `{ kind: "catalog", repositories: [...] }` with HEAD SHAs, doc counts, and stale flags.

## Find candidates (not claims)

### `pin.search_docs`

Bounded documentation search. Returns **`evidence-candidates`**: each hit has `citation` and `next` → `pin.prove`.

### `pin.search_code`

`git grep` at HEAD (max 50). Same candidate envelope. Prefer `pin.prove` before asserting.

## Prove

### `pin.prove` (primary product tool)

Single-path **evidence pack**:

- optional `claim` string bound to the pack
- content slice + `contentSha256`
- `citation` with `cite`, `git show`, and `gitpin verify` commands
- `next` → `pin.verify`

Inputs: `repository`, `sourcePath`, optional `lineStart` / `lineEnd` / `claim`.

### `pin.get_doc` / `pin.read`

Documentation page or source slice as an evidence-oriented payload. Prefer `pin.prove` when the agent must make a claim.

## Verify

### `pin.verify`

Re-check a claim with `git show <sha>:<path>`. Reports whether current HEAD still matches. Same contract as CLI `gitpin verify`.

Inputs: `repository`, `sourcePath`, `sha` (7–40 hex), optional `line`.

## Decide / inspect / diff

### `pin.analyze`

`operation`: `gaps` | `compare` | `brief`.

- **brief** → `EvidenceBrief` (`knownFacts` / `gaps` / `evidenceSetId`, audience-aware presentation)
- Optional hex `changeRange` for bounded change evidence

### `pin.inspect`

`operation`: `status` | `commits` | `manifest` | `tests` | `changes`. Use `status` to see dirty work that is **excluded** from evidence.

### `pin.compare`

Changed paths between two hex revisions (7–40 characters).

## Resource and prompt

| Name | Kind |
| --- | --- |
| `gitpin://catalog` | Resource |
| `prove-with-git-head` | Prompt — forces catalog → prove → verify discipline |

## CLI

```bash
gitpin init --client <name>
gitpin doctor
gitpin brief --audience technical
gitpin verify --repository <n> --path <p> --sha <hex> [--line <n>]
```
