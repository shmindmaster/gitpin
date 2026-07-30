#!/usr/bin/env node

import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { runCli } from './cli';
import { BRIEF_AUDIENCES, getContextBrief } from './context-brief';
import {
  asCodeCandidateHits,
  asCandidateHits,
  asPinnedSlice,
  buildEvidencePack,
  PRODUCT_CONTRACT,
  verifyEvidenceClaim,
} from './evidence';
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
import { registerProvePrompt } from './pin-prompt';
import { getCatalog, searchDocs, getDocs, getDocGaps } from './wiki';

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const HEX_SHA = /^[0-9a-f]{7,40}$/iu;

export function createServer(): McpServer {
  const server = new McpServer({ name: 'gitpin', version: '0.4.0' });

  // --- Discover ---
  server.registerTool(
    'pin.catalog',
    {
      annotations: READ_ONLY,
      description:
        'Discover registered Git roots: HEAD SHAs, documentation counts, stale signals. Call first. Not a content claim.',
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
      return json({
        kind: 'catalog',
        product: 'gitpin',
        contract: PRODUCT_CONTRACT,
        repositories: catalog,
      });
    },
  );

  // --- Find candidates ---
  server.registerTool(
    'pin.search_docs',
    {
      annotations: READ_ONLY,
      description:
        'Find documentation evidence candidates (not claims). Hits include citation + next pin.prove step. Git HEAD only.',
      inputSchema: z.object({ query: z.string().min(1).max(200), repository: z.string().optional() }),
    },
    async ({ query, repository }) => json(asCandidateHits(await searchDocs(query, repository), query)),
  );

  server.registerTool(
    'pin.search_code',
    {
      annotations: READ_ONLY,
      description:
        'Find code evidence candidates via git grep at HEAD. Hits are candidates; call pin.prove then pin.verify to claim.',
      inputSchema: z.object({ repository: z.string(), query: z.string().min(1).max(200) }),
    },
    async ({ repository, query }) =>
      json(asCodeCandidateHits(repository, query, await searchRepoCode(repository, query))),
  );

  // --- Prove ---
  server.registerTool(
    'pin.prove',
    {
      annotations: READ_ONLY,
      description:
        'Primary product tool: return a verifiable evidence pack (body slice, path, line, full SHA, content hash, verify next-step). Prefer for any factual claim.',
      inputSchema: z.object({
        repository: z.string(),
        sourcePath: z.string(),
        lineStart: z.number().int().positive().optional(),
        lineEnd: z.number().int().positive().optional(),
        claim: z.string().min(1).max(500).optional(),
      }),
    },
    async (input) => json(await buildEvidencePack(input)),
  );

  server.registerTool(
    'pin.get_doc',
    {
      annotations: READ_ONLY,
      description: 'Read one committed documentation page as a pinned evidence slice with full SHA.',
      inputSchema: z.object({ repository: z.string(), sourcePath: z.string() }),
    },
    async ({ repository, sourcePath }) => {
      const doc = await getDocs(repository, sourcePath);
      return json({
        kind: 'evidence-doc',
        product: 'gitpin',
        contract: PRODUCT_CONTRACT,
        ...doc,
        next: {
          tool: 'pin.prove',
          arguments: { repository, sourcePath },
        },
      });
    },
  );

  server.registerTool(
    'pin.read',
    {
      annotations: READ_ONLY,
      description:
        'Read a HEAD-only source slice as an evidence slice (path, lines, full SHA). Sensitive paths blocked. Prefer pin.prove for claims.',
      inputSchema: z.object({
        repository: z.string(),
        sourcePath: z.string(),
        lineStart: z.number().int().positive().optional(),
        lineEnd: z.number().int().positive().optional(),
      }),
    },
    async ({ repository, sourcePath, lineStart, lineEnd }) =>
      json(asPinnedSlice(await getRepoFile(repository, sourcePath, lineStart, lineEnd))),
  );

  // --- Verify ---
  server.registerTool(
    'pin.verify',
    {
      annotations: READ_ONLY,
      description:
        'Independently re-check a claim: path exists at SHA via git show; report whether HEAD still matches. Closes the prove loop.',
      inputSchema: z.object({
        repository: z.string(),
        sourcePath: z.string(),
        sha: z.string().regex(HEX_SHA),
        line: z.number().int().positive().optional(),
      }),
    },
    async (input) => json(await verifyEvidenceClaim(input)),
  );

  // --- Decide / inspect / diff ---
  server.registerTool(
    'pin.analyze',
    {
      annotations: READ_ONLY,
      description:
        'Evidence brief (knownFacts/gaps/evidenceSetId), documentation gaps, or coverage compare. Brief is multi-repo decision evidence—not a dump.',
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
                base: z.string().regex(HEX_SHA),
                head: z.string().regex(HEX_SHA),
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
    'pin.inspect',
    {
      annotations: READ_ONLY,
      description:
        'Inspect HEAD-pinned status, commits, manifests, tests, or recent changes. status surfaces dirty work that is excluded from evidence.',
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
    'pin.compare',
    {
      annotations: READ_ONLY,
      description:
        'Diff changed paths between two hex revisions. Bounded change evidence for reviews—not semantic search.',
      inputSchema: z.object({
        repository: z.string(),
        base: z.string().regex(HEX_SHA),
        head: z.string().regex(HEX_SHA),
      }),
    },
    async ({ repository, base, head }) => json(await compareRepoCommits(repository, base, head)),
  );

  server.registerResource(
    'catalog',
    'gitpin://catalog',
    { mimeType: 'application/json', description: 'GitPin multi-repo catalog with HEAD SHAs' },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await getCatalog(), null, 2) }],
    }),
  );
  registerProvePrompt(server);
  return server;
}

export async function runStdioServer(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error('[gitpin] MCP server ready (stdio) - 10 read-only pin.* tools (prove/verify product loop)');
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
