import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const endpoint = new URL(process.env.GITPIN_MCP_URL ?? 'http://127.0.0.1:3000/api/mcp');
const token = process.env.GITPIN_MCP_TOKEN?.trim();
if (!token) throw new Error('GITPIN_MCP_TOKEN is required.');

const healthUrl = new URL('/healthz', endpoint);
const healthResponse = await fetch(healthUrl);
if (!healthResponse.ok) throw new Error(`Health check failed with HTTP ${healthResponse.status}.`);
const health = await healthResponse.json();
if (health.status !== 'ready' || health.repositories < 1 || health.documents < 1) {
  throw new Error(`Health check is not ready: ${JSON.stringify(health)}`);
}

const unauthorized = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
});
if (unauthorized.status !== 401) {
  throw new Error(`Unauthenticated MCP request returned HTTP ${unauthorized.status}; expected 401.`);
}

const expectedTools = [
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
];
const client = new Client({ name: 'gitpin-remote-verifier', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(endpoint, {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
});
try {
  await client.connect(transport);
  const response = await client.listTools();
  const actualTools = response.tools.map((tool) => tool.name).sort();
  if (JSON.stringify(actualTools) !== JSON.stringify(expectedTools)) {
    throw new Error(`Unexpected MCP tools: ${actualTools.join(', ')}`);
  }
  if (!response.tools.every((tool) => tool.annotations?.readOnlyHint === true)) {
    throw new Error('At least one MCP tool is not marked read-only.');
  }
  const catalog = await client.callTool({ name: 'pin.catalog', arguments: { view: 'repositories' } });
  if (catalog.isError) throw new Error('pin.catalog returned an MCP error.');
  console.log(
    JSON.stringify({
      endpoint: endpoint.origin,
      repositories: health.repositories,
      documents: health.documents,
      tools: actualTools.length,
      unauthenticatedStatus: unauthorized.status,
    }),
  );
} finally {
  await client.close();
}
