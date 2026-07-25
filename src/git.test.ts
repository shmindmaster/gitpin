import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setRegistryPath, clearRegistryCache } from './registry';
import { getRepoFile, getRepoManifest, getRepoStatus } from './git';

const tmpRoot = join(tmpdir(), `repocontext-git-${process.pid}`);
const repoPath = join(tmpRoot, 'sample-repo');

function initRepo(): void {
  mkdirSync(repoPath, { recursive: true });
  execSync('git init', { cwd: repoPath, stdio: 'ignore' });
  execSync('git config user.email "test@example.com"', { cwd: repoPath, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: repoPath, stdio: 'ignore' });
  writeFileSync(join(repoPath, 'README.md'), '# Sample\n\nHello.\n', 'utf-8');
  writeFileSync(join(repoPath, 'package.json'), JSON.stringify({ name: 'sample', version: '1.0.0', scripts: { test: 'echo' } }), 'utf-8');
  writeFileSync(join(repoPath, '.env'), 'SECRET=1\n', 'utf-8');
  execSync('git add README.md package.json', { cwd: repoPath, stdio: 'ignore' });
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

  it('blocks sensitive paths', async () => {
    const result = await getRepoFile('sample', '.env');
    expect(result.blocked).toBe(true);
  });

  it('blocks path traversal', async () => {
    await expect(getRepoFile('sample', '../outside.txt')).rejects.toThrow(/traversal/i);
  });

  it('reports status and manifest', async () => {
    const status = await getRepoStatus('sample');
    expect(status.repository).toBe('sample');
    expect(status.latestCommit).toBeTruthy();

    const manifest = await getRepoManifest('sample');
    expect(manifest.hasReadme).toBe(true);
    expect((manifest.packageJson as { name: string }).name).toBe('sample');
  });
});
