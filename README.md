# GitPin

[![Validate](https://github.com/shmindmaster/gitpin/actions/workflows/ci.yml/badge.svg)](https://github.com/shmindmaster/gitpin/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)
[![MCP Protocol](https://img.shields.io/badge/MCP-1.30-blue.svg)](https://modelcontextprotocol.io)
[![npm](https://img.shields.io/npm/v/gitpin.svg)](https://www.npmjs.com/package/gitpin)

### Make agent-authored changes show exact evidence before merge.

**GitPin is an agent-delivery assurance gate with a local evidence MCP.** It makes material PR claims cover the actual diff and point to exact committed line slices. The local MCP supplies index-free, read-only, multi-repo evidence that humans and CI can re-check with `git show`.

```text
Agent claim
    → pin.search_*   (candidates only)
    → pin.prove      (evidence pack: path + line + full SHA + content hash)
    → pin.verify     (git show re-check; HEAD match report)
    → you run: git show <sha>:<path>
```

| Crowded category | GitPin product |
| --- | --- |
| Vector / SQLite “repo context” servers | **No embeddings, no DB, no reindex** |
| Filesystem MCP (writes) | **Never writes indexed repos** |
| One-shot repo dumps | **Live prove → verify MCP loop** |
| Grep hits as “the answer” | **Candidates → evidence pack → verification report** |
| GitHub platform MCP | **Local Git roots (private/offline)** |

Formerly RepoContext 0.3.x. See [migration](docs/migration-gitpin.md).

## Required PR evidence gate

```bash
gitpin gate --base <full-base-sha> --head <full-head-sha>
```

The gate reads policy only from the trusted base commit, reads the submitted manifest only from the head commit, compares the merge-base diff, and verifies exact line-slice hashes. It never executes PR code and never labels a locator match as proof of semantic correctness. Use the [GitHub Action and CrewScore named-control setup](docs/pr-evidence-gate.md) as a required check.

> **Release:** publish a version-matched GitPin release across npm, the MCP Registry, GitHub, and Pages before announcing. Install: `npx -y gitpin@latest`. Node 20+.

GitPin is maintained by **Sarosh Hussain**, who leads the project's technical direction. **Pendoah** is his company and operating context; GitPin remains the product and repository.

## Five-minute path

```bash
# From a committed Git repository
npx -y gitpin@latest init --client codex
```

`init` creates `~/.gitpin/repositories.yaml` **outside** the repo, runs `doctor`, prints a **first evidence line with full SHA**, and paste-ready MCP config. It never edits the indexed repository.

```bash
# Independently verify any claim (same contract as pin.verify)
npx -y gitpin@latest verify \
  --repository my-service \
  --path docs/architecture.md \
  --line 42 \
  --sha <full-or-short-hex>
```

## Product job

**When** agents invent file contents, mix dirty worktrees, or cite the wrong branch  
**You want** every fact re-checkable with `git show <sha>:<path>`  
**GitPin** registers local Git roots, serves **HEAD-only** docs/code, flags **stale** tracked docs, returns **path / line / SHA**, and closes the loop with **`pin.verify`**.

### Agent tool surface (`pin.*`) — 12 read-only tools

| Job | Tools |
| --- | --- |
| Discover | `pin.catalog` |
| Find candidates | `pin.search_docs`, `pin.search_code` |
| Prove | `pin.prove` (primary), `pin.prove_set` (1–8 cites), `pin.get_doc`, `pin.read` |
| Verify | `pin.verify`, `pin.verify_set` |
| Decide | `pin.analyze` → `EvidenceBrief` |
| Inspect / diff | `pin.inspect`, `pin.compare` |

Resource: `gitpin://catalog`. Prompt: `prove-with-git-head` (forces the product loop).  
Cite formats: [docs/cite-spec.md](docs/cite-spec.md). Agent skill template: [templates/gitpin-skill.md](templates/gitpin-skill.md).

### Functionality that is the pivot (not a rename)

- **Evidence pack** (`pin.prove`): claim binding, line slice, full SHA, `contentSha256`, `citation.cite` / `handle`, next-step verify.
- **Multi-cite sets** (`pin.prove_set` / `pin.verify_set`): stable `evidenceSetId` for multi-repo answers and CI.
- **Verification report** (`pin.verify` / CLI): independent `git show`; optional `mustContain` claim-text; status includes `contradicted`.
- **Candidates, not claims**: search returns `kind: evidence-candidates` with forced `next: pin.prove`.
- **EvidenceBrief**: multi-repo knownFacts / gaps / stable `evidenceSetId` (schema v2).
- **Dirty exclusion**: uncommitted work is never cited as HEAD evidence.

### Explicit non-goals

- Semantic / embedding search  
- Writing, committing, or pushing  
- Replacing GitHub Issues/PRs automation  
- Indexing non-Git umbrella folders as one “repo”  

## Configuration

| Variable | Purpose |
| --- | --- |
| `GITPIN_REGISTRY` | Registry YAML path (alias: `REPOCONTEXT_REGISTRY`) |
| `GITPIN_MCP_TOKEN` | HTTP bearer token (alias: `REPOCONTEXT_MCP_TOKEN`) |
| `GITPIN_ALLOWED_HOSTS` | HTTP host allowlist (alias: `REPOCONTEXT_ALLOWED_HOSTS`) |

Default registry: `~/.gitpin/repositories.yaml` (falls back to `~/.repocontext/...` if present).

## Docs

[Tools](docs/tools.md) · [Compare](docs/compare.md) · [FAQ](docs/faq.md) · [Migration](docs/migration-gitpin.md) · [Clients](docs/clients.md) · [Architecture](docs/architecture.md) · [Competitive landscape](docs/research/competitive-landscape-corrected-2026-07-30.md)

Site: [shmindmaster.github.io/gitpin](https://shmindmaster.github.io/gitpin/). GitPin is the canonical product and repository name; legacy `repocontext` references exist only for migration compatibility.

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm validate
pnpm build
pnpm verify:package
pnpm site:test
```

## License

[MIT](LICENSE)
