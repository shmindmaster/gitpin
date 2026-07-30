import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import simpleGit, { type SimpleGit } from 'simple-git';
import { isAlwaysSensitivePath } from './policy';
import { resolveRepoPath } from './registry';

export const SKIP_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.cache',
  '.venv',
  '__pycache__',
  'build',
  'coverage',
  'dist',
  'generated',
  'node_modules',
  'playwright-report',
  'test-results',
  '_private',
]);

export const SEARCH_GLOBS = [
  '*.md',
  '*.mdx',
  '*.rst',
  '*.adoc',
  '*.txt',
  '*.json',
  '*.yaml',
  '*.yml',
  '*.toml',
  '*.ts',
  '*.tsx',
  '*.js',
  '*.jsx',
  '*.py',
  '*.go',
  '*.rs',
  '*.java',
  '*.cs',
  '*.ps1',
  '*.sh',
];

export interface SnapshotComponent {
  relativePath: string;
  branch: string | null;
  commitSha: string;
  dirtyEntriesExcluded: number;
}

export interface SnapshotMetadata {
  generatedAt: string;
  sourceRoot: string;
  components: SnapshotComponent[];
  unversionedDocuments: Array<{ sourcePath: string; sha256: string }>;
}

export interface GitComponent {
  relativePath: string;
  path: string;
  git: SimpleGit;
}

export function snapshotMetadata(root: string): SnapshotMetadata | null {
  for (const relative of ['.gitpin/snapshot.json', '.repocontext/snapshot.json']) {
    const path = join(root, ...relative.split('/'));
    if (!existsSync(path)) continue;
    return JSON.parse(readFileSync(path, 'utf-8')) as SnapshotMetadata;
  }
  return null;
}

export function gitComponents(name: string): GitComponent[] {
  const root = resolveRepoPath(name);
  return discoverGitRoots(root).map((path) => ({
    relativePath: normalizeRelative(relative(root, path)) || '.',
    path,
    git: simpleGit(path),
  }));
}

export function gitHeadSha(component: GitComponent): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: component.path,
    encoding: 'utf-8',
    windowsHide: true,
  }).trim();
}

export function gitHeadPaths(component: GitComponent): string[] {
  const output = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', 'HEAD'], {
    cwd: component.path,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  return output.split('\0').filter(Boolean);
}

export function readGitPackageManifest(
  component: GitComponent,
  sourcePath: string,
): { name?: string; version?: string; scripts: string[] } | null {
  try {
    const raw = execFileSync('git', ['show', `HEAD:${sourcePath}`], {
      cwd: component.path,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    const value = JSON.parse(raw) as { name?: string; version?: string; scripts?: Record<string, unknown> };
    return {
      name: value.name,
      version: value.version,
      scripts: Object.keys(value.scripts ?? {}),
    };
  } catch {
    return null;
  }
}

export function readPackageManifest(
  root: string,
  sourcePath: string,
): { name?: string; version?: string; scripts: string[] } | null {
  const path = join(root, sourcePath);
  if (!existsSync(path)) return null;
  try {
    const value = JSON.parse(readFileSync(path, 'utf-8')) as {
      name?: string;
      version?: string;
      scripts?: Record<string, unknown>;
    };
    return {
      name: value.name,
      version: value.version,
      scripts: Object.keys(value.scripts ?? {}),
    };
  } catch {
    return null;
  }
}

export function testDirectoriesForPath(path: string, names: Set<string>): string[] {
  const parts = normalizeRelative(path).split('/');
  const directories: string[] = [];
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (names.has(parts[index])) directories.push(parts.slice(0, index + 1).join('/'));
  }
  return directories;
}

export function findFiles(root: string, predicate: (path: string) => boolean, limit: number): string[] {
  const found: string[] = [];
  walk(root, (path, isDirectory) => {
    if (!isDirectory && predicate(path)) found.push(path);
    return found.length < limit;
  });
  return found;
}

export function assertWithinRoot(root: string, full: string, sourcePath: string): void {
  if (!isWithin(root, full)) throw new Error(`Path traversal blocked: ${sourcePath}`);
  // Existing paths must stay inside the repository after symlink resolution.
  if (!existsSync(full)) return;
  try {
    const rootReal = realpathSync.native(root);
    const fullReal = realpathSync.native(full);
    if (!isWithin(rootReal, fullReal)) throw new Error(`Path traversal blocked: ${sourcePath}`);
  } catch (error) {
    if (error instanceof Error && /Path traversal blocked/u.test(error.message)) throw error;
    throw new Error(`Path traversal blocked: ${sourcePath}`);
  }
}

export function isWithin(root: string, full: string): boolean {
  const rootNormalized = resolve(root).toLowerCase();
  const fullNormalized = resolve(full).toLowerCase();
  return (
    fullNormalized === rootNormalized ||
    fullNormalized.startsWith(`${rootNormalized}\\`) ||
    fullNormalized.startsWith(`${rootNormalized}/`)
  );
}

export function isSensitivePath(path: string): boolean {
  return isAlwaysSensitivePath(path);
}

export function normalizeRelative(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function discoverGitRoots(root: string): string[] {
  if (existsSync(join(root, '.git'))) return [root];
  const roots: string[] = [];
  const walkDirectory = (directory: string, depth: number): void => {
    if (depth > 5) return;
    for (const item of safeReadDirectory(directory)) {
      const full = join(directory, item);
      let isDirectory = false;
      try {
        const entry = lstatSync(full);
        if (entry.isSymbolicLink()) continue;
        isDirectory = entry.isDirectory();
      } catch {
        continue;
      }
      if (!isDirectory || SKIP_DIRECTORIES.has(item) || item.startsWith('.')) continue;
      if (existsSync(join(full, '.git'))) roots.push(full);
      else walkDirectory(full, depth + 1);
    }
  };
  walkDirectory(root, 0);
  return roots;
}

function walk(root: string, visitor: (path: string, isDirectory: boolean) => boolean): void {
  const visit = (directory: string, depth: number): void => {
    if (depth > 8) return;
    for (const item of safeReadDirectory(directory)) {
      const full = join(directory, item);
      let isDirectory = false;
      try {
        const entry = lstatSync(full);
        // Never follow directory symlinks when scanning repository trees.
        if (entry.isSymbolicLink()) continue;
        isDirectory = entry.isDirectory();
      } catch {
        continue;
      }
      if (isDirectory && (SKIP_DIRECTORIES.has(item) || item.startsWith('.'))) continue;
      if (!visitor(full, isDirectory)) return;
      if (isDirectory) visit(full, depth + 1);
    }
  };
  visit(root, 0);
}

function safeReadDirectory(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}
