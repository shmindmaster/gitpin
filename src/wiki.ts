/**
 * Commit-pinned documentation catalog, page reads, and gap analysis.
 * Search and index implementations live in focused sibling modules.
 */
import { readPinnedFile } from './git';
import { getContextBrief } from './context-brief';
import { EXPECTED_DOCUMENTS, getDocumentationRows } from './documentation-analysis';
import { loadRegistry } from './registry';
import { documentIndex, MAX_DOCUMENT_BYTES, normalizePath } from './wiki-index';

export { searchDocs } from './wiki-search';
export type { DocSearchHit } from './wiki-search';

export interface CatalogEntry {
  name: string;
  status: 'indexed' | 'empty' | 'unavailable';
  docCount: number;
  stale: boolean;
  hasReadme: boolean;
  hasWikiYaml: boolean;
  commitSha: string | null;
  confidence: 'direct-source' | 'snapshot' | 'unavailable';
  message?: string;
}

export interface DocumentPage {
  repository: string;
  sourcePath: string;
  title: string;
  body: string;
  commitSha: string | null;
  confidence: 'direct-source' | 'snapshot';
  snapshotGeneratedAt?: string;
}

export function clearWikiCache(): void {
  // Retained as a harmless test helper. GitPin deliberately keeps no cache.
}

export async function getCatalog(): Promise<CatalogEntry[]> {
  return loadRegistry().map((repository) => {
    try {
      const index = documentIndex(repository);
      return {
        name: repository.name,
        status: index.paths.length > 0 ? 'indexed' : 'empty',
        docCount: index.paths.length,
        stale: index.stale,
        hasReadme: index.paths.includes('README.md'),
        hasWikiYaml: index.hasWikiYaml,
        commitSha: index.commitSha,
        confidence: index.confidence,
      };
    } catch (error) {
      return {
        name: repository.name,
        status: 'unavailable',
        docCount: 0,
        stale: false,
        hasReadme: false,
        hasWikiYaml: false,
        commitSha: null,
        confidence: 'unavailable',
        message: error instanceof Error ? error.message : 'Repository could not be indexed.',
      };
    }
  });
}

export async function getDocs(repositoryName: string, sourcePath: string): Promise<DocumentPage | null> {
  const repository = loadRegistry().find((entry) => entry.name === repositoryName);
  if (!repository) return null;

  const index = documentIndex(repository);
  if (!index.paths.includes(normalizePath(sourcePath))) return null;

  try {
    const pinned = readPinnedFile(repositoryName, sourcePath);
    if (Buffer.byteLength(pinned.body, 'utf-8') > MAX_DOCUMENT_BYTES) return null;
    return {
      repository: repositoryName,
      sourcePath,
      title: pinned.body.match(/^#\s+(.+)$/m)?.[1] ?? sourcePath.split('/').pop() ?? sourcePath,
      body: pinned.body,
      commitSha: typeof pinned.provenance.commitSha === 'string' ? pinned.provenance.commitSha : null,
      confidence: index.confidence,
      ...(typeof pinned.provenance.snapshotGeneratedAt === 'string'
        ? { snapshotGeneratedAt: pinned.provenance.snapshotGeneratedAt }
        : {}),
    };
  } catch {
    return null;
  }
}

export async function getDocGaps(operation: 'gaps' | 'compare' | 'brief', repositories?: string[]) {
  if (operation === 'brief') return getContextBrief({ repositories });
  const rows = getDocumentationRows(repositories).map(({ sourcePaths: _, ...row }) => row);
  if (operation === 'compare') {
    return {
      categories: EXPECTED_DOCUMENTS.map((expected) => expected.label),
      rows,
    };
  }
  return rows;
}
