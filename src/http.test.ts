import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHttpServer } from './http';
import { clearRegistryCache, setRegistryPath } from './registry';
import { clearWikiCache } from './wiki';

const tmpRoot = join(tmpdir(), `repocontext-http-${process.pid}`);
const repositoryPath = join(tmpRoot, 'sample');
const token = 'test-token-not-for-production';

beforeEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  mkdirSync(repositoryPath, { recursive: true });
  writeFileSync(join(repositoryPath, 'README.md'), '# Sample\n', 'utf-8');
  execFileSync('git', ['init', '-q'], { cwd: repositoryPath, windowsHide: true });
  execFileSync('git', ['config', 'user.email', 'repocontext-test@example.invalid'], {
    cwd: repositoryPath,
    windowsHide: true,
  });
  execFileSync('git', ['config', 'user.name', 'RepoContext Test'], {
    cwd: repositoryPath,
    windowsHide: true,
  });
  execFileSync('git', ['add', 'README.md'], { cwd: repositoryPath, windowsHide: true });
  execFileSync('git', ['commit', '-qm', 'test fixture'], { cwd: repositoryPath, windowsHide: true });

  const registryPath = join(tmpRoot, 'repositories.yaml');
  writeFileSync(
    registryPath,
    `repositories:\n  - name: sample\n    path: ${repositoryPath.replace(/\\/g, '/')}\n`,
    'utf-8',
  );
  setRegistryPath(registryPath);
  clearWikiCache();
});

afterEach(() => {
  setRegistryPath(null);
  clearRegistryCache();
  clearWikiCache();
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('authenticated HTTP transport', () => {
  it('rejects unauthenticated MCP requests and exposes a ready health check', async () => {
    const server = createHttpServer({ token });
    await listen(server);
    const port = (server.address() as AddressInfo).port;

    try {
      const unauthorized = await fetch(`http://127.0.0.1:${port}/api/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      });
      expect(unauthorized.status).toBe(401);

      const health = await fetch(`http://127.0.0.1:${port}/healthz`);
      expect(health.status).toBe(200);
      expect(await health.json()).toMatchObject({
        service: 'repocontext',
        status: 'ready',
        repositories: 1,
      });
    } finally {
      await close(server);
    }
  });

  it('completes the MCP handshake and lists the eight read-only tools', async () => {
    const server = createHttpServer({ token });
    await listen(server);
    const port = (server.address() as AddressInfo).port;
    const client = new Client({ name: 'repocontext-http-test', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/api/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    });

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
        'repo.compare',
        'repo.inspect',
        'repo.read',
        'repo.search',
        'wiki.analyze',
        'wiki.catalog',
        'wiki.get',
        'wiki.search',
      ]);
      expect(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);

      const resources = await client.listResources();
      expect(resources.resources).toContainEqual(
        expect.objectContaining({ name: 'catalog', uri: 'repocontext://catalog' }),
      );
      const prompts = await client.listPrompts();
      expect(prompts.prompts).toContainEqual(expect.objectContaining({ name: 'audit-documentation-gaps' }));

      const briefResponse = await client.callTool({
        name: 'wiki.analyze',
        arguments: { operation: 'brief', audience: 'leadership', repositories: ['sample'] },
      });
      expect(briefResponse.isError).not.toBe(true);
      const briefText = briefResponse.content.find((item) => item.type === 'text');
      expect(briefText?.type === 'text' ? JSON.parse(briefText.text) : null).toMatchObject({
        type: 'ContextBrief',
        audience: 'leadership',
        evidenceSetId: expect.stringMatching(/^[0-9a-f]{64}$/),
      });

      const invalidBrief = await client.callTool({
        name: 'wiki.analyze',
        arguments: { operation: 'brief', audience: 'technical', unsupported: true },
      });
      expect(invalidBrief.isError).toBe(true);
    } finally {
      await client.close();
      await close(server);
    }
  });
});

async function listen(server: ReturnType<typeof createHttpServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
}

async function close(server: ReturnType<typeof createHttpServer>): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
