#!/usr/bin/env node

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
} from './git';
import { getCatalog, searchDocs, getDocs, getDocGaps } from './wiki';
import { doctorExitCode, formatDoctorReport, getDoctorReport } from './doctor';

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
      inputSchema: z.object({
        operation: z.enum(['gaps', 'compare', 'brief']),
        repositories: z.array(z.string()).max(20).optional(),
      }),
    },
    async ({ operation, repositories }) => json(await getDocGaps(operation, repositories)),
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
            text: 'Use wiki.analyze and repo.inspect to audit documentation coverage across all registered repositories and report missing README, AGENTS.md, or ARCHITECTURE.md files.',
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

if (require.main === module) {
  const command = process.argv[2];
  const action =
    command === 'doctor'
      ? runDoctor()
      : command === undefined
        ? runStdioServer()
        : Promise.reject(
            new Error(`Unknown command: ${command}. Run "repocontext doctor" or start without arguments.`),
          );
  action.catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

async function runDoctor(): Promise<void> {
  const report = await getDoctorReport();
  console.log(formatDoctorReport(report));
  process.exitCode = doctorExitCode(report);
}
