import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getContextBrief } from './context-brief';
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

  it('generates an audience-invariant, source-cited Context Brief', async () => {
    const brief = await getContextBrief({ audience: 'technical' });
    const productBrief = await getContextBrief({ audience: 'product' });
    expect(brief.type).toBe('ContextBrief');
    expect(brief.scope.examinedRepositories).toBe(1);
    expect(brief.scope.totalDocuments).toBeGreaterThanOrEqual(14);
    expect(brief.evidenceSetId).toBe(productBrief.evidenceSetId);
    expect(brief.presentation.focus).not.toBe(productBrief.presentation.focus);
    expect(brief.knownFacts).toContainEqual(
      expect.objectContaining({
        label: 'known',
        trace: expect.objectContaining({
          sourcePath: 'README.md',
          line: 1,
          commitSha: expect.stringMatching(/^[0-9a-f]{40}$/),
          originatingOperation: 'wiki.analyze:brief',
        }),
      }),
    );
    expect(brief.gaps).toContainEqual(
      expect.objectContaining({
        label: 'gap',
        trace: expect.objectContaining({ sourcePath: 'docs/development.md' }),
      }),
    );
  });

  it('adds bounded, fully resolved change evidence to a Context Brief', async () => {
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPath, encoding: 'utf-8' }).trim();
    writeFileSync(join(repoPath, 'README.md'), '# Doc Repo\n\nUpdated committed evidence.\n', 'utf-8');
    execFileSync('git', ['add', 'README.md'], { cwd: repoPath, windowsHide: true });
    execFileSync('git', ['commit', '-qm', 'update readme'], { cwd: repoPath, windowsHide: true });
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPath, encoding: 'utf-8' }).trim();

    const brief = await getContextBrief({
      repositories: ['doc-repo'],
      changeRange: { repository: 'doc-repo', base: base.slice(0, 7), head: head.slice(0, 7) },
    });

    expect(brief.scope.changeRange).toMatchObject({ base, head, commitsBetween: 1, changedPaths: 1 });
    expect(brief.knownFacts).toContainEqual(
      expect.objectContaining({
        statement: expect.stringContaining('changed README.md'),
        trace: expect.objectContaining({ sourcePath: 'README.md', commitSha: head }),
      }),
    );
  });

  it('keeps an explicitly requested unregistered repository visible as a gap', async () => {
    const brief = await getContextBrief({ repositories: ['not-registered'] });

    expect(brief.scope).toMatchObject({ examinedRepositories: 1, unavailableRepositories: 1 });
    expect(brief.gaps).toContainEqual(
      expect.objectContaining({
        id: 'unavailable:not-registered',
        label: 'gap',
        trace: expect.objectContaining({ repository: 'not-registered', commitSha: null }),
      }),
    );
  });

  it('returns an unavailable change-range gap for an unregistered repository', async () => {
    const brief = await getContextBrief({
      repositories: ['not-registered'],
      changeRange: { repository: 'not-registered', base: '1111111', head: '2222222' },
    });

    expect(brief.scope.changeRange).toMatchObject({ repository: 'not-registered', status: 'unavailable' });
    expect(brief.gaps).toContainEqual(
      expect.objectContaining({
        id: 'change-range-unavailable:not-registered',
        trace: expect.objectContaining({ repository: 'not-registered', commitSha: null }),
      }),
    );
  });

  it('does not invent a first-line citation for an empty document', async () => {
    writeFileSync(join(repoPath, 'README.md'), '', 'utf-8');
    execFileSync('git', ['add', 'README.md'], { cwd: repoPath, windowsHide: true });
    execFileSync('git', ['commit', '-qm', 'empty readme'], { cwd: repoPath, windowsHide: true });

    const brief = await getContextBrief({ repositories: ['doc-repo'] });
    expect(brief.knownFacts).toContainEqual(
      expect.objectContaining({
        id: 'document:doc-repo:README.md',
        trace: expect.objectContaining({ sourcePath: 'README.md', line: null }),
      }),
    );
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
