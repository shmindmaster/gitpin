# MCP client setup

RepoContext works as a local stdio server in MCP clients that accept a command, arguments, and environment variables. These examples use a source build; use the public `npx` command below when a local checkout is unnecessary.

## Fast path from npm

Run `init` from a committed Git repository:

```bash
npx -y @shmindmaster/repocontext@latest init --client codex
```

Choose `codex`, `cursor`, `windsurf`, `zed`, or `continue`. The command creates an external registry, verifies
readiness, prints one commit-pinned fact, and returns a client configuration using the published package. It does not
edit the indexed repository or your MCP client configuration. Repeat `--repository <path>` for a multi-repository
registry.

## Source-build setup

For the source-based configurations below:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
node dist/server.js doctor
```

Replace both absolute paths below. The registry must name Git repository roots; do not commit a machine-specific registry.

## Cursor

Create `.cursor/mcp.json` in a project or `~/.cursor/mcp.json` globally.

<!-- config:cursor:start -->
```json
{
  "mcpServers": {
    "repocontext": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/repocontext/dist/server.js"],
      "env": {
        "REPOCONTEXT_REGISTRY": "/absolute/path/to/repocontext.repositories.yaml"
      }
    }
  }
}
```
<!-- config:cursor:end -->

Open **Customize**, enable RepoContext, and inspect **MCP Logs** if startup fails. Schema and locations follow the [official Cursor MCP documentation](https://cursor.com/docs/mcp).

## Windsurf

Open **Settings → Tools → Windsurf Settings → Add Server → View Raw Config**, or edit `~/.codeium/mcp_config.json`.

<!-- config:windsurf:start -->
```json
{
  "mcpServers": {
    "repocontext": {
      "command": "node",
      "args": ["/absolute/path/to/repocontext/dist/server.js"],
      "env": {
        "REPOCONTEXT_REGISTRY": "/absolute/path/to/repocontext.repositories.yaml"
      }
    }
  }
}
```
<!-- config:windsurf:end -->

Refresh the MCP list after saving. Schema and location follow the [official Windsurf MCP documentation](https://docs.devin.ai/windsurf/plugins/cascade/mcp).

## Zed

Open **Settings → AI → MCP Servers → Add Server → Add Local Server**, or add this entry to Zed's settings file.

<!-- config:zed:start -->
```json
{
  "context_servers": {
    "repocontext": {
      "command": "node",
      "args": ["/absolute/path/to/repocontext/dist/server.js"],
      "env": {
        "REPOCONTEXT_REGISTRY": "/absolute/path/to/repocontext.repositories.yaml"
      }
    }
  }
}
```
<!-- config:zed:end -->

The server indicator should turn green and report **Server is active**. Schema and verification behavior follow the [official Zed MCP documentation](https://zed.dev/docs/ai/mcp).

## Continue

Create `.continue/mcpServers/repocontext.yaml` at the workspace root.

<!-- config:continue:start -->
```yaml
name: RepoContext
version: 0.2.4
schema: v1
mcpServers:
  - name: RepoContext
    type: stdio
    command: node
    args:
      - /absolute/path/to/repocontext/dist/server.js
    env:
      REPOCONTEXT_REGISTRY: /absolute/path/to/repocontext.repositories.yaml
```
<!-- config:continue:end -->

MCP tools are available in Continue's agent mode. Schema and standalone block metadata follow the [official Continue MCP documentation](https://docs.continue.dev/customize/deep-dives/mcp).

## Verify the connection

All four clients should expose eight read-only tools. Ask the client to call `wiki.catalog`; the result should include each selected repository and a full commit SHA. Then call `wiki.analyze` with `operation: "brief"` and confirm `evidenceSetId`, `knownFacts`, `gaps`, and `technicalTrace` are present.

For the public package, replace `command: node` and the compiled path with `command: npx` (`npx.cmd` when a Windows client requires it) and `args: ["-y", "@shmindmaster/repocontext@0.2.4"]`.

The configuration blocks are syntax-checked by `pnpm verify:clients`. Client-native activation still requires the installed client and, for the `npx` form, the public npm package.
