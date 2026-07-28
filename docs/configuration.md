# Configuration

RepoContext reads repository entries from `REPOCONTEXT_REGISTRY`, `registry/repositories.yaml` in the current workspace, `repositories.yaml` in the current workspace, or `~/.repocontext/repositories.yaml`.

Registry paths are relative to the registry file. Register Git repository roots only.

```yaml
repositories:
  - name: web
    path: ../web
    branches: [main]
  - name: service
    path: ../service
    branches: [main, release]
```

`branches` protects snapshot builds from indexing an unexpected checkout branch. Local stdio reads the current `HEAD` and marks documentation as stale when its working-tree file differs from that committed version.

Run the readiness check from the project directory or with `REPOCONTEXT_REGISTRY` set:

```bash
npx repocontext doctor
```

`ready` means every configured repository has committed documentation available. `attention` means evidence is available but at least one repository is stale or empty. `blocked` means a repository is unavailable or no committed documentation can be used; fix the reported registry entry before asking an agent to rely on it.

To narrow documentation exposure, add `docs/wiki.yaml` or `.repocontext/wiki.yaml` in the indexed repository. Start with [the template](../templates/wiki.yaml).
