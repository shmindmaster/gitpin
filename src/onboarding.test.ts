import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { type InitClient, initializeRepoContext, parseInitOptions, supportedInitClients } from './onboarding';

const tmpRoot = join(tmpdir(), `repocontext-onboarding-${process.pid}`);
const repositoryPath = join(tmpRoot, 'storefront');
const registryPath = join(tmpRoot, 'home', '.gitpin', 'repositories.yaml');

beforeEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  mkdirSync(repositoryPath, { recursive: true });
  writeFileSync(join(repositoryPath, 'README.md'), '# Storefront\n\nCommitted onboarding evidence.\n', 'utf8');
  execFileSync('git', ['init', '-q'], { cwd: repositoryPath, windowsHide: true });
  execFileSync('git', ['config', 'user.email', 'gitpin-test@example.invalid'], {
    cwd: repositoryPath,
    windowsHide: true,
  });
  execFileSync('git', ['config', 'user.name', 'GitPin Test'], { cwd: repositoryPath, windowsHide: true });
  execFileSync('git', ['add', 'README.md'], { cwd: repositoryPath, windowsHide: true });
  execFileSync('git', ['commit', '-qm', 'onboarding fixture'], { cwd: repositoryPath, windowsHide: true });
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('initializeRepoContext', () => {
  it('creates an external registry, verifies readiness, and returns a commit-pinned first fact', async () => {
    const before = gitStatus(repositoryPath);

    const result = await initializeRepoContext({
      client: 'cursor',
      repositories: [repositoryPath],
      registryPath,
    });

    expect(result.registry.created).toBe(true);
    expect(result.registry.path).toBe(registryPath);
    expect(result.readiness.status).toBe('ready');
    expect(result.firstContext.statement).toContain('storefront exposes README');
    expect(result.firstContext.sourcePath).toBe('README.md');
    expect(result.firstContext.line).toBe(1);
    expect(result.firstContext.commitSha).toMatch(/^[0-9a-f]{40}$/u);
    expect(result.clientConfig).toContain('gitpin@0.6.3');
    expect(result.clientConfig).toContain(registryPath.replace(/\\/gu, '\\\\'));
    expect(readFileSync(registryPath, 'utf8')).toContain(repositoryPath.replace(/\\/gu, '/'));
    expect(gitStatus(repositoryPath)).toBe(before);
  });

  it('is idempotent for an identical registry without rewriting it', async () => {
    const first = await initializeRepoContext({
      client: 'codex',
      repositories: [repositoryPath],
      registryPath,
    });
    const original = readFileSync(registryPath, 'utf8');
    const second = await initializeRepoContext({
      client: 'codex',
      repositories: [repositoryPath],
      registryPath,
    });

    expect(first.registry.created).toBe(true);
    expect(second.registry.created).toBe(false);
    expect(readFileSync(registryPath, 'utf8')).toBe(original);
    expect(second.clientConfig).toContain('codex mcp add --env');
  });

  it('preserves a different existing registry', async () => {
    mkdirSync(join(tmpRoot, 'home', '.gitpin'), { recursive: true });
    const existing = 'repositories:\n  - name: protected\n    path: C:/protected\n';
    writeFileSync(registryPath, existing, 'utf8');

    await expect(
      initializeRepoContext({
        client: 'cursor',
        repositories: [repositoryPath],
        registryPath,
      }),
    ).rejects.toThrow(/Refusing to replace existing registry/u);
    expect(readFileSync(registryPath, 'utf8')).toBe(existing);
  });

  it('rejects a path that is not a Git repository root without creating a registry', async () => {
    const ordinaryDirectory = join(tmpRoot, 'ordinary');
    mkdirSync(ordinaryDirectory);

    await expect(
      initializeRepoContext({
        client: 'cursor',
        repositories: [ordinaryDirectory],
        registryPath,
      }),
    ).rejects.toThrow(/not a Git repository root/u);
    expect(existsSync(registryPath)).toBe(false);
  });

  it('refuses to place the registry inside an indexed repository', async () => {
    const unsafeRegistry = join(realpathSync.native(repositoryPath), 'repositories.yaml');

    await expect(
      initializeRepoContext({
        client: 'cursor',
        repositories: [repositoryPath],
        registryPath: unsafeRegistry,
      }),
    ).rejects.toThrow(/outside indexed repositories/u);
    expect(existsSync(unsafeRegistry)).toBe(false);
  });

  it('returns a cited first result from any non-empty exposed document', async () => {
    execFileSync('git', ['rm', '-q', 'README.md'], { cwd: repositoryPath, windowsHide: true });
    mkdirSync(join(repositoryPath, 'docs'));
    writeFileSync(join(repositoryPath, 'docs', 'guide.md'), '# Operator guide\n\nUse committed evidence.\n', 'utf8');
    execFileSync('git', ['add', 'docs/guide.md'], { cwd: repositoryPath, windowsHide: true });
    execFileSync('git', ['commit', '-qm', 'replace readme with guide'], { cwd: repositoryPath, windowsHide: true });

    const result = await initializeRepoContext({
      client: 'codex',
      repositories: [repositoryPath],
      registryPath,
    });

    expect(result.readiness.status).toBe('ready');
    expect(result.firstContext.sourcePath).toBe('docs/guide.md');
    expect(result.firstContext.line).toBe(1);
    expect(result.firstContext.commitSha).toMatch(/^[0-9a-f]{40}$/u);
  });

  it('skips an empty predefined document when another cited fact is available', async () => {
    writeFileSync(join(repositoryPath, 'README.md'), '', 'utf8');
    writeFileSync(join(repositoryPath, 'AGENTS.md'), '# Agent instructions\n\nRun focused tests.\n', 'utf8');
    execFileSync('git', ['add', 'README.md', 'AGENTS.md'], { cwd: repositoryPath, windowsHide: true });
    execFileSync('git', ['commit', '-qm', 'add agent instructions'], { cwd: repositoryPath, windowsHide: true });

    const result = await initializeRepoContext({
      client: 'codex',
      repositories: [repositoryPath],
      registryPath,
    });

    expect(result.firstContext.sourcePath).toBe('AGENTS.md');
    expect(result.firstContext.line).toBe(1);
  });

  it('does not refresh the indexed repository Git index during readiness checks', async () => {
    const readme = join(repositoryPath, 'README.md');
    const future = new Date(Date.now() + 60_000);
    utimesSync(readme, future, future);
    const before = readFileSync(join(repositoryPath, '.git', 'index'));

    await initializeRepoContext({
      client: 'codex',
      repositories: [repositoryPath],
      registryPath,
    });

    expect(readFileSync(join(repositoryPath, '.git', 'index'))).toEqual(before);
  });
});

describe('init option parsing and client output', () => {
  it('defaults to the current directory and requires a supported client', () => {
    expect(parseInitOptions(['--client', 'codex'], repositoryPath)).toEqual({
      client: 'codex',
      repositories: [repositoryPath],
    });
    expect(() => parseInitOptions([], repositoryPath)).toThrow(/--client/u);
    expect(() => parseInitOptions(['--client', 'unknown'], repositoryPath)).toThrow(/Client must be one of/u);
  });

  it('accepts repeated repositories and an explicit registry', () => {
    expect(
      parseInitOptions(
        ['--client', 'zed', '--repository', repositoryPath, '--repository', repositoryPath, '--registry', registryPath],
        tmpRoot,
      ),
    ).toEqual({
      client: 'zed',
      repositories: [repositoryPath, repositoryPath],
      registryPath,
    });
  });

  it.each(supportedInitClients)('generates a package-based configuration for %s', async (client: InitClient) => {
    const perClientRegistry = join(tmpRoot, client, 'repositories.yaml');
    const result = await initializeRepoContext({
      client,
      repositories: [repositoryPath],
      registryPath: perClientRegistry,
    });

    expect(result.clientConfig).toContain('gitpin@0.6.3');
    expect(result.clientConfig).toContain('GITPIN_REGISTRY');
    if (client === 'codex') {
      expect(result.clientConfig).toMatch(/^codex mcp add --env /u);
    } else if (client === 'claude-code') {
      expect(result.clientConfig).toMatch(/^claude mcp add gitpin -e /u);
    } else if (client === 'continue') {
      const config = parse(result.clientConfig);
      expect(config.mcpServers[0]).toMatchObject({ name: 'GitPin', type: 'stdio' });
    } else {
      const config = JSON.parse(result.clientConfig);
      const server = client === 'zed' ? config.context_servers.gitpin : config.mcpServers.gitpin;
      expect(server.args).toEqual(['-y', 'gitpin@0.6.3']);
      if (client === 'cursor') expect(server.type).toBe('stdio');
    }
  });
});

function gitStatus(path: string): string {
  return execFileSync('git', ['status', '--porcelain'], {
    cwd: path,
    encoding: 'utf8',
    windowsHide: true,
  });
}
