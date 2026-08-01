# Troubleshooting

## Install and first answer

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| `npx` fails on Node | Node older than 20 | Install Node 20+ and retry `npx -y gitpin@0.6.2 init --client codex` |
| Init says path is not a Git root | Directory has no `.git` | Run from a repository root or pass `--repository` to a real root |
| Init refuses to write the registry | Destination already has different content | Choose `--registry <other-path>` or remove the conflicting file deliberately |
| Init refuses registry inside a repo | Registry would live under an indexed root | Keep the default `~/.gitpin/repositories.yaml` or another external path |
| Doctor reports `blocked` | Empty registry, missing path, or non-Git entry | Fix registry paths; run `gitpin doctor` again |
| Doctor reports `attention` | Dirty or stale documentation vs HEAD | Commit, stash, or accept that agents only see committed HEAD |

## MCP client connection

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Client never lists tools | Wrong command/args/env | Paste the config printed by `init`; on Windows use `npx.cmd` when the client requires it |
| Tools listed but every call fails | Registry path not visible to the client process | Set `GITPIN_REGISTRY` to an absolute path the client can read |
| Only some repositories appear | Registry omits them or paths are wrong | Edit the YAML (outside the repo) and re-run `doctor` |
| Client shows write/dangerous tools | Wrong server connected | Confirm the server name is GitPin and tools are the 12 read-only `pin.*` tools |

## Evidence and trust

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Answer does not match open editor | Local dirty or untracked edits | Expected: content is HEAD-only. Commit or inspect status via `pin.inspect` |
| Empty search results | Query miss, policy deny, or empty docs | Try a simpler query; check `pin.catalog` doc counts; review `docs/wiki.yaml` |
| `.env` or secrets blocked | Sensitive-path policy | Expected. Do not weaken always-deny patterns |
| Brief shows `gaps` | Evidence missing in registered docs | Treat gaps as real missing sources, not model failure |
| Compare rejects revisions | Non-hex or unknown SHAs | Pass 7–40 character hexadecimal revisions that exist locally |

## HTTP / remote snapshot

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| `401` on `/api/mcp` | Missing or wrong bearer token | Set `GITPIN_MCP_TOKEN` and send `Authorization: Bearer …` |
| Health works, MCP fails host check | Host not in allowlist | Set `GITPIN_ALLOWED_HOSTS` without schemes/ports |
| No source code over HTTP | Snapshot is docs/manifests only | Use local stdio for `pin.read` / `pin.search_code` / history |
| Snapshot build fails on secrets scan | `gitleaks` missing or findings present | Install gitleaks; remove committed secrets before snapshot |

## Still stuck

1. Run `npx -y gitpin@0.6.2 doctor` with `GITPIN_REGISTRY` set.
2. Run `pnpm verify:package` from a source checkout to compare a clean packed install.
3. Open a [GitHub issue](https://github.com/shmindmaster/gitpin/issues) with the doctor JSON (redact private paths if needed) and client name.
