/**
 * Registry: reads repositories.yaml, resolves repo paths.
 * Single source of truth for which repos repocontext indexes.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parse } from 'yaml';

export interface RepoEntry { name: string; path: string; branches: string[]; }

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
    resolve(process.cwd(), 'registry', 'repositories.yaml'),
    resolve(process.cwd(), 'repositories.yaml'),
    join(process.env.HOME ?? process.env.USERPROFILE ?? '', '.repocontext', 'repositories.yaml'),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error(
    'No registry/repositories.yaml found. Create registry/repositories.yaml listing repos (name + path).',
  );
}

export function loadRegistry(): RepoEntry[] {
  if (cached) return cached;
  const raw = readFileSync(findRegistryPath(), 'utf-8');
  const parsed = parse(raw) as { repositories?: unknown[] };
  cached = ((parsed.repositories ?? []) as Record<string, unknown>[])
    .map((entry) => ({
      name: String(entry.name ?? ''),
      path: expandHome(String(entry.path ?? '')),
      branches: Array.isArray(entry.branches) ? entry.branches.map(String) : ['main'],
    }))
    .filter((r) => r.name && r.path);
  return cached;
}

export function resolveRepoPath(name: string): string {
  const repo = loadRegistry().find((r) => r.name === name);
  if (!repo) throw new Error(`Repo "${name}" not in registry. Available: ${loadRegistry().map((r) => r.name).join(', ')}`);
  return repo.path;
}

function expandHome(p: string): string {
  return p.startsWith('~') ? join(process.env.HOME ?? process.env.USERPROFILE ?? '', p.slice(1)) : resolve(p);
}
