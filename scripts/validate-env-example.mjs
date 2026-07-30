import { readFileSync } from 'node:fs';

const expectedKeys = [
  'GITPIN_REGISTRY',
  'GITPIN_INDEX_PATH',
  'GITPIN_MCP_TOKEN',
  'GITPIN_ALLOWED_HOSTS',
  'HOST',
  'PORT',
  'GITPIN_MCP_URL',
  'POSTHOG_GITPIN_PROJECT_KEY',
];

const entries = new Map();
for (const [index, rawLine] of readFileSync('.env.example', 'utf8').split(/\r?\n/u).entries()) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;

  const separator = line.indexOf('=');
  if (separator < 1) throw new Error(`Invalid .env.example entry on line ${index + 1}.`);

  const key = line.slice(0, separator);
  if (entries.has(key)) throw new Error(`Duplicate .env.example entry: ${key}.`);
  entries.set(key, line.slice(separator + 1));
}

const missingKeys = expectedKeys.filter((key) => !entries.has(key));
const unexpectedKeys = [...entries.keys()].filter((key) => !expectedKeys.includes(key));
if (missingKeys.length > 0) throw new Error(`Missing .env.example entries: ${missingKeys.join(', ')}.`);
if (unexpectedKeys.length > 0) throw new Error(`Unexpected .env.example entries: ${unexpectedKeys.join(', ')}.`);

if (entries.get('GITPIN_MCP_TOKEN')) {
  throw new Error('GITPIN_MCP_TOKEN must remain empty in .env.example.');
}
if (entries.get('POSTHOG_GITPIN_PROJECT_KEY')) {
  throw new Error('POSTHOG_GITPIN_PROJECT_KEY must remain empty in .env.example.');
}
if (!entries.get('HOST')) throw new Error('HOST must be configured in .env.example.');
if (!/^\d+$/u.test(entries.get('PORT') ?? '')) throw new Error('PORT must be numeric in .env.example.');
const remoteUrl = new URL(entries.get('GITPIN_MCP_URL') ?? '');
if (!['http:', 'https:'].includes(remoteUrl.protocol)) {
  throw new Error('GITPIN_MCP_URL must use HTTP or HTTPS in .env.example.');
}

console.log(JSON.stringify({ entries: entries.size, status: 'valid' }));
