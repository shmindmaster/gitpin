import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  getRepoStatus,
  getRepoCommits,
  getRepoFile,
  searchRepoCode,
  compareRepoCommits,
  getRepoManifest,
  getRepoRecentChanges,
  getRepoTests,
} from '../platform/git/operations';
import {
  getCatalog,
  searchDocs,
  getDocs,
  getDocGaps,
} from '../modules/search/wiki';

const json = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function createServer(): McpServer {
  const server = new McpServer({ name: 'repocontext', version: '0.1.0' });

  // ─── wiki.catalog ──────────────────────────────────────────
  server.registerTool('wiki.catalog', {
    annotations: READ_ONLY,
    description: 'List all indexed repositories with sync status, doc counts, and staleness signals.',
    inputSchema: z.object({
      view: z.enum(['repositories', 'sync', 'stale']).default('repositories'),
    }),
  }, async ({ view }) => {
    const catalog = await getCatalog();
    if (view === 'stale') return json(catalog.filter((r) => r.stale));
    if (view === 'sync') return json(catalog.map(({ name, status, docCount }) => ({ name, status, docCount })));
    return json(catalog);
  });

  // ─── wiki.search ───────────────────────────────────────────
  server.registerTool('wiki.search', {
    annotations: READ_ONLY,
    description: 'Search documentation across all indexed repositories with commit-pinned results.',
    inputSchema: z.object({
      query: z.string().min(1).max(200),
      repository: z.string().optional(),
    }),
  }, async ({ query, repository }) => json(await searchDocs(query, repository)));

  // ─── wiki.get ──────────────────────────────────────────────
  server.registerTool('wiki.get', {
    annotations: READ_ONLY,
    description: 'Read one documentation page together with its source commit trace.',
    inputSchema: z.object({
      repository: z.string(),
      sourcePath: z.string(),
    }),
  }, async ({ repository, sourcePath }) => json(await getDocs(repository, sourcePath)));

  // ─── wiki.analyze ──────────────────────────────────────────
  server.registerTool('wiki.analyze', {
    annotations: READ_ONLY,
    description: 'Analyze documentation gaps across repositories or compare coverage.',
    inputSchema: z.object({
      operation: z.enum(['gaps', 'compare']),
      repositories: z.array(z.string()).max(20).optional(),
    }),
  }, async ({ operation, repositories }) => json(await getDocGaps(operation, repositories)));

  // ─── repo.inspect ──────────────────────────────────────────
  server.registerTool('repo.inspect', {
    annotations: READ_ONLY,
    description: 'Inspect repository status, commits, manifests, tests, or recent changes.',
    inputSchema: z.object({
      repository: z.string(),
      operation: z.enum(['status', 'commits', 'manifest', 'tests', 'changes']),
      limit: z.number().int().min(1).max(50).optional(),
    }),
  }, async ({ repository, operation, limit }) => {
    switch (operation) {
      case 'status': return json(await getRepoStatus(repository));
      case 'commits': return json(await getRepoCommits(repository, limit ?? 10));
      case 'manifest': return json(await getRepoManifest(repository));
      case 'tests': return json(await getRepoTests(repository));
      case 'changes': return json(await getRepoRecentChanges(repository, limit ?? 10));
    }
  });

  // ─── repo.read ─────────────────────────────────────────────
  server.registerTool('repo.read', {
    annotations: READ_ONLY,
    description: 'Read a safe source-file slice from a repository, pinned to the current commit.',
    inputSchema: z.object({
      repository: z.string(),
      sourcePath: z.string(),
      lineStart: z.number().int().positive().optional(),
      lineEnd: z.number().int().positive().optional(),
    }),
  }, async ({ repository, sourcePath, lineStart, lineEnd }) =>
    json(await getRepoFile(repository, sourcePath, lineStart, lineEnd)));

  // ─── repo.search ───────────────────────────────────────────
  server.registerTool('repo.search', {
    annotations: READ_ONLY,
    description: 'Search code within a repository using bounded, commit-pinned results.',
    inputSchema: z.object({
      repository: z.string(),
      query: z.string().min(1).max(200),
    }),
  }, async ({ repository, query }) => json(await searchRepoCode(repository, query)));

  // ─── repo.compare ──────────────────────────────────────────
  server.registerTool('repo.compare', {
    annotations: READ_ONLY,
    description: 'Compare changed files between two commits in a repository.',
    inputSchema: z.object({
      repository: z.string(),
      base: z.string().min(7).max(40),
      head: z.string().min(7).max(40),
    }),
  }, async ({ repository, base, head }) => json(await compareRepoCommits(repository, base, head)));

  return server;
}

// ─── Entry point ─────────────────────────────────────────────────

async function main(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error('[repocontext] MCP server ready (stdio) — 8 tools available');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
