import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { loadRegistry, type RepoEntry } from './registry';
import { documentIndex } from './wiki-index';

export const EXPECTED_DOCUMENTS = [
  { path: 'README.md', label: 'README' },
  { path: 'docs/architecture.md', label: 'Architecture' },
  { path: 'AGENTS.md', label: 'Agent Instructions' },
  { path: 'docs/development.md', label: 'Dev Guide' },
] as const;

export interface DocumentationRow {
  repository: string;
  docCount: number;
  commitSha: string | null;
  confidence: 'direct-source' | 'snapshot' | 'unavailable';
  stale: boolean;
  present: string[];
  gaps: string[];
  coverage: string;
  sourcePaths: string[];
  emptySourcePaths: string[];
  message?: string;
}

export function getDocumentationRows(repositories?: string[]): DocumentationRow[] {
  const registry = loadRegistry();
  const selected: Array<RepoEntry | string> = repositories?.length
    ? [...new Set(repositories)].map((name) => registry.find((entry) => entry.name === name) ?? name)
    : registry;
  return selected.map((repository) => {
    if (typeof repository === 'string')
      return unavailableRow(repository, `Repository "${repository}" is not registered.`);
    try {
      const index = documentIndex(repository);
      const present: string[] = [];
      const gaps: string[] = [];
      for (const expected of EXPECTED_DOCUMENTS) {
        if (index.paths.includes(expected.path)) present.push(expected.label);
        else gaps.push(expected.label);
      }
      return {
        repository: repository.name,
        docCount: index.paths.length,
        commitSha: index.commitSha,
        confidence: index.confidence,
        stale: index.stale,
        present,
        gaps,
        coverage: `${present.length}/${EXPECTED_DOCUMENTS.length}`,
        sourcePaths: index.paths,
        emptySourcePaths: EXPECTED_DOCUMENTS.filter(
          (expected) =>
            index.paths.includes(expected.path) && !sourceHasContent(repository, index.confidence, expected.path),
        ).map((expected) => expected.path),
      };
    } catch (error) {
      return unavailableRow(
        repository.name,
        error instanceof Error ? error.message : 'Repository could not be analyzed.',
      );
    }
  });
}

function unavailableRow(repository: string, message: string): DocumentationRow {
  return {
    repository,
    docCount: 0,
    commitSha: null,
    confidence: 'unavailable',
    stale: false,
    present: [],
    gaps: EXPECTED_DOCUMENTS.map((expected) => expected.label),
    coverage: `0/${EXPECTED_DOCUMENTS.length}`,
    sourcePaths: [],
    emptySourcePaths: [],
    message,
  };
}

function sourceHasContent(repository: RepoEntry, confidence: DocumentationRow['confidence'], path: string): boolean {
  try {
    if (confidence === 'snapshot') return statSync(join(repository.path, ...path.split('/'))).size > 0;
    return (
      execFileSync('git', ['show', `HEAD:${path}`], {
        cwd: repository.path,
        maxBuffer: 100_001,
        windowsHide: true,
      }).length > 0
    );
  } catch {
    return false;
  }
}
