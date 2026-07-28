import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const marker = 'REPOCONTEXT_PACKED_FIRST_ANSWER';
const temporaryRoot = mkdtempSync(join(tmpdir(), 'repocontext-package-'));
const repositoryPath = join(temporaryRoot, 'repository');
const clientPath = join(temporaryRoot, 'client');
const registryPath = join(temporaryRoot, 'repositories.yaml');
const npmCommand = 'npm';
const pnpmCommand = 'pnpm';
const commandEnvironment = { ...process.env };
delete commandEnvironment.npm_config_manage_package_manager_versions;
let client;

try {
  mkdirSync(repositoryPath, { recursive: true });
  mkdirSync(clientPath, { recursive: true });
  writeFileSync(join(repositoryPath, 'README.md'), `# Package fixture\n\n${marker}\n`, 'utf8');
  run('git', ['init', '-q'], repositoryPath);
  run('git', ['config', 'user.email', 'repocontext-test@example.invalid'], repositoryPath);
  run('git', ['config', 'user.name', 'RepoContext Test'], repositoryPath);
  run('git', ['add', 'README.md'], repositoryPath);
  run('git', ['commit', '-qm', 'package fixture'], repositoryPath);

  writeFileSync(
    registryPath,
    `repositories:\n  - name: package-fixture\n    path: ./repository\n    branches: [main, master]\n`,
    'utf8',
  );
  writeFileSync(join(clientPath, 'package.json'), '{"name":"repocontext-package-test","private":true}\n', 'utf8');

  const packOutput = runOutput(npmCommand, ['pack', '--json', '--pack-destination', temporaryRoot], process.cwd());
  const [{ filename }] = JSON.parse(packOutput);
  const tarballPath = join(temporaryRoot, filename);
  run(pnpmCommand, ['add', '--offline', '--ignore-scripts', '--save-exact', tarballPath], clientPath);

  const serverPath = join(clientPath, 'node_modules', 'repocontext', 'dist', 'server.js');
  const environment = { ...commandEnvironment, REPOCONTEXT_REGISTRY: registryPath };
  const doctor = execFileSync(process.execPath, [serverPath, 'doctor'], {
    cwd: clientPath,
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (!doctor.includes('RepoContext readiness: ready') || !doctor.includes('package-fixture: status=indexed')) {
    throw new Error(`Packed doctor check was not ready: ${doctor.trim()}`);
  }

  client = new Client({ name: 'repocontext-package-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: clientPath,
    env: Object.fromEntries(Object.entries(environment).filter((entry) => typeof entry[1] === 'string')),
    stderr: 'pipe',
  });
  await client.connect(transport);
  const answer = await client.callTool({ name: 'wiki.search', arguments: { query: marker } });
  const text = Array.isArray(answer.content)
    ? answer.content
        .filter((item) => item.type === 'text')
        .map((item) => item.text)
        .join('\n')
    : '';
  if (!text.includes(marker)) throw new Error('Packed MCP server did not return the committed fixture evidence.');

  console.log(JSON.stringify({ status: 'ready', package: basename(tarballPath), firstAnswer: 'verified' }));
} finally {
  if (client) await client.close();
  rmSync(temporaryRoot, { recursive: true, force: true });
}

function run(command, args, cwd) {
  const invocation = commandInvocation(command, args);
  execFileSync(invocation.command, invocation.args, {
    cwd,
    env: commandEnvironment,
    stdio: 'pipe',
    windowsHide: true,
  });
}

function runOutput(command, args, cwd) {
  const invocation = commandInvocation(command, args);
  return execFileSync(invocation.command, invocation.args, {
    cwd,
    encoding: 'utf8',
    env: commandEnvironment,
    windowsHide: true,
  });
}

function commandInvocation(command, args) {
  if (process.platform !== 'win32' || (command !== npmCommand && command !== pnpmCommand)) return { command, args };
  return { command: process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', command, ...args] };
}
