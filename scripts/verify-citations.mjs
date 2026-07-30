#!/usr/bin/env node
/**
 * CI citation gate: re-check GitPin cite strings or evidence packs against local Git HEAD.
 *
 * Usage:
 *   node scripts/verify-citations.mjs --file notes.md
 *   node scripts/verify-citations.mjs --pack pack.json
 *   pnpm exec tsx src/server.ts verify-cites --file notes.md
 *
 * Requires GITPIN_REGISTRY (or REPOCONTEXT_REGISTRY) pointing at a valid registry.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function flag(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

const file = flag('--file') ?? flag('-f');
const pack = flag('--pack') ?? flag('--from-pack');

if (!file && !pack) {
  console.error('Usage: node scripts/verify-citations.mjs --file <notes.md> | --pack <pack.json>');
  process.exit(2);
}

const serverTs = join(root, 'src', 'server.ts');
const serverJs = join(root, 'dist', 'server.js');
const useTs = existsSync(serverTs) && !process.env.GITPIN_CI_USE_DIST;
const command = useTs ? 'pnpm' : 'node';
const commandArgs = useTs
  ? ['exec', 'tsx', serverTs, ...(file ? ['verify-cites', '--file', file] : ['verify', '--from-pack', pack])]
  : [serverJs, ...(file ? ['verify-cites', '--file', file] : ['verify', '--from-pack', pack])];

const result = spawnSync(command, commandArgs, {
  cwd: root,
  encoding: 'utf8',
  env: process.env,
  shell: process.platform === 'win32',
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status === null ? 1 : result.status);
