/**
 * Registry: reads repositories.yaml and resolves repo paths.
 * The registry is the single source of truth for which repos repocontext indexes.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parse } from 'yaml';

export interface RepoEntry {
  name: string;
  path: string;
  branches: string[];
  wikiPlan?: string;
}

export interface Registry {
  repositories: RepoEntry[];
}

let cachedRegistry: Registry | null = null;

function findRegistryPath(): string {
  // Check CWD first, then home directory
  const candidates = [
    resolve(process.cwd(), 'registry', 'repositories.yaml'),
    resolve(process.cwd(), 'repositories.yaml'),
    join(process.env.HOME ?? process.env.USERPROFILE ?? '', '.repocontext', 'repositories.yaml'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    'No registry/repositories.yaml found. Run `pnpm init:repos` to create one, ' +
    'or create registry/repositories.yaml manually. See templates/wiki.yaml for per-repo config.'
  );
}

export function loadRegistry(): Registry {
  if (cachedRegistry) return cachedRegistry;

  const registryPath = findRegistryPath();
  const raw = readFileSync(registryPath, 'utf-8');
  const parsed = parse(raw) as { repositories?: unknown[] };

  const repositories: RepoEntry[] = (parsed.repositories ?? []).map((entry: Record<string, unknown>) => ({
    name: String(entry.name ?? ''),
    path: expandHome(String(entry.path ?? '')),
    branches: Array.isArray(entry.branches) ? entry.branches.map(String) : ['main'],
    wikiPlan: entry.wikiPlan ? String(entry.wikiPlan) : undefined,
  })).filter((r) => r.name && r.path);

  cachedRegistry = { repositories };
  return cachedRegistry;
}

export function resolveRepoPath(repositoryName: string): string {
  const registry = loadRegistry();
  const repo = registry.repositories.find((r) => r.name === repositoryName);
  if (!repo) {
    const available = registry.repositories.map((r) => r.name).join(', ');
    throw new Error(`Repository "${repositoryName}" not found in registry. Available: ${available}`);
  }
  return repo.path;
}

export function getRepoEntry(repositoryName: string): RepoEntry {
  const registry = loadRegistry();
  const repo = registry.repositories.find((r) => r.name === repositoryName);
  if (!repo) throw new Error(`Repository "${repositoryName}" not found in registry.`);
  return repo;
}

export function listRepos(): RepoEntry[] {
  return loadRegistry().repositories;
}

export function clearCache(): void {
  cachedRegistry = null;
}

function expandHome(p: string): string {
  if (p.startsWith('~')) {
    return join(process.env.HOME ?? process.env.USERPROFILE ?? '', p.slice(1));
  }
  return resolve(p);
}
