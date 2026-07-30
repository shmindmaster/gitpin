import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { isDocumentationAllowed, parseExposurePolicy } from './policy';
import type { RepoEntry } from './registry';

const DOCUMENT_EXTENSIONS = new Set(['.md', '.mdx', '.rst', '.adoc', '.txt']);
const MAX_DOCUMENTS_PER_REPOSITORY = 500;
export const MAX_DOCUMENT_BYTES = 100_000;
const POLICY_PATHS = ['.gitpin/wiki.yaml', '.repocontext/wiki.yaml', 'docs/wiki.yaml', 'wiki.yaml'];
const SNAPSHOT_SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.cache',
  '__pycache__',
  '.venv',
  'coverage',
  'generated',
  'playwright-report',
  'test-results',
  '_private',
]);

export interface DocumentIndex {
  paths: string[];
  commitSha: string | null;
  stale: boolean;
  hasWikiYaml: boolean;
  confidence: 'direct-source' | 'snapshot';
}

interface SnapshotMetadata {
  generatedAt: string;
  components: Array<{ relativePath: string; commitSha: string }>;
}

export function documentIndex(repository: RepoEntry): DocumentIndex {
  if (isGitRepository(repository.path)) return gitDocumentIndex(repository);
  const metadata = readSnapshotMetadata(repository.path);
  if (metadata) return snapshotDocumentIndex(repository, metadata);
  throw new Error(`Repository "${repository.name}" is not a Git root or a GitPin snapshot: ${repository.path}`);
}

export function isGitRepository(repositoryPath: string): boolean {
  return existsSync(join(repositoryPath, '.git'));
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function gitDocumentIndex(repository: RepoEntry): DocumentIndex {
  const tracked = gitNullSeparated(repository.path, ['ls-tree', '-r', '--name-only', '-z', 'HEAD']);
  const policyPath = tracked.find((path) => POLICY_PATHS.includes(path));
  const policy = policyPath
    ? parseExposurePolicy(gitText(repository.path, ['show', `HEAD:${policyPath}`]))
    : parseExposurePolicy(null);
  const paths = tracked
    .filter(isDocumentationPath)
    .filter((path) => isDocumentationAllowed(path, policy))
    .slice(0, MAX_DOCUMENTS_PER_REPOSITORY);
  const dirty = gitStatusPaths(repository.path);
  return {
    paths,
    commitSha: gitText(repository.path, ['rev-parse', 'HEAD']),
    stale: dirty.some((path) => paths.includes(path) || path === policyPath),
    hasWikiYaml: Boolean(policyPath),
    confidence: 'direct-source',
  };
}

function snapshotDocumentIndex(repository: RepoEntry, metadata: SnapshotMetadata): DocumentIndex {
  const policyPath = POLICY_PATHS.find((path) => existsSync(join(repository.path, ...path.split('/'))));
  const policy = policyPath
    ? parseExposurePolicy(readFileSync(join(repository.path, ...policyPath.split('/')), 'utf-8'))
    : parseExposurePolicy(null);
  const paths = snapshotPaths(repository.path)
    .filter(isDocumentationPath)
    .filter((path) => isDocumentationAllowed(path, policy))
    .slice(0, MAX_DOCUMENTS_PER_REPOSITORY);
  return {
    paths,
    commitSha:
      metadata.components.find((component) => component.relativePath === '.')?.commitSha ??
      metadata.components[0]?.commitSha ??
      null,
    stale: false,
    hasWikiYaml: Boolean(policyPath),
    confidence: 'snapshot',
  };
}

function isDocumentationPath(path: string): boolean {
  return DOCUMENT_EXTENSIONS.has(extname(path).toLowerCase());
}

function gitText(repositoryPath: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: repositoryPath,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  }).trim();
}

function gitNullSeparated(repositoryPath: string, args: string[]): string[] {
  const output = execFileSync('git', args, {
    cwd: repositoryPath,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  return output.split('\0').filter(Boolean);
}

function gitStatusPaths(repositoryPath: string): string[] {
  const output = execFileSync('git', ['--no-optional-locks', 'status', '--porcelain=v1', '--untracked-files=no'], {
    cwd: repositoryPath,
    encoding: 'utf-8',
    windowsHide: true,
  });
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => normalizePath(line.slice(3).split(' -> ').at(-1) ?? ''));
}

function readSnapshotMetadata(repositoryPath: string): SnapshotMetadata | null {
  for (const relative of ['.gitpin/snapshot.json', '.repocontext/snapshot.json']) {
    const path = join(repositoryPath, ...relative.split('/'));
    if (!existsSync(path)) continue;
    return JSON.parse(readFileSync(path, 'utf-8')) as SnapshotMetadata;
  }
  return null;
}

function snapshotPaths(root: string): string[] {
  const found: string[] = [];
  const visit = (directory: string): void => {
    const directoryName = directory.split(/[/\\]/).pop() ?? '';
    if (SNAPSHOT_SKIP_DIRECTORIES.has(directoryName) || (directoryName.startsWith('.') && directoryName !== '.'))
      return;
    for (const entry of safeReadDirectory(directory)) {
      const full = join(directory, entry);
      try {
        const stat = lstatSync(full);
        // Do not follow symlinks that could escape the snapshot root.
        if (stat.isSymbolicLink()) continue;
        if (stat.isDirectory()) visit(full);
        else if (stat.isFile() && stat.size <= MAX_DOCUMENT_BYTES) found.push(normalizePath(relative(root, full)));
      } catch {
        // Ignore inaccessible paths in an otherwise valid snapshot.
      }
    }
  };
  visit(root);
  return found;
}

function safeReadDirectory(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}
