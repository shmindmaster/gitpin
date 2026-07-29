# Self-hosted HTTP deployment

The HTTP transport serves a commit-pinned snapshot of documentation, selected root manifests, and workflow metadata. It does not clone repositories at runtime and does not include local source files, dirty work, or untracked files.

`POST /api/mcp` accepts JSON requests with an explicit `Content-Length` of at most 1 MiB. Chunked or malformed-length requests are rejected before MCP transport handling; normal MCP clients send a bounded JSON body automatically.

## Build

```bash
pnpm validate
pnpm build
pnpm index:build
docker build -f Dockerfile.remote -t repocontext:local .
```

`index:build` rejects a registry entry that is not a Git root, excludes sensitive paths, and fails if gitleaks detects a secret in the selected output. Its report records each repository, branch, source SHA, selected files, bytes, and excluded dirty entries.
The output path must be new or a directory marked by an earlier successful RepoContext snapshot build. Existing unmarked directories, registered repository roots, and ancestors of registered repositories are rejected before any removal occurs.

## Run

```bash
docker run --rm -p 3000:3000 \
  -e REPOCONTEXT_MCP_TOKEN="replace-with-a-strong-token" \
  -e REPOCONTEXT_ALLOWED_HOSTS="mcp.example.com" \
  repocontext:local
```

Endpoints:

- `GET /healthz`
- `POST /api/mcp` with `Authorization: Bearer <token>`

Store the token in your platform’s secret manager. Restrict network access and allowed hosts to the clients that should access the snapshot.
`REPOCONTEXT_ALLOWED_HOSTS` accepts hostnames only, such as `mcp.example.com`; do not include a scheme, path, or port.
Managed health probes remain host-agnostic so platform readiness checks can run through their internal routing; all MCP requests still enforce the configured host allowlist.

## Verify

For a credential-free local container check, run:

```bash
pnpm verify:container
```

It builds the current snapshot, starts an isolated loopback container with a generated throwaway token, verifies health, authentication, tool discovery, and catalog access, then removes the container and image. Set `REPOCONTEXT_CONTAINER_PORT` only when port `3100` is unavailable.

```bash
REPOCONTEXT_MCP_URL=https://mcp.example.com/api/mcp \
REPOCONTEXT_MCP_TOKEN="your-token" \
pnpm verify:remote
```

The verification checks readiness, rejects unauthenticated MCP calls, and confirms the authenticated server lists the eight read-only tools and returns a catalog.
