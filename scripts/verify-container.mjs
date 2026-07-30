import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';

const port = Number.parseInt(process.env.REPOCONTEXT_CONTAINER_PORT ?? '3100', 10);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('REPOCONTEXT_CONTAINER_PORT must be a valid TCP port.');
}

const nonce = randomUUID().replaceAll('-', '').slice(0, 12);
const image = `gitpin:verify-${nonce}`;
const container = `repocontext-verify-${nonce}`;
const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
const endpoint = `http://127.0.0.1:${port}/api/mcp`;

try {
  await run('pnpm', ['index:build']);
  await run('docker', ['build', '-f', 'Dockerfile.remote', '-t', image, '.']);
  await run('docker', [
    'run',
    '--rm',
    '-d',
    '--name',
    container,
    '-p',
    `127.0.0.1:${port}:3000`,
    '-e',
    `GITPIN_MCP_TOKEN=${token}`,
    '-e',
    'GITPIN_ALLOWED_HOSTS=127.0.0.1',
    image,
  ]);
  const health = await waitForReadyHealth(port);
  await run(process.execPath, ['scripts/verify-remote.mjs'], {
    ...process.env,
    GITPIN_MCP_URL: endpoint,
    GITPIN_MCP_TOKEN: token,
  });
  console.log(JSON.stringify({ endpoint, health, status: 'verified' }));
} finally {
  await run('docker', ['rm', '-f', container], undefined, true);
  await run('docker', ['image', 'rm', image], undefined, true);
}

async function waitForReadyHealth(port) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) {
        const health = await response.json();
        if (health.status === 'ready') return health;
      }
    } catch {
      // The container is still starting.
    }
    await wait(250);
  }
  throw new Error('Container health endpoint did not become ready within 30 seconds.');
}

async function run(command, args, environment = process.env, allowFailure = false) {
  const invocation = commandInvocation(command, args);
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: process.cwd(),
      env: environment,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('close', resolve);
  });
  if (exitCode !== 0 && !allowFailure)
    throw new Error(`${command} ${args[0] ?? ''} failed with exit code ${exitCode}.`);
}

function commandInvocation(command, args) {
  if (process.platform !== 'win32' || command !== 'pnpm') return { command, args };
  return { command: process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', command, ...args] };
}
