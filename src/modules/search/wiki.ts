/**
 * Wiki / document discovery and search across all indexed repositories.
 * Reads markdown docs from each repo, respects wiki.yaml exposure config.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { parse } from 'yaml';
import { listRepos, resolveRepoPath } from '../../platform/config/registry';

export interface DocEntry {
  repository: string;
  sourcePath: string;
  title: string;
  body: string;
  commitSha?: string;
  stale?: boolean;
}

export interface CatalogEntry {
  name: string;
  path: string;
  status: 'indexed' | 'missing-wiki' | 'error';
  docCount: number;
  stale: boolean;
  hasReadme: boolean;
  hasWikiYaml: boolean;
  collections: string[];
}

const docCache = new Map<string, DocEntry[]>();
const DOC_EXTENSIONS = new Set(['.md', '.mdx']);
const MAX_DOC_SIZE = 100_000; // 100KB per doc
const MAX_DOCS_PER_REPO = 200;

// ─── Catalog ─────────────────────────────────────────────────────

export async function getCatalog(): Promise<CatalogEntry[]> {
  const repos = listRepos();
  return repos.map((repo) => {
    const repoPath = resolveRepoPath(repo.name);
    const hasWikiYaml = findWikiYaml(repoPath) !== null;
    const hasReadme = existsSync(join(repoPath, 'README.md'));

    let docCount = 0;
    let status: CatalogEntry['status'] = 'indexed';
    let collections: string[] = [];

    try {
      const docs = discoverDocs(repo.name, repoPath);
      docCount = docs.length;
      if (!hasWikiYaml && docCount === 0) status = 'missing-wiki';
    } catch {
      status = 'error';
    }

    return {
      name: repo.name,
      path: repo.path,
      status,
      docCount,
      stale: false, // TODO: compare doc timestamps vs. last commit
      hasReadme,
      hasWikiYaml,
      collections,
    };
  });
}

// ─── Search ──────────────────────────────────────────────────────

export async function searchDocs(query: string, repositoryFilter?: string): Promise<DocEntry[]> {
  const queryLower = query.toLowerCase();
  const results: DocEntry[] = [];

  for (const repo of listRepos()) {
    if (repositoryFilter && repo.name !== repositoryFilter) continue;

    const repoPath = resolveRepoPath(repo.name);
    const docs = discoverDocs(repo.name, repoPath);

    for (const doc of docs) {
      if (doc.body.toLowerCase().includes(queryLower) || doc.title.toLowerCase().includes(queryLower)) {
        results.push(doc);
      }
    }

    if (results.length >= 20) break;
  }

  return results.slice(0, 20).map(({ body, ...meta }) => ({
    ...meta,
    // Include a snippet around the match for context
    body: extractSnippet(body, queryLower, 300),
  }));
}

// ─── Get single doc ──────────────────────────────────────────────

export async function getDocs(repository: string, sourcePath: string): Promise<DocEntry | null> {
  const repoPath = resolveRepoPath(repository);
  const fullPath = join(repoPath, sourcePath);

  if (!existsSync(fullPath)) return null;

  const body = readFileSync(fullPath, 'utf-8');
  const title = extractTitle(body) ?? sourcePath;

  return {
    repository,
    sourcePath,
    title,
    body,
    commitSha: undefined, // TODO: git log for this file
  };
}

// ─── Gap Analysis ────────────────────────────────────────────────

const EXPECTED_DOCS = [
  { path: 'README.md', label: 'README' },
  { path: 'docs/architecture.md', label: 'Architecture' },
  { path: 'docs/api/', label: 'API Docs' },
  { path: 'docs/development.md', label: 'Dev Guide' },
  { path: 'AGENTS.md', label: 'Agent Instructions' },
];

export async function getDocGaps(
  operation: 'gaps' | 'compare',
  repositories?: string[],
): Promise<unknown> {
  const repos = listRepos().filter((r) => !repositories?.length || repositories.includes(r.name));
  const results = repos.map((repo) => {
    const repoPath = resolveRepoPath(repo.name);
    const gaps: string[] = [];
    const present: string[] = [];

    for (const expected of EXPECTED_DOCS) {
      const fullPath = join(repoPath, expected.path);
      if (existsSync(fullPath)) {
        present.push(expected.label);
      } else {
        gaps.push(expected.label);
      }
    }

    return {
      repository: repo.name,
      present,
      gaps,
      coverage: `${present.length}/${EXPECTED_DOCS.length}`,
      needsAttention: gaps.length > 0,
    };
  });

  if (operation === 'compare') {
    const labels = EXPECTED_DOCS.map((d) => d.label);
    return {
      repositories: results.map((r) => r.repository),
      categories: labels,
      matrix: results.map((r) => ({
        repository: r.repository,
        ...Object.fromEntries(EXPECTED_DOCS.map((d) => [d.label, r.present.includes(d.label) ? '✅' : '❌'])),
      })),
    };
  }

  return results;
}

// ─── Internal: Discover docs in a repo ──────────────────────────

function discoverDocs(repoName: string, repoPath: string): DocEntry[] {
  if (docCache.has(repoName)) return docCache.get(repoName)!;

  const wikiYaml = findWikiYaml(repoPath);
  const exposure = wikiYaml ? parseWikiYaml(wikiYaml) : { expose: ['README.md', 'docs/'], exclude: [] };
  const docs: DocEntry[] = [];

  walkDir(repoPath, repoPath, exposure, repoName, docs);
  docCache.set(repoName, docs);
  return docs;
}

function walkDir(
  base: string,
  dir: string,
  exposure: { expose: string[]; exclude: string[] },
  repoName: string,
  results: DocEntry[],
): void {
  if (results.length >= MAX_DOCS_PER_REPO) return;

  const alwaysExclude = ['node_modules', '.git', 'dist', '.next', '.cache', '__pycache__', '.venv', 'coverage'];
  const dirName = dir.split(/[/\\]/).pop() ?? '';

  if (alwaysExclude.includes(dirName) || dirName.startsWith('.')) return;

  if (!existsSync(dir)) return;

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relPath = relative(base, fullPath).replace(/\\/g, '/');

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          // Check if this directory is excluded
          if (exposure.exclude.some((e) => relPath.startsWith(e.replace(/\/$/, '')))) continue;
          walkDir(base, fullPath, exposure, repoName, results);
        } else if (stat.isFile() && DOC_EXTENSIONS.has(extname(entry).toLowerCase())) {
          if (stat.size > MAX_DOC_SIZE) continue;
          // Check exposure rules
          if (!isExposed(relPath, exposure)) continue;

          const body = readFileSync(fullPath, 'utf-8');
          results.push({
            repository: repoName,
            sourcePath: relPath,
            title: extractTitle(body) ?? entry,
            body,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Skip unreadable directories
  }
}

function isExposed(relPath: string, exposure: { expose: string[]; exclude: string[] }): boolean {
  // If excluded, skip
  if (exposure.exclude.some((e) => relPath.startsWith(e.replace(/\/$/, '').replace(/\*\*\/?/, '')))) return false;
  // If expose list is empty, default to README + docs/
  if (exposure.expose.length === 0) return relPath === 'README.md' || relPath.startsWith('docs/');
  // Check if path matches any expose pattern
  return exposure.expose.some((pattern: string) => {
    const cleanPattern = pattern.replace(/\/\*\*$/, '').replace(/\*\*/, '');
    return relPath.startsWith(cleanPattern) || relPath === cleanPattern;
  });
}

function findWikiYaml(repoPath: string): string | null {
  const candidates = [
    join(repoPath, '.repocontext', 'wiki.yaml'),
    join(repoPath, 'docs', 'wiki.yaml'),
    join(repoPath, 'wiki.yaml'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function parseWikiYaml(wikiYamlPath: string): { expose: string[]; exclude: string[] } {
  try {
    const raw = readFileSync(wikiYamlPath, 'utf-8');
    const parsed = parse(raw);
    return {
      expose: parsed?.expose?.map((e: { path: string } | string) => typeof e === 'string' ? e : e.path) ?? [],
      exclude: parsed?.exclude?.map((e: { path: string } | string) => typeof e === 'string' ? e : e.path) ?? [],
    };
  } catch {
    return { expose: [], exclude: [] };
  }
}

function extractTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function extractSnippet(body: string, queryLower: string, contextChars: number): string {
  const idx = body.toLowerCase().indexOf(queryLower);
  if (idx === -1) return body.slice(0, contextChars) + '…';
  const start = Math.max(0, idx - contextChars / 2);
  const end = Math.min(body.length, idx + queryLower.length + contextChars / 2);
  return (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '');
}
