# Configuration

GitPin reads repository entries from `GITPIN_REGISTRY`, `registry/repositories.yaml` in the current workspace, `repositories.yaml` in the current workspace, or `~/.gitpin/repositories.yaml`. The old `~/.repocontext` path is read only as a migration fallback.

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

Run the readiness check from the project directory or with `GITPIN_REGISTRY` set:

```bash
node dist/server.js doctor
```

`npx -y @shmindmaster/gitpin doctor` provides the same check after the matching npm version is published.

`ready` means every configured repository has committed documentation available. `attention` means evidence is available but at least one repository is stale or empty. `blocked` means a repository is unavailable or no committed documentation can be used; fix the reported registry entry before asking an agent to rely on it.

To narrow documentation exposure, add `docs/wiki.yaml` or `.gitpin/wiki.yaml` in the indexed repository. Start with [the template](../templates/wiki.yaml).
