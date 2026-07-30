import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BRIEF_AUDIENCES, getContextBrief } from './context-brief';
import {
  asCodeCandidateHits,
  asCandidateHits,
  asPinnedSlice,
  buildEvidencePack,
  buildEvidenceSet,
  PRODUCT_CONTRACT,
  verifyEvidenceClaim,
  verifyEvidenceSet,
} from './evidence';
import {
  compareRepoCommits,
  getRepoCommits,
  getRepoFile,
  getRepoManifest,
  getRepoRecentChanges,
  getRepoStatus,
  getRepoTests,
  searchRepoCode,
} from './git';
import { getCatalog, getDocGaps, getDocs, searchDocs } from './wiki';

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] });
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const HEX_SHA = /^[0-9a-f]{7,40}$/iu;

const proveItemSchema = z.object({
  repository: z.string(),
  sourcePath: z.string(),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
  claim: z.string().min(1).max(500).optional(),
});

const verifyItemSchema = z.object({
  repository: z.string(),
  sourcePath: z.string(),
  sha: z.string().regex(HEX_SHA),
  line: z.number().int().positive().optional(),
  mustContain: z.string().min(1).max(500).optional(),
});

export function registerPinTools(server: McpServer): void {
  server.registerTool(
    'pin.catalog',
    {
      annotations: READ_ONLY,
      description:
        'Call first to discover registered Git roots (HEAD SHAs, doc counts, stale). Not a content claim. Use before search/prove.',
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

  server.registerTool(
    'pin.search_docs',
    {
      annotations: READ_ONLY,
      description:
        'Find documentation candidates (not claims). Before any factual assertion call pin.prove or pin.prove_set, then pin.verify.',
      inputSchema: z.object({ query: z.string().min(1).max(200), repository: z.string().optional() }),
    },
    async ({ query, repository }) => json(asCandidateHits(await searchDocs(query, repository), query)),
  );

  server.registerTool(
    'pin.search_code',
    {
      annotations: READ_ONLY,
      description:
        'Find code candidates via git grep at HEAD. Never treat hits as final claims—pin.prove then pin.verify (or prove_set/verify_set).',
      inputSchema: z.object({ repository: z.string(), query: z.string().min(1).max(200) }),
    },
    async ({ repository, query }) =>
      json(asCodeCandidateHits(repository, query, await searchRepoCode(repository, query))),
  );

  server.registerTool(
    'pin.prove',
    {
      annotations: READ_ONLY,
      description:
        'Primary product tool: one-path evidence pack (slice, path, line, full SHA, content hash, handle, verify next-step). Prefer for every factual claim.',
      inputSchema: proveItemSchema,
    },
    async (input) => json(await buildEvidencePack(input)),
  );

  server.registerTool(
    'pin.prove_set',
    {
      annotations: READ_ONLY,
      description:
        'Multi-cite evidence set (1–8 paths, multi-repo OK). Use when an answer needs several citations. Next: pin.verify_set.',
      inputSchema: z.object({ items: z.array(proveItemSchema).min(1).max(8) }),
    },
    async ({ items }) => json(await buildEvidenceSet(items)),
  );

  server.registerTool(
    'pin.get_doc',
    {
      annotations: READ_ONLY,
      description:
        'Read one committed documentation page as a pinned evidence slice with full SHA. Prefer pin.prove for claims.',
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
        'Read a HEAD-only source slice (path, lines, full SHA). Sensitive paths blocked. Prefer pin.prove when making a claim.',
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

  server.registerTool(
    'pin.verify',
    {
      annotations: READ_ONLY,
      description:
        'Close the prove loop: re-check path@SHA with git show; optional mustContain for claim-text. Reports HEAD match and claimVerdict.',
      inputSchema: verifyItemSchema,
    },
    async (input) => json(await verifyEvidenceClaim(input)),
  );

  server.registerTool(
    'pin.verify_set',
    {
      annotations: READ_ONLY,
      description:
        'Batch re-check up to 8 citations (from pin.prove_set or a pack). For multi-repo answers and CI citation gates.',
      inputSchema: z.object({
        items: z.array(verifyItemSchema).min(1).max(8),
        evidenceSetId: z.string().min(1).max(64).optional(),
      }),
    },
    async (input) => json(await verifyEvidenceSet(input)),
  );

  server.registerTool(
    'pin.analyze',
    {
      annotations: READ_ONLY,
      description:
        'EvidenceBrief (knownFacts/gaps/evidenceSetId), documentation gaps, or coverage compare. Decision evidence—not a dump.',
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
        'Inspect HEAD-pinned status, commits, manifests, tests, or recent changes. status shows dirty work excluded from evidence.',
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
}
