/**
 * Wiki: document discovery, cross-repo search, and gap analysis.
 * Reads markdown from each repo, respects wiki.yaml exposure config.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { parse } from 'yaml';
import { loadRegistry } from './registry';

interface Doc { repository: string; sourcePath: string; title: string; body: string; }
interface Expose { expose: string[]; exclude: string[]; }

const DOC_EXT = new Set(['.md', '.mdx']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.cache', '__pycache__', '.venv', 'coverage', 'generated']);
const MAX_SIZE = 100_000;
const MAX_DOCS = 200;
const cache = new Map<string, Doc[]>();

export async function getCatalog() {
  return loadRegistry().map((repo) => {
    const p = repo.path;
    const docs = discover(repo.name, p);
    return { name: repo.name, path: repo.path, status: docs.length > 0 ? 'indexed' : 'empty', docCount: docs.length, stale: false, hasReadme: existsSync(join(p, 'README.md')), hasWikiYaml: findWikiYaml(p) !== null };
  });
}

export async function searchDocs(query: string, repositoryFilter?: string): Promise<Doc[]> {
  const q = query.toLowerCase();
  const results: Doc[] = [];
  for (const repo of loadRegistry()) {
    if (repositoryFilter && repo.name !== repositoryFilter) continue;
    for (const doc of discover(repo.name, repo.path)) {
      if (doc.body.toLowerCase().includes(q) || doc.title.toLowerCase().includes(q)) {
        results.push(doc);
        if (results.length >= 20) return results;
      }
    }
  }
  return results;
}

export async function getDocs(repository: string, sourcePath: string): Promise<Doc | null> {
  const repo = loadRegistry().find((r) => r.name === repository);
  if (!repo) return null;
  const full = join(repo.path, sourcePath);
  if (!existsSync(full)) return null;
  const body = readFileSync(full, 'utf-8');
  return { repository, sourcePath, title: body.match(/^#\s+(.+)$/m)?.[1] ?? sourcePath, body };
}

const EXPECTED = [
  { path: 'README.md', label: 'README' },
  { path: 'docs/architecture.md', label: 'Architecture' },
  { path: 'AGENTS.md', label: 'Agent Instructions' },
  { path: 'docs/development.md', label: 'Dev Guide' },
];

export async function getDocGaps(operation: 'gaps' | 'compare', repositories?: string[]) {
  const repos = loadRegistry().filter((r) => !repositories?.length || repositories.includes(r.name));
  const results = repos.map((repo) => {
    const present: string[] = [];
    const gaps: string[] = [];
    for (const exp of EXPECTED) {
      if (existsSync(join(repo.path, exp.path))) present.push(exp.label);
      else gaps.push(exp.label);
    }
    return { repository: repo.name, present, gaps, coverage: `${present.length}/${EXPECTED.length}` };
  });
  if (operation === 'compare') return { repositories: results.map((r) => r.repository), categories: EXPECTED.map((e) => e.label), rows: results };
  return results;
}

// --- internals ---

function discover(name: string, repoPath: string): Doc[] {
  if (cache.has(name)) return cache.get(name)!;
  const yamlPath = findWikiYaml(repoPath);
  const exposure: Expose = yamlPath ? parseExposure(yamlPath) : { expose: ['README.md', 'docs/'], exclude: [] };
  const docs: Doc[] = [];
  walk(repoPath, repoPath, exposure, name, docs);
  cache.set(name, docs);
  return docs;
}

function walk(base: string, dir: string, exp: Expose, repoName: string, out: Doc[]): void {
  if (out.length >= MAX_DOCS) return;
  const name = dir.split(/[/\\]/).pop() ?? '';
  if (SKIP_DIRS.has(name) || (name.startsWith('.') && name !== '.')) return;
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = relative(base, full).replace(/\\/g, '/');
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          if (exp.exclude.some((e) => rel.startsWith(e))) continue;
          walk(base, full, exp, repoName, out);
        } else if (stat.isFile() && DOC_EXT.has(extname(entry).toLowerCase()) && stat.size <= MAX_SIZE) {
          if (!isExposed(rel, exp)) continue;
          const body = readFileSync(full, 'utf-8');
          out.push({ repository: repoName, sourcePath: rel, title: body.match(/^#\s+(.+)$/m)?.[1] ?? entry, body });
        }
      } catch { /* skip unreadable */ }
    }
  } catch { /* skip unreadable dir */ }
}

function isExposed(rel: string, exp: Expose): boolean {
  if (exp.exclude.some((e) => rel.startsWith(e))) return false;
  if (exp.expose.length === 0) return rel === 'README.md' || rel.startsWith('docs/');
  return exp.expose.some((pattern) => { const clean = pattern.replace(/\/\*\*$/, '').replace(/\*\*/, ''); return rel.startsWith(clean) || rel === clean; });
}

function findWikiYaml(repoPath: string): string | null {
  for (const c of [join(repoPath, '.repocontext', 'wiki.yaml'), join(repoPath, 'docs', 'wiki.yaml'), join(repoPath, 'wiki.yaml')]) {
    if (existsSync(c)) return c;
  }
  return null;
}

function parseExposure(path: string): Expose {
  try {
    const parsed = parse(readFileSync(path, 'utf-8'));
    return { expose: (parsed?.expose ?? []).map((e: any) => typeof e === 'string' ? e : e.path), exclude: (parsed?.exclude ?? []).map((e: any) => typeof e === 'string' ? e : e.path) };
  } catch { return { expose: [], exclude: [] }; }
}
