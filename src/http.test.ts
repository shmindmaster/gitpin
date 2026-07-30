import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { request as requestHttp } from 'node:http';
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
  execFileSync('git', ['config', 'user.email', 'gitpin-test@example.invalid'], {
    cwd: repositoryPath,
    windowsHide: true,
  });
  execFileSync('git', ['config', 'user.name', 'GitPin Test'], {
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
        service: 'gitpin',
        status: 'ready',
        repositories: 1,
      });
    } finally {
      await close(server);
    }
  });

  it('completes the MCP handshake and lists the twelve read-only pin tools', async () => {
    const server = createHttpServer({ token });
    await listen(server);
    const port = (server.address() as AddressInfo).port;
    const client = new Client({ name: 'gitpin-http-test', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/api/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    });

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
        'pin.analyze',
        'pin.catalog',
        'pin.compare',
        'pin.get_doc',
        'pin.inspect',
        'pin.prove',
        'pin.prove_set',
        'pin.read',
        'pin.search_code',
        'pin.search_docs',
        'pin.verify',
        'pin.verify_set',
      ]);
      expect(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);

      const resources = await client.listResources();
      expect(resources.resources).toContainEqual(expect.objectContaining({ name: 'catalog', uri: 'gitpin://catalog' }));
      const prompts = await client.listPrompts();
      expect(prompts.prompts).toContainEqual(expect.objectContaining({ name: 'prove-with-git-head' }));
      const provePrompt = await client.getPrompt({ name: 'prove-with-git-head' });
      const proveContent = provePrompt.messages[0]?.content;
      expect(proveContent).toMatchObject({ type: 'text' });
      if (proveContent?.type !== 'text') throw new Error('Expected text prompt content.');
      expect(proveContent.text).toContain('pin.prove');
      expect(proveContent.text).toContain('pin.verify');

      const briefResponse = await client.callTool({
        name: 'pin.analyze',
        arguments: { operation: 'brief', audience: 'leadership', repositories: ['sample'] },
      });
      expect(briefResponse.isError).not.toBe(true);
      const briefText = briefResponse.content.find((item) => item.type === 'text');
      expect(briefText?.type === 'text' ? JSON.parse(briefText.text) : null).toMatchObject({
        type: 'EvidenceBrief',
        product: 'gitpin',
        audience: 'leadership',
        evidenceSetId: expect.stringMatching(/^[0-9a-f]{64}$/),
      });

      const invalidBrief = await client.callTool({
        name: 'pin.analyze',
        arguments: { operation: 'brief', audience: 'technical', unsupported: true },
      });
      expect(invalidBrief.isError).toBe(true);

      const invalidCompare = await client.callTool({
        name: 'pin.compare',
        arguments: { repository: 'sample', base: 'HEAD~1', head: 'HEAD' },
      });
      expect(invalidCompare.isError).toBe(true);
    } finally {
      await client.close();
      await close(server);
    }
  });

  it('rejects chunked and oversized MCP request bodies before transport handling', async () => {
    const server = createHttpServer({ token });
    await listen(server);
    const port = (server.address() as AddressInfo).port;

    try {
      expect(await chunkedRequest(port)).toBe(411);

      const oversized = await fetch(`http://127.0.0.1:${port}/api/mcp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: 'x'.repeat(1_048_577),
      });
      expect(oversized.status).toBe(413);
    } finally {
      await close(server);
    }
  });

  it('allows host-agnostic health probes while restricting MCP calls to allowed hosts', async () => {
    const server = createHttpServer({ token, allowedHosts: ['mcp.example.test'] });
    await listen(server);
    const port = (server.address() as AddressInfo).port;

    try {
      expect(await requestStatus(port, '/healthz', 'GET', { host: 'platform-health.internal' })).toBe(200);
      expect(
        await requestStatus(
          port,
          '/api/mcp',
          'POST',
          {
            host: 'platform-health.internal',
            'content-type': 'application/json',
            'content-length': '2',
          },
          '{}',
        ),
      ).toBe(421);
    } finally {
      await close(server);
    }
  });
});

async function chunkedRequest(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = requestHttp({
      host: '127.0.0.1',
      port,
      path: '/api/mcp',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'transfer-encoding': 'chunked',
      },
    });
    request.once('response', (response) => {
      response.resume();
      response.once('end', () => resolve(response.statusCode ?? 0));
    });
    request.once('error', reject);
    request.end('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}');
  });
}

async function requestStatus(
  port: number,
  path: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = requestHttp({ host: '127.0.0.1', port, path, method, headers });
    request.once('response', (response) => {
      response.resume();
      response.once('end', () => resolve(response.statusCode ?? 0));
    });
    request.once('error', reject);
    request.end(body);
  });
}

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
