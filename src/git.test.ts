import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setRegistryPath, clearRegistryCache } from './registry';
import { compareRepoCommits, getRepoFile, getRepoManifest, getRepoStatus, getRepoTests, searchRepoCode } from './git';
import { assertWithinRoot } from './git-shared';

const tmpRoot = join(tmpdir(), `repocontext-git-${process.pid}`);
const repoPath = join(tmpRoot, 'sample-repo');

function initRepo(): void {
  mkdirSync(repoPath, { recursive: true });
  execSync('git init', { cwd: repoPath, stdio: 'ignore' });
  execSync('git config user.email "test@example.com"', { cwd: repoPath, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: repoPath, stdio: 'ignore' });
  writeFileSync(join(repoPath, 'README.md'), '# Sample\n\nHello.\n', 'utf-8');
  writeFileSync(
    join(repoPath, 'package.json'),
    JSON.stringify({ name: 'sample', version: '1.0.0', scripts: { test: 'echo' } }),
    'utf-8',
  );
  writeFileSync(join(repoPath, '.env'), 'SECRET=1\n', 'utf-8');
  mkdirSync(join(repoPath, 'src'), { recursive: true });
  writeFileSync(join(repoPath, 'src', 'worker.ts'), 'export const sampleWorker = true;\n', 'utf-8');
  writeFileSync(join(repoPath, 'src', 'worker.test.ts'), 'export const workerTest = true;\n', 'utf-8');
  execSync('git add README.md package.json src', { cwd: repoPath, stdio: 'ignore' });
  execSync('git commit -m "init"', { cwd: repoPath, stdio: 'ignore' });
}

beforeEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  mkdirSync(tmpRoot, { recursive: true });
  initRepo();
  const yamlPath = join(tmpRoot, 'repositories.yaml');
  writeFileSync(
    yamlPath,
    `
repositories:
  - name: sample
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

describe('git safety', () => {
  it('reads a normal file with line numbers', async () => {
    const result = await getRepoFile('sample', 'README.md');
    expect(result.blocked).toBeUndefined();
    expect(result.content).toContain('1: # Sample');
    expect(result.commitSha).not.toBe('unknown');
  });

  it('returns bytes from Git HEAD and excludes dirty working-tree changes', async () => {
    writeFileSync(join(repoPath, 'README.md'), '# Dirty working tree\n', 'utf-8');
    const result = await getRepoFile('sample', 'README.md');
    expect(result.content).toContain('# Sample');
    expect(result.content).not.toContain('Dirty working tree');
    expect(result.provenance).toBe('git-head');
  });

  it('blocks sensitive paths', async () => {
    const result = await getRepoFile('sample', '.env');
    expect(result.blocked).toBe(true);
  });

  it('blocks path traversal', async () => {
    await expect(getRepoFile('sample', '../outside.txt')).rejects.toThrow(/traversal/i);
  });

  it('blocks symlink escape outside the repository root', () => {
    const outside = join(tmpRoot, 'outside-secret.txt');
    writeFileSync(outside, 'escaped\n', 'utf-8');
    const linkPath = join(repoPath, 'escape-link.txt');
    try {
      symlinkSync(outside, linkPath);
    } catch {
      // Windows may require elevated privileges for file symlinks.
      return;
    }
    expect(() => assertWithinRoot(repoPath, linkPath, 'escape-link.txt')).toThrow(/traversal/i);
  });

  it('reports status and manifest', async () => {
    const status = await getRepoStatus('sample');
    expect(status.repository).toBe('sample');
    expect(status).toHaveProperty('mode', 'repository');
    expect('latestCommit' in status && status.latestCommit).toBeTruthy();

    const manifest = await getRepoManifest('sample');
    expect(manifest.hasReadme).toBe(true);
    expect((manifest.packageJson as { name: string }).name).toBe('sample');
    expect(manifest.commitSha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('reports committed tests and correctly locates Git HEAD search results', async () => {
    const tests = await getRepoTests('sample');
    expect(tests.hasTests).toBe(true);
    expect(tests.testFiles).toContain('src/worker.test.ts');
    expect(tests.testScripts).toContain('test');

    const hits = await searchRepoCode('sample', 'sampleWorker');
    expect(hits).toContainEqual(
      expect.objectContaining({
        sourcePath: 'src/worker.ts',
        line: 1,
        commitSha: expect.stringMatching(/^[0-9a-f]{40}$/),
      }),
    );
  });

  it('keeps manifest metadata pinned to HEAD when package.json is dirty', async () => {
    writeFileSync(join(repoPath, 'package.json'), JSON.stringify({ name: 'dirty', version: '9.9.9' }), 'utf-8');
    const manifest = await getRepoManifest('sample');
    expect((manifest.packageJson as { name: string }).name).toBe('sample');
  });

  it('resolves abbreviated comparison inputs to full commit SHAs', async () => {
    const base = execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf-8' }).trim();
    writeFileSync(join(repoPath, 'README.md'), '# Updated\n', 'utf-8');
    execSync('git add README.md && git commit -m "update"', { cwd: repoPath, stdio: 'ignore' });
    const head = execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf-8' }).trim();

    const comparison = await compareRepoCommits('sample', base.slice(0, 7), head.slice(0, 7));

    expect(comparison).toMatchObject({ base, head, commitsBetween: 1 });
  });
});
