import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setRegistryPath, clearRegistryCache } from './registry';
import { getCatalog, getDocGaps, searchDocs } from './wiki';

const tmpRoot = join(tmpdir(), `repocontext-wiki-${process.pid}`);
const repoPath = join(tmpRoot, 'doc-repo');

beforeEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  mkdirSync(join(repoPath, 'docs'), { recursive: true });
  writeFileSync(join(repoPath, 'README.md'), '# Doc Repo\n\nAuth works with Clerk.\n', 'utf-8');
  writeFileSync(join(repoPath, 'docs', 'architecture.md'), '# Architecture\n\nModular monolith.\n', 'utf-8');
  writeFileSync(join(repoPath, 'AGENTS.md'), '# Agents\n', 'utf-8');
  const yamlPath = join(tmpRoot, 'repositories.yaml');
  writeFileSync(
    yamlPath,
    `
repositories:
  - name: doc-repo
    path: ${repoPath.replace(/\\/g, '/')}
`,
    'utf-8',
  );
  setRegistryPath(yamlPath);
});

afterEach(() => {
  setRegistryPath(null);
  clearRegistryCache();
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('wiki', () => {
  it('catalogs docs', async () => {
    const catalog = await getCatalog();
    expect(catalog).toHaveLength(1);
    expect(catalog[0].name).toBe('doc-repo');
    expect(catalog[0].docCount).toBeGreaterThanOrEqual(2);
    expect(catalog[0].hasReadme).toBe(true);
  });

  it('searches across docs', async () => {
    const hits = await searchDocs('Clerk');
    expect(hits.some((h) => h.sourcePath === 'README.md')).toBe(true);
  });

  it('reports doc gaps', async () => {
    const gaps = (await getDocGaps('gaps')) as Array<{ repository: string; gaps: string[]; present: string[] }>;
    expect(gaps[0].present).toContain('README');
    expect(gaps[0].present).toContain('Architecture');
    expect(gaps[0].present).toContain('Agent Instructions');
    expect(gaps[0].gaps).toContain('Dev Guide');
  });
});
