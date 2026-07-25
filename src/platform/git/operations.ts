/**
 * Git operations: read files, search code, compare commits, inspect status.
 * All operations are read-only and commit-pinned.
 * Uses simple-git for safe, structured git access.
 */

import simpleGit, { SimpleGit } from 'simple-git';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { resolveRepoPath } from '../config/registry';

function getGit(repoName: string): SimpleGit {
  const repoPath = resolveRepoPath(repoName);
  if (!existsSync(join(repoPath, '.git'))) {
    throw new Error(`Repository "${repoName}" at ${repoPath} is not a git repository.`);
  }
  return simpleGit(repoPath);
}

// ─── repo.inspect: status ────────────────────────────────────────

export async function getRepoStatus(repoName: string): Promise<Record<string, unknown>> {
  const git = getGit(repoName);
  const status = await git.status();
  const log = await git.log({ maxCount: 1 });
  return {
    repository: repoName,
    path: resolveRepoPath(repoName),
    branch: status.current,
    isClean: status.isClean(),
    modified: status.modified,
    staged: status.staged,
    untracked: status.not_added,
    latestCommit: log.latest ? {
      hash: log.latest.hash,
      message: log.latest.message,
      author: log.latest.author_name,
      date: log.latest.date,
    } : null,
  };
}

// ─── repo.inspect: commits ───────────────────────────────────────

export async function getRepoCommits(repoName: string, limit = 10): Promise<unknown[]> {
  const git = getGit(repoName);
  const log = await git.log({ maxCount: limit });
  return log.all.map((commit) => ({
    hash: commit.hash,
    abbreviated: commit.hash.slice(0, 7),
    message: commit.message,
    author: commit.author_name,
    date: commit.date,
  }));
}

// ─── repo.inspect: manifest ──────────────────────────────────────

export async function getRepoManifest(repoName: string): Promise<Record<string, unknown>> {
  const repoPath = resolveRepoPath(repoName);
  const result: Record<string, unknown> = { repository: repoName };

  // package.json
  const pkgPath = join(repoPath, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    result.packageJson = {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
      dependencies: pkg.dependencies ? Object.keys(pkg.dependencies).length : 0,
      devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies).length : 0,
    };
  }

  // pyproject.toml
  const pyPath = join(repoPath, 'pyproject.toml');
  if (existsSync(pyPath)) {
    result.pyproject = { exists: true, path: 'pyproject.toml' };
  }

  // Check for key files
  result.hasReadme = existsSync(join(repoPath, 'README.md'));
  result.hasAgentsMd = existsSync(join(repoPath, 'AGENTS.md'));
  result.hasCI = existsSync(join(repoPath, '.github', 'workflows'));
  result.hasDockerfile = existsSync(join(repoPath, 'Dockerfile'));
  result.hasWikiYaml = existsSync(join(repoPath, '.repocontext', 'wiki.yaml')) || existsSync(join(repoPath, 'docs', 'wiki.yaml'));

  return result;
}

// ─── repo.inspect: tests ─────────────────────────────────────────

export async function getRepoTests(repoName: string): Promise<Record<string, unknown>> {
  const repoPath = resolveRepoPath(repoName);
  const testDirs = ['tests', 'test', '__tests__', 'spec'];
  const foundTests: string[] = [];

  for (const dir of testDirs) {
    const fullPath = join(repoPath, dir);
    if (existsSync(fullPath)) foundTests.push(dir);
  }

  // Check for common test config files
  const testConfigs = ['vitest.config.ts', 'jest.config.ts', 'jest.config.js', 'pytest.ini', 'setup.cfg'];
  const foundConfigs = testConfigs.filter((c) => existsSync(join(repoPath, c)));

  return {
    repository: repoName,
    testDirectories: foundTests,
    testConfigFiles: foundConfigs,
    hasTests: foundTests.length > 0,
  };
}

// ─── repo.inspect: recent changes ────────────────────────────────

export async function getRepoRecentChanges(repoName: string, limit = 10): Promise<unknown[]> {
  const git = getGit(repoName);
  const log = await git.log({ maxCount: limit });
  const changes: unknown[] = [];

  for (const commit of log.all) {
    try {
      const diff = await git.diff(['--name-only', '--no-renames', `${commit.hash}^`, commit.hash]);
      changes.push({
        hash: commit.hash.slice(0, 7),
        message: commit.message,
        date: commit.date,
        filesChanged: diff.split('\n').filter(Boolean),
      });
    } catch {
      changes.push({
        hash: commit.hash.slice(0, 7),
        message: commit.message,
        date: commit.date,
        filesChanged: ['(unable to diff)'],
      });
    }
  }
  return changes;
}

// ─── repo.read ───────────────────────────────────────────────────

export async function getRepoFile(
  repoName: string,
  sourcePath: string,
  lineStart?: number,
  lineEnd?: number,
): Promise<Record<string, unknown>> {
  const repoPath = resolveRepoPath(repoName);
  const fullPath = resolve(repoPath, sourcePath);

  // Safety: don't allow path traversal
  if (!fullPath.startsWith(repoPath)) {
    throw new Error(`Path traversal detected: ${sourcePath} resolves outside the repository.`);
  }

  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${sourcePath} in ${repoName}`);
  }

  // Block sensitive files
  const sensitivePatterns = ['.env', '.secret', 'credentials', '.key', '.pem', 'token'];
  const fileName = sourcePath.toLowerCase();
  if (sensitivePatterns.some((p) => fileName.includes(p))) {
    return {
      repository: repoName,
      sourcePath,
      blocked: true,
      reason: 'File matches sensitive-content pattern and is blocked for safety.',
    };
  }

  const content = readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');

  const effectiveStart = Math.max(1, lineStart ?? 1);
  const effectiveEnd = Math.min(lines.length, lineEnd ?? lines.length);
  const slice = lines.slice(effectiveStart - 1, effectiveEnd);

  // Get the commit this file was last modified in
  const git = getGit(repoName);
  let commitSha = 'unknown';
  try {
    const log = await git.log({ file: sourcePath, maxCount: 1 });
    if (log.latest) commitSha = log.latest.hash;
  } catch {
    // Ignore — file might be new/untracked
  }

  return {
    repository: repoName,
    sourcePath,
    commitSha,
    totalLines: lines.length,
    range: { start: effectiveStart, end: effectiveEnd },
    content: slice.map((line, i) => `${effectiveStart + i}: ${line}`).join('\n'),
  };
}

// ─── repo.search ─────────────────────────────────────────────────

export async function searchRepoCode(repoName: string, query: string): Promise<unknown[]> {
  const repoPath = resolveRepoPath(repoName);

  // Use git grep for safe, repo-bounded search
  try {
    const output = execSync(
      `git grep -n -i --max-count=50 ${escapeShellArg(query)} -- "*.ts" "*.tsx" "*.js" "*.jsx" "*.py" "*.md" "*.yaml" "*.yml" "*.json" "*.toml"`,
      { cwd: repoPath, encoding: 'utf-8', maxBuffer: 1024 * 1024, timeout: 10_000 },
    );

    return output
      .split('\n')
      .filter(Boolean)
      .slice(0, 50)
      .map((line) => {
        const [file, lineNum, ...rest] = line.split(':');
        return {
          file,
          line: parseInt(lineNum, 10) || 0,
          content: rest.join(':').trim(),
        };
      });
  } catch {
    return [{ error: 'No matches found or search failed.' }];
  }
}

// ─── repo.compare ────────────────────────────────────────────────

export async function compareRepoCommits(
  repoName: string,
  base: string,
  head: string,
): Promise<Record<string, unknown>> {
  const git = getGit(repoName);

  try {
    const diff = await git.diff(['--name-status', '--no-renames', base, head]);
    const statLog = await git.log({ from: base, to: head });

    const files = diff
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [status, ...pathParts] = line.split('\t');
        return {
          status: status.trim(), // A=added, M=modified, D=deleted
          path: pathParts.join('\t'),
        };
      });

    return {
      repository: repoName,
      base,
      head,
      commitsBetween: statLog.total,
      filesChanged: files.length,
      files,
    };
  } catch (error) {
    return {
      repository: repoName,
      base,
      head,
      error: error instanceof Error ? error.message : 'Comparison failed',
    };
  }
}

function escapeShellArg(arg: string): string {
  // Simple escaping for git grep
  return `"${arg.replace(/"/g, '\\"')}"`;
}
