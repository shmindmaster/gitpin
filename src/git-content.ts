import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { resolveRepoPath } from './registry';
import {
  assertWithinRoot,
  gitComponents,
  gitHeadSha,
  isSensitivePath,
  isWithin,
  normalizeRelative,
  SEARCH_GLOBS,
  sha256,
  SKIP_DIRECTORIES,
  snapshotMetadata,
  type SnapshotMetadata,
} from './git-shared';

interface RepoFileResult {
  repository: string;
  sourcePath: string;
  commitSha: string | null;
  component?: string;
  snapshotGeneratedAt?: string;
  contentSha256?: string;
  provenance?: string;
  blocked?: boolean;
  reason?: string;
  totalLines?: number;
  range?: { start: number; end: number };
  content?: string;
}

interface SearchResult {
  component: string;
  sourcePath: string;
  line: number;
  snippet: string;
  commitSha: string | null;
}

export async function getRepoFile(
  name: string,
  sourcePath: string,
  lineStart?: number,
  lineEnd?: number,
): Promise<RepoFileResult> {
  const repoPath = resolve(resolveRepoPath(name));
  const full = resolve(repoPath, sourcePath);
  assertWithinRoot(repoPath, full, sourcePath);
  if (isSensitivePath(sourcePath)) {
    return {
      repository: name,
      sourcePath,
      commitSha: null,
      blocked: true,
      reason: 'Matches sensitive-file pattern.',
    };
  }

  const pinned = readPinnedFile(name, sourcePath);
  const lines = pinned.body.split('\n');
  const start = Math.max(1, lineStart ?? 1);
  const end = Math.min(lines.length, lineEnd ?? lines.length);
  return {
    repository: name,
    sourcePath,
    ...pinned.provenance,
    totalLines: lines.length,
    range: { start, end },
    content: lines
      .slice(start - 1, end)
      .map((line, index) => `${start + index}: ${line}`)
      .join('\n'),
  };
}

export function readPinnedFile(
  name: string,
  sourcePath: string,
): { body: string; provenance: { commitSha: string | null; [key: string]: unknown } } {
  const root = resolve(resolveRepoPath(name));
  const full = resolve(root, sourcePath);
  assertWithinRoot(root, full, sourcePath);
  if (isSensitivePath(sourcePath)) throw new Error(`Sensitive file blocked: ${sourcePath}`);

  const snapshot = snapshotMetadata(root);
  if (snapshot) {
    if (!existsSync(full)) throw new Error(`Not found: ${sourcePath} in ${name}`);
    const body = readFileSync(full, 'utf-8');
    return { body, provenance: snapshotFileProvenance(snapshot, sourcePath, body) };
  }

  const component = gitComponents(name)
    .sort((left, right) => right.path.length - left.path.length)
    .find((candidate) => isWithin(candidate.path, full));
  if (!component) throw new Error(`No Git repository owns ${sourcePath} in ${name}.`);
  const componentPath = normalizeRelative(relative(component.path, full));
  try {
    const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: component.path,
      encoding: 'utf-8',
      windowsHide: true,
    }).trim();
    const body = execFileSync('git', ['show', `${commitSha}:${componentPath}`], {
      cwd: component.path,
      encoding: 'utf-8',
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });
    return {
      body,
      provenance: {
        commitSha,
        component: component.relativePath,
        provenance: 'git-head',
      },
    };
  } catch {
    throw new Error(`Not found at the current Git HEAD: ${sourcePath} in ${name}`);
  }
}

export async function searchRepoCode(name: string, query: string) {
  const root = resolveRepoPath(name);
  const components = gitComponents(name);
  const results: SearchResult[] = [];

  if (components.length > 0 && !snapshotMetadata(root)) {
    for (const component of components) {
      try {
        const args = ['grep', '-n', '-i', '--max-count=50', '-F', query, 'HEAD', '--', ...SEARCH_GLOBS];
        const output = execFileSync('git', args, {
          cwd: component.path,
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024,
          timeout: 10_000,
          windowsHide: true,
        });
        results.push(...parseGitSearchOutput(output, component.relativePath, gitHeadSha(component)));
      } catch {
        // No matches or an unsupported pattern is a normal empty result.
      }
    }
  } else {
    try {
      const args = [
        '-n',
        '-i',
        '-F',
        '--max-count',
        '50',
        ...SEARCH_GLOBS.flatMap((glob) => ['-g', glob]),
        ...[...SKIP_DIRECTORIES].flatMap((directory) => ['-g', `!**/${directory}/**`]),
        '--',
        query,
        '.',
      ];
      const output = execFileSync('rg', args, {
        cwd: root,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024,
        timeout: 10_000,
        windowsHide: true,
      });
      results.push(...parseSnapshotSearchOutput(output, snapshotMetadata(root)));
    } catch {
      // No matches.
    }
  }

  return results.filter((result) => !isSensitivePath(result.sourcePath)).slice(0, 50);
}

function snapshotFileProvenance(
  snapshot: SnapshotMetadata,
  sourcePath: string,
  body: string,
): { commitSha: string | null; [key: string]: unknown } {
  const normalized = normalizeRelative(sourcePath);
  const component = [...snapshot.components]
    .sort((left, right) => right.relativePath.length - left.relativePath.length)
    .find((candidate) => candidate.relativePath === '.' || normalized.startsWith(`${candidate.relativePath}/`));
  if (component) {
    return {
      commitSha: component.commitSha,
      component: component.relativePath,
      snapshotGeneratedAt: snapshot.generatedAt,
    };
  }
  const unversioned = snapshot.unversionedDocuments.find((candidate) => candidate.sourcePath === normalized);
  return {
    commitSha: null,
    contentSha256: unversioned?.sha256 ?? sha256(body),
    provenance: 'unversioned-workspace-document',
    snapshotGeneratedAt: snapshot.generatedAt,
  };
}

function parseGitSearchOutput(output: string, component: string, commitSha: string): SearchResult[] {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) =>
      parseSearchLine(line.startsWith('HEAD:') ? line.slice('HEAD:'.length) : line, component, commitSha),
    );
}

function parseSnapshotSearchOutput(output: string, snapshot: SnapshotMetadata | null): SearchResult[] {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      const match = /^(.+?):(\d+):(.*)$/.exec(line);
      if (!match) return [];
      const sourcePath = normalizeRelative(match[1]);
      const provenance = snapshot ? snapshotFileProvenance(snapshot, sourcePath, '') : { commitSha: null };
      return [
        {
          component: typeof provenance.component === 'string' ? provenance.component : '.',
          sourcePath,
          line: Number.parseInt(match[2], 10),
          snippet: match[3].trim(),
          commitSha: typeof provenance.commitSha === 'string' ? provenance.commitSha : null,
        },
      ];
    });
}

function parseSearchLine(line: string, component: string, commitSha: string): SearchResult[] {
  const match = /^(.+?):(\d+):(.*)$/.exec(line);
  if (!match) return [];
  return [
    {
      component,
      sourcePath: normalizeRelative(match[1]),
      line: Number.parseInt(match[2], 10),
      snippet: match[3].trim(),
      commitSha,
    },
  ];
}
