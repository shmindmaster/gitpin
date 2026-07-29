#!/usr/bin/env node

import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { runCli } from './cli';
import { BRIEF_AUDIENCES, getContextBrief } from './context-brief';
import {
  getRepoStatus,
  getRepoCommits,
  getRepoFile,
  searchRepoCode,
  compareRepoCommits,
  getRepoManifest,
  getRepoRecentChanges,
  getRepoTests,
} from './git';
import { getCatalog, searchDocs, getDocs, getDocGaps } from './wiki';

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

export function createServer(): McpServer {
  const server = new McpServer({ name: 'repocontext', version: '0.2.0' });

  server.registerTool(
    'wiki.catalog',
    {
      annotations: READ_ONLY,
      description: 'List all indexed repositories with sync status and doc counts.',
      inputSchema: z.object({ view: z.enum(['repositories', 'sync', 'stale']).default('repositories') }),
    },
    async ({ view }) => {
      const catalog = await getCatalog();
      if (view === 'stale') return json(catalog.filter((repository) => repository.stale));
      if (view === 'sync') {
        return json(
          catalog.map(({ name, status, docCount, stale, commitSha, confidence }) => ({
            name,
            status,
            docCount,
            stale,
            commitSha,
            confidence,
          })),
        );
      }
      return json(catalog);
    },
  );

  server.registerTool(
    'wiki.search',
    {
      annotations: READ_ONLY,
      description: 'Search documentation across all indexed repositories.',
      inputSchema: z.object({ query: z.string().min(1).max(200), repository: z.string().optional() }),
    },
    async ({ query, repository }) => json(await searchDocs(query, repository)),
  );

  server.registerTool(
    'wiki.get',
    {
      annotations: READ_ONLY,
      description: 'Read one documentation page with its source commit trace.',
      inputSchema: z.object({ repository: z.string(), sourcePath: z.string() }),
    },
    async ({ repository, sourcePath }) => json(await getDocs(repository, sourcePath)),
  );

  server.registerTool(
    'wiki.analyze',
    {
      annotations: READ_ONLY,
      description: 'Analyze documentation gaps, compare coverage, or generate a source-cited context brief.',
      inputSchema: z.discriminatedUnion('operation', [
        z.object({ operation: z.literal('gaps'), repositories: z.array(z.string()).max(20).optional() }).strict(),
        z.object({ operation: z.literal('compare'), repositories: z.array(z.string()).max(20).optional() }).strict(),
        z
          .object({
            operation: z.literal('brief'),
            repositories: z.array(z.string()).max(20).optional(),
            audience: z.enum(BRIEF_AUDIENCES).default('technical'),
            changeRange: z
              .object({
                repository: z.string().min(1),
                base: z.string().regex(/^[0-9a-f]{7,40}$/iu),
                head: z.string().regex(/^[0-9a-f]{7,40}$/iu),
              })
              .strict()
              .optional(),
          })
          .strict(),
      ]),
    },
    async (input) =>
      json(
        input.operation === 'brief'
          ? await getContextBrief({
              repositories: input.repositories,
              audience: input.audience,
              changeRange: input.changeRange,
            })
          : await getDocGaps(input.operation, input.repositories),
      ),
  );

  server.registerTool(
    'repo.inspect',
    {
      annotations: READ_ONLY,
      description: 'Inspect repository status, commits, manifests, tests, or recent changes.',
      inputSchema: z.object({
        repository: z.string(),
        operation: z.enum(['status', 'commits', 'manifest', 'tests', 'changes']),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    },
    async ({ repository, operation, limit }) => {
      switch (operation) {
        case 'status':
          return json(await getRepoStatus(repository));
        case 'commits':
          return json(await getRepoCommits(repository, limit ?? 10));
        case 'manifest':
          return json(await getRepoManifest(repository));
        case 'tests':
          return json(await getRepoTests(repository));
        case 'changes':
          return json(await getRepoRecentChanges(repository, limit ?? 10));
        default:
          return json({ error: `Unknown operation: ${operation}` });
      }
    },
  );

  server.registerTool(
    'repo.read',
    {
      annotations: READ_ONLY,
      description: 'Read a source-file slice pinned to the current commit. Sensitive files are blocked.',
      inputSchema: z.object({
        repository: z.string(),
        sourcePath: z.string(),
        lineStart: z.number().int().positive().optional(),
        lineEnd: z.number().int().positive().optional(),
      }),
    },
    async ({ repository, sourcePath, lineStart, lineEnd }) =>
      json(await getRepoFile(repository, sourcePath, lineStart, lineEnd)),
  );

  server.registerTool(
    'repo.search',
    {
      annotations: READ_ONLY,
      description: 'Search code within a repository using git grep.',
      inputSchema: z.object({ repository: z.string(), query: z.string().min(1).max(200) }),
    },
    async ({ repository, query }) => json(await searchRepoCode(repository, query)),
  );

  server.registerTool(
    'repo.compare',
    {
      annotations: READ_ONLY,
      description: 'Compare changed files between two commits.',
      inputSchema: z.object({
        repository: z.string(),
        base: z.string().min(7).max(40),
        head: z.string().min(7).max(40),
      }),
    },
    async ({ repository, base, head }) => json(await compareRepoCommits(repository, base, head)),
  );

  server.registerResource(
    'catalog',
    'repocontext://catalog',
    { mimeType: 'application/json', description: 'RepoContext Repository Catalog' },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await getCatalog(), null, 2) }],
    }),
  );

  server.registerPrompt(
    'audit-documentation-gaps',
    {
      description: 'Audit documentation coverage across registered repositories and identify missing documentation.',
    },
    async () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Use wiki.analyze and repo.inspect to audit documentation coverage across all registered repositories and report missing README.md, AGENTS.md, or docs/architecture.md files.',
          },
        },
      ],
    }),
  );

  return server;
}

export async function runStdioServer(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error('[repocontext] MCP server ready (stdio) - 8 tools available');
}

function isDirectExecution(): boolean {
  if (typeof require !== 'undefined' && require.main === module) return true;
  if (process.argv[1]) {
    try {
      const mainPath = resolve(process.argv[1]);
      return mainPath === __filename || mainPath === resolve(__dirname, 'server.js');
    } catch {
      return false;
    }
  }
  return false;
}

if (isDirectExecution()) {
  const command = process.argv[2];
  const action = command === undefined ? runStdioServer() : runCli(process.argv.slice(2));
  action.catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
