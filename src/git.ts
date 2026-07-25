/**
 * Git operations: read-only, commit-pinned, safe.
 * Uses simple-git for structured access and git grep for code search.
 */
import simpleGit from 'simple-git';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { resolveRepoPath } from './registry';

const SENSITIVE = ['.env', '.secret', 'credentials', '.key', '.pem', 'token', 'password'];

function git(repo: string) {
  const path = resolveRepoPath(repo);
  if (!existsSync(join(path, '.git'))) throw new Error(`"${repo}" at ${path} is not a git repo.`);
  return simpleGit(path);
}

export async function getRepoStatus(name: string) {
  const g = git(name);
  const status = await g.status();
  const log = await g.log({ maxCount: 1 });
  return { repository: name, branch: status.current, isClean: status.isClean(), modified: status.modified.length, latestCommit: log.latest ? { hash: log.latest.hash, message: log.latest.message, date: log.latest.date } : null };
}

export async function getRepoCommits(name: string, limit = 10) {
  const log = await git(name).log({ maxCount: limit });
  return log.all.map((c) => ({ hash: c.hash, short: c.hash.slice(0, 7), message: c.message, author: c.author_name, date: c.date }));
}

export async function getRepoManifest(name: string) {
  const p = resolveRepoPath(name);
  const result: Record<string, unknown> = { repository: name };
  const pkgPath = join(p, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    result.packageJson = { name: pkg.name, version: pkg.version, scripts: pkg.scripts ? Object.keys(pkg.scripts) : [] };
  }
  result.hasReadme = existsSync(join(p, 'README.md'));
  result.hasAgentsMd = existsSync(join(p, 'AGENTS.md'));
  result.hasCI = existsSync(join(p, '.github', 'workflows'));
  return result;
}

export async function getRepoTests(name: string) {
  const p = resolveRepoPath(name);
  const dirs = ['tests', 'test', '__tests__', 'spec'].filter((d) => existsSync(join(p, d)));
  const configs = ['vitest.config.ts', 'jest.config.ts', 'pytest.ini'].filter((c) => existsSync(join(p, c)));
  return { repository: name, testDirs: dirs, testConfigs: configs, hasTests: dirs.length > 0 || configs.length > 0 };
}

export async function getRepoRecentChanges(name: string, limit = 10) {
  const g = git(name);
  const log = await g.log({ maxCount: limit });
  const changes: Array<{ hash: string; message: string; date: string; files: string[] }> = [];
  for (const c of log.all) {
    try {
      const diff = await g.diff(['--name-only', '--no-renames', `${c.hash}^`, c.hash]);
      changes.push({ hash: c.hash.slice(0, 7), message: c.message, date: c.date, files: diff.split('\n').filter(Boolean) });
    } catch { changes.push({ hash: c.hash.slice(0, 7), message: c.message, date: c.date, files: [] }); }
  }
  return changes;
}

export async function getRepoFile(name: string, sourcePath: string, lineStart?: number, lineEnd?: number) {
  const repoPath = resolve(resolveRepoPath(name));
  const full = resolve(repoPath, sourcePath);
  // Case-insensitive root check for Windows paths
  const fullNorm = full.toLowerCase();
  const rootNorm = repoPath.toLowerCase();
  if (
    fullNorm !== rootNorm &&
    !fullNorm.startsWith(rootNorm + '\\') &&
    !fullNorm.startsWith(rootNorm + '/')
  ) {
    throw new Error(`Path traversal blocked: ${sourcePath}`);
  }
  if (!existsSync(full)) throw new Error(`Not found: ${sourcePath} in ${name}`);
  const lower = sourcePath.toLowerCase();
  if (SENSITIVE.some((s) => lower.includes(s))) {
    return { repository: name, sourcePath, blocked: true, reason: 'Matches sensitive-file pattern.' };
  }

  const lines = readFileSync(full, 'utf-8').split('\n');
  const start = Math.max(1, lineStart ?? 1);
  const end = Math.min(lines.length, lineEnd ?? lines.length);
  let sha = 'unknown';
  try { const log = await git(name).log({ file: sourcePath, maxCount: 1 }); if (log.latest) sha = log.latest.hash; } catch { /* untracked */ }
  return { repository: name, sourcePath, commitSha: sha, totalLines: lines.length, range: { start, end }, content: lines.slice(start - 1, end).map((l, i) => `${start + i}: ${l}`).join('\n') };
}

export async function searchRepoCode(name: string, query: string) {
  const p = resolveRepoPath(name);
  try {
    const out = execSync(`git grep -n -i --max-count=50 "${query.replace(/"/g, '\\"')}" -- "*.ts" "*.tsx" "*.js" "*.py" "*.md" "*.yaml" "*.json"`, { cwd: p, encoding: 'utf-8', maxBuffer: 1024 * 1024, timeout: 10_000 });
    return out.split('\n').filter(Boolean).slice(0, 50).map((line) => { const [file, num, ...rest] = line.split(':'); return { file, line: parseInt(num, 10) || 0, content: rest.join(':').trim() }; });
  } catch { return []; }
}

export async function compareRepoCommits(name: string, base: string, head: string) {
  const g = git(name);
  try {
    const diff = await g.diff(['--name-status', '--no-renames', base, head]);
    const log = await g.log({ from: base, to: head });
    return { repository: name, base, head, commitsBetween: log.total, files: diff.split('\n').filter(Boolean).map((l) => { const [status, ...p] = l.split('\t'); return { status, path: p.join('\t') }; }) };
  } catch (e) { return { repository: name, base, head, error: e instanceof Error ? e.message : 'Comparison failed' }; }
}
