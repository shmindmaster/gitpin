import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setRegistryPath, clearRegistryCache } from './registry';
import { getCatalog, getDocGaps, getDocs, searchDocs } from './wiki';

const tmpRoot = join(tmpdir(), `repocontext-wiki-${process.pid}`);
const repoPath = join(tmpRoot, 'doc-repo');

beforeEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  mkdirSync(join(repoPath, 'docs'), { recursive: true });
  writeFileSync(join(repoPath, 'README.md'), '# Doc Repo\n\nAuth works with Clerk.\n', 'utf-8');
  writeFileSync(join(repoPath, 'docs', 'architecture.md'), '# Architecture\n\nModular monolith.\n', 'utf-8');
  writeFileSync(join(repoPath, 'AGENTS.md'), '# Agents\n', 'utf-8');
  for (let index = 0; index < 12; index += 1) {
    writeFileSync(
      join(repoPath, 'docs', `reference-${index}.md`),
      `# Reference ${index}\n\nCommitted content.\n`,
      'utf-8',
    );
  }
  execFileSync('git', ['init', '-q'], { cwd: repoPath, windowsHide: true });
  execFileSync('git', ['config', 'user.email', 'repocontext-test@example.invalid'], {
    cwd: repoPath,
    windowsHide: true,
  });
  execFileSync('git', ['config', 'user.name', 'RepoContext Test'], { cwd: repoPath, windowsHide: true });
  execFileSync('git', ['add', '.'], { cwd: repoPath, windowsHide: true });
  execFileSync('git', ['commit', '-qm', 'test fixture'], { cwd: repoPath, windowsHide: true });
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
    expect(catalog[0].commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(catalog[0].stale).toBe(false);
  });

  it('searches across docs', async () => {
    const hits = await searchDocs('Clerk');
    expect(hits).toContainEqual(
      expect.objectContaining({
        sourcePath: 'README.md',
        line: 3,
        snippet: 'Auth works with Clerk.',
        commitSha: expect.stringMatching(/^[0-9a-f]{40}$/),
      }),
    );
    expect(hits[0]).not.toHaveProperty('body');
  });

  it('reports doc gaps', async () => {
    const gaps = (await getDocGaps('gaps')) as Array<{ repository: string; gaps: string[]; present: string[] }>;
    expect(gaps[0].present).toContain('README');
    expect(gaps[0].present).toContain('Architecture');
    expect(gaps[0].present).toContain('Agent Instructions');
    expect(gaps[0].gaps).toContain('Dev Guide');
  });

  it('generates a ContextBrief structure', async () => {
    const brief = (await getDocGaps('brief')) as { type: string; examinedRepositories: number; totalDocuments: number };
    expect(brief.type).toBe('ContextBrief');
    expect(brief.examinedRepositories).toBe(1);
    expect(brief.totalDocuments).toBeGreaterThanOrEqual(14);
  });

  it('reports dirty documentation as stale while returning HEAD content', async () => {
    writeFileSync(join(repoPath, 'README.md'), '# Dirty\n\nUncommitted text.\n', 'utf-8');
    const catalog = await getCatalog();
    expect(catalog[0].stale).toBe(true);

    const page = await getDocs('doc-repo', 'README.md');
    expect(page?.body).toContain('Auth works with Clerk.');
    expect(page?.body).not.toContain('Uncommitted text.');
  });

  it('reports a non-Git registry entry as unavailable', async () => {
    const invalidRegistryPath = join(tmpRoot, 'invalid-repositories.yaml');
    writeFileSync(
      invalidRegistryPath,
      `repositories:\n  - name: missing\n    path: ${join(tmpRoot, 'missing').replace(/\\/g, '/')}\n`,
      'utf-8',
    );
    setRegistryPath(invalidRegistryPath);
    clearRegistryCache();

    const catalog = await getCatalog();
    expect(catalog).toContainEqual(
      expect.objectContaining({ name: 'missing', status: 'unavailable', commitSha: null }),
    );
  });
});
