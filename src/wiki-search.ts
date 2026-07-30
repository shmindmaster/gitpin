import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRegistry, type RepoEntry } from './registry';
import { documentIndex, isGitRepository, normalizePath, type DocumentIndex } from './wiki-index';

const MAX_SEARCH_RESULTS = 20;

export interface DocSearchHit {
  repository: string;
  sourcePath: string;
  line: number;
  snippet: string;
  commitSha: string | null;
  confidence: 'direct-source' | 'snapshot';
}

export async function searchDocs(query: string, repositoryFilter?: string): Promise<DocSearchHit[]> {
  const results: DocSearchHit[] = [];
  for (const repository of loadRegistry()) {
    if (repositoryFilter && repository.name !== repositoryFilter) continue;
    if (results.length >= MAX_SEARCH_RESULTS) break;

    try {
      const index = documentIndex(repository);
      const remaining = MAX_SEARCH_RESULTS - results.length;
      const matches = isGitRepository(repository.path)
        ? searchGitDocuments(repository, index, query, remaining)
        : searchSnapshotDocuments(repository, index, query, remaining);
      results.push(...matches);
    } catch {
      // A missing or unreadable repository is represented by pin.catalog.
    }
  }
  return results;
}

function searchGitDocuments(repository: RepoEntry, index: DocumentIndex, query: string, limit: number): DocSearchHit[] {
  if (index.paths.length === 0) return [];
  try {
    const output = execFileSync('git', ['grep', '-n', '-i', '-F', query, 'HEAD', '--', ...index.paths], {
      cwd: repository.path,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
      timeout: 10_000,
      windowsHide: true,
    });
    return output
      .split(/\r?\n/)
      .flatMap((line) => parseGitSearchLine(line, repository.name, index))
      .slice(0, limit);
  } catch {
    return [];
  }
}

function searchSnapshotDocuments(
  repository: RepoEntry,
  index: DocumentIndex,
  query: string,
  limit: number,
): DocSearchHit[] {
  const lowerQuery = query.toLowerCase();
  const hits: DocSearchHit[] = [];
  for (const sourcePath of index.paths) {
    if (hits.length >= limit) break;
    try {
      const body = readFileSync(join(repository.path, ...sourcePath.split('/')), 'utf-8');
      const lines = body.split(/\r?\n/);
      const line = lines.findIndex((value) => value.toLowerCase().includes(lowerQuery));
      if (line >= 0) {
        hits.push({
          repository: repository.name,
          sourcePath,
          line: line + 1,
          snippet: lines[line].trim(),
          commitSha: index.commitSha,
          confidence: 'snapshot',
        });
      }
    } catch {
      // Ignore a file that cannot be read from an otherwise valid snapshot.
    }
  }
  return hits;
}

function parseGitSearchLine(line: string, repository: string, index: DocumentIndex): DocSearchHit[] {
  if (!line) return [];
  const match = /^(?:HEAD:)?(.+?):(\d+):(.*)$/.exec(line);
  if (!match) return [];
  const sourcePath = normalizePath(match[1]);
  if (!index.paths.includes(sourcePath)) return [];
  return [
    {
      repository,
      sourcePath,
      line: Number.parseInt(match[2], 10),
      snippet: match[3].trim(),
      commitSha: index.commitSha,
      confidence: 'direct-source',
    },
  ];
}
