/**
 * Registry: reads repositories.yaml, resolves repo paths.
 * Single source of truth for which repos repocontext indexes.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { parse } from 'yaml';

export type RepoMode = 'auto' | 'workspace' | 'snapshot';

export interface RepoEntry {
  name: string;
  path: string;
  branches: string[];
  mode: RepoMode;
}

let cached: RepoEntry[] | null = null;
let registryOverride: string | null = null;

/** Test/helper: force a registry path and clear the cache. */
export function setRegistryPath(path: string | null): void {
  registryOverride = path;
  cached = null;
}

export function clearRegistryCache(): void {
  cached = null;
}

function findRegistryPath(): string {
  if (registryOverride && existsSync(registryOverride)) return registryOverride;
  const candidates = [
    process.env.REPOCONTEXT_REGISTRY,
    resolve(process.cwd(), 'registry', 'repositories.yaml'),
    resolve(process.cwd(), 'repositories.yaml'),
    join(process.env.HOME ?? process.env.USERPROFILE ?? '', '.repocontext', 'repositories.yaml'),
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error('No RepoContext registry found. Set REPOCONTEXT_REGISTRY or create registry/repositories.yaml.');
}

export function loadRegistry(): RepoEntry[] {
  if (cached) return cached;
  const registryPath = findRegistryPath();
  const raw = readFileSync(registryPath, 'utf-8');
  const parsed = parse(raw) as { repositories?: unknown[] };
  cached = ((parsed.repositories ?? []) as Record<string, unknown>[])
    .map((entry) => ({
      name: String(entry.name ?? ''),
      path: expandPath(String(entry.path ?? ''), dirname(registryPath)),
      branches: Array.isArray(entry.branches) ? entry.branches.map(String) : ['main'],
      mode: parseMode(entry.mode),
    }))
    .filter((r) => r.name && r.path);
  return cached;
}

export function resolveRepoPath(name: string): string {
  const repo = loadRegistry().find((r) => r.name === name);
  if (!repo)
    throw new Error(
      `Repo "${name}" not in registry. Available: ${loadRegistry()
        .map((r) => r.name)
        .join(', ')}`,
    );
  return repo.path;
}

function expandPath(path: string, registryDirectory: string): string {
  if (path.startsWith('~')) return join(process.env.HOME ?? process.env.USERPROFILE ?? '', path.slice(1));
  return resolve(registryDirectory, path);
}

function parseMode(value: unknown): RepoMode {
  if (value === 'workspace' || value === 'snapshot') return value;
  return 'auto';
}
