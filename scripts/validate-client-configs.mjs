import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const markdown = readFileSync(new URL('../docs/clients.md', import.meta.url), 'utf8');
const cursor = JSON.parse(codeBlock('cursor', 'json'));
const windsurf = JSON.parse(codeBlock('windsurf', 'json'));
const zed = JSON.parse(codeBlock('zed', 'json'));
const continueConfig = parse(codeBlock('continue', 'yaml'));

assertStdio(cursor.mcpServers?.gitpin, 'Cursor');
assertStdio(windsurf.mcpServers?.gitpin, 'Windsurf');
assertStdio(zed.context_servers?.gitpin, 'Zed');
assertStdio(continueConfig.mcpServers?.[0], 'Continue');

if (continueConfig.name !== 'GitPin' || continueConfig.schema !== 'v1') {
  throw new Error('Continue example must retain its required standalone block metadata.');
}

for (const requiredLink of [
  'https://cursor.com/docs/mcp',
  'https://docs.devin.ai/windsurf/plugins/cascade/mcp',
  'https://zed.dev/docs/ai/mcp',
  'https://docs.continue.dev/customize/deep-dives/mcp',
]) {
  if (!markdown.includes(requiredLink)) throw new Error(`Client guide is missing its official source: ${requiredLink}`);
}

console.log(JSON.stringify({ clients: 4, status: 'valid' }));

function codeBlock(id, language) {
  const expression = new RegExp(
    `<!-- config:${id}:start -->\\s*\`\`\`${language}\\s*([\\s\\S]*?)\\s*\`\`\`\\s*<!-- config:${id}:end -->`,
    'u',
  );
  const match = markdown.match(expression);
  if (!match?.[1]) throw new Error(`Missing ${id} ${language} configuration block.`);
  return match[1];
}

function assertStdio(server, client) {
  if (server?.command !== 'node') throw new Error(`${client} example must start the compiled server with Node.`);
  if (!Array.isArray(server.args) || !server.args[0]?.endsWith('/dist/server.js')) {
    throw new Error(`${client} example must point to dist/server.js.`);
  }
  if (!server.env?.GITPIN_REGISTRY) throw new Error(`${client} example must set GITPIN_REGISTRY.`);
}
