import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { clearRegistryCache, loadRegistry, resolveRepoPath, setRegistryPath } from './registry';

const tmpRoot = join(tmpdir(), `repocontext-test-${process.pid}`);

afterEach(() => {
  setRegistryPath(null);
  clearRegistryCache();
  try {
    rmSync(tmpRoot, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe('registry', () => {
  it('loads repositories from yaml', () => {
    mkdirSync(tmpRoot, { recursive: true });
    const yamlPath = join(tmpRoot, 'repositories.yaml');
    writeFileSync(
      yamlPath,
      `
repositories:
  - name: demo
    path: C:/Repos/shmindmaster/agent-guard
    branches: [main]
`,
      'utf-8',
    );
    setRegistryPath(yamlPath);
    const repos = loadRegistry();
    expect(repos).toHaveLength(1);
    expect(repos[0].name).toBe('demo');
    expect(resolveRepoPath('demo')).toMatch(/agent-guard/i);
  });

  it('rejects unknown repo names with available list', () => {
    mkdirSync(tmpRoot, { recursive: true });
    const yamlPath = join(tmpRoot, 'repositories.yaml');
    writeFileSync(
      yamlPath,
      `
repositories:
  - name: only
    path: C:/tmp/only
`,
      'utf-8',
    );
    setRegistryPath(yamlPath);
    expect(() => resolveRepoPath('missing')).toThrow(/Available: only/);
  });
});
