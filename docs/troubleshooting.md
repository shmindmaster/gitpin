# Troubleshooting

## Install and first answer

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| `npx` fails on Node | Node older than 20 | Install Node 20+ and retry `npx -y @shmindmaster/repocontext@latest init --client codex` |
| Init says path is not a Git root | Directory has no `.git` | Run from a repository root or pass `--repository` to a real root |
| Init refuses to write the registry | Destination already has different content | Choose `--registry <other-path>` or remove the conflicting file deliberately |
| Init refuses registry inside a repo | Registry would live under an indexed root | Keep the default `~/.repocontext/repositories.yaml` or another external path |
| Doctor reports `blocked` | Empty registry, missing path, or non-Git entry | Fix registry paths; run `repocontext doctor` again |
| Doctor reports `attention` | Dirty or stale documentation vs HEAD | Commit, stash, or accept that agents only see committed HEAD |

## MCP client connection

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Client never lists tools | Wrong command/args/env | Paste the config printed by `init`; on Windows use `npx.cmd` when the client requires it |
| Tools listed but every call fails | Registry path not visible to the client process | Set `REPOCONTEXT_REGISTRY` to an absolute path the client can read |
| Only some repositories appear | Registry omits them or paths are wrong | Edit the YAML (outside the repo) and re-run `doctor` |
| Client shows write/dangerous tools | Wrong server connected | Confirm the server name is RepoContext and tools are the eight `wiki.*` / `repo.*` tools |

## Evidence and trust

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Answer does not match open editor | Local dirty or untracked edits | Expected: content is HEAD-only. Commit or inspect status via `repo.inspect` |
| Empty search results | Query miss, policy deny, or empty docs | Try a simpler query; check `wiki.catalog` doc counts; review `docs/wiki.yaml` |
| `.env` or secrets blocked | Sensitive-path policy | Expected. Do not weaken always-deny patterns |
| Brief shows `gaps` | Evidence missing in registered docs | Treat gaps as real missing sources, not model failure |
| Compare rejects revisions | Non-hex or unknown SHAs | Pass 7–40 character hexadecimal revisions that exist locally |

## HTTP / remote snapshot

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| `401` on `/api/mcp` | Missing or wrong bearer token | Set `REPOCONTEXT_MCP_TOKEN` and send `Authorization: Bearer …` |
| Health works, MCP fails host check | Host not in allowlist | Set `REPOCONTEXT_ALLOWED_HOSTS` without schemes/ports |
| No source code over HTTP | Snapshot is docs/manifests only | Use local stdio for `repo.read` / `repo.search` / history |
| Snapshot build fails on secrets scan | `gitleaks` missing or findings present | Install gitleaks; remove committed secrets before snapshot |

## Still stuck

1. Run `npx -y @shmindmaster/repocontext@latest doctor` with `REPOCONTEXT_REGISTRY` set.
2. Run `pnpm verify:package` from a source checkout to compare a clean packed install.
3. Open a [GitHub issue](https://github.com/shmindmaster/repocontext/issues) with the doctor JSON (redact private paths if needed) and client name.
