# MCP client setup (GitPin)

## Fast path from npm

```bash
npx -y @shmindmaster/gitpin@latest init --client codex
```

Clients: `claude-code`, `codex`, `cursor`, `windsurf`, `zed`, `continue`.

## Source-build setup

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
node dist/server.js doctor
```

## Cursor

Create `.cursor/mcp.json` or `~/.cursor/mcp.json`.

<!-- config:cursor:start -->
```json
{
  "mcpServers": {
    "gitpin": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/repocontext/dist/server.js"],
      "env": {
        "GITPIN_REGISTRY": "/absolute/path/to/gitpin.repositories.yaml"
      }
    }
  }
}
```
<!-- config:cursor:end -->

See [Cursor MCP docs](https://cursor.com/docs/mcp).

## Windsurf

<!-- config:windsurf:start -->
```json
{
  "mcpServers": {
    "gitpin": {
      "command": "node",
      "args": ["/absolute/path/to/repocontext/dist/server.js"],
      "env": {
        "GITPIN_REGISTRY": "/absolute/path/to/gitpin.repositories.yaml"
      }
    }
  }
}
```
<!-- config:windsurf:end -->

See [Windsurf MCP docs](https://docs.devin.ai/windsurf/plugins/cascade/mcp).

## Zed

<!-- config:zed:start -->
```json
{
  "context_servers": {
    "gitpin": {
      "command": "node",
      "args": ["/absolute/path/to/repocontext/dist/server.js"],
      "env": {
        "GITPIN_REGISTRY": "/absolute/path/to/gitpin.repositories.yaml"
      }
    }
  }
}
```
<!-- config:zed:end -->

See [Zed MCP docs](https://zed.dev/docs/ai/mcp).

## Continue

<!-- config:continue:start -->
```yaml
name: GitPin
version: 0.4.0
schema: v1
mcpServers:
  - name: GitPin
    type: stdio
    command: node
    args:
      - /absolute/path/to/repocontext/dist/server.js
    env:
      GITPIN_REGISTRY: /absolute/path/to/gitpin.repositories.yaml
```
<!-- config:continue:end -->

See [Continue MCP docs](https://docs.continue.dev/customize/deep-dives/mcp).

## Agent rule (recommended)

```text
Use GitPin pin.* tools for multi-repo evidence—not generic repo dumps.
Workflow: pin.catalog → search candidates → pin.prove → pin.verify.
Every claim needs path, line, and full SHA (citation.cite). Dirty worktrees are not evidence.
```

Supported clients should list **ten** read-only `pin.*` tools (including `pin.prove` and `pin.verify`).
