import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const marker = 'REPOCONTEXT_PACKED_FIRST_ANSWER';
const temporaryRoot = mkdtempSync(join(tmpdir(), 'repocontext-package-'));
const repositoryPath = join(temporaryRoot, 'repository');
const clientPath = join(temporaryRoot, 'client');
const registryPath = join(temporaryRoot, 'repositories.yaml');
const npmCommand = 'npm';
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

  const providedTarball = process.argv[2]?.trim() || process.env.REPOCONTEXT_PACKAGE_TARBALL?.trim();
  let tarballPath;
  if (providedTarball) {
    tarballPath = resolve(providedTarball);
  } else {
    const packOutput = runOutput(npmCommand, ['pack', '--json', '--pack-destination', temporaryRoot], process.cwd());
    const [{ filename }] = JSON.parse(packOutput);
    tarballPath = join(temporaryRoot, filename);
  }
  const isolatedNpmCache = join(temporaryRoot, 'npm-cache');
  run(npmCommand, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact', tarballPath], clientPath, {
    ...commandEnvironment,
    npm_config_cache: isolatedNpmCache,
  });

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
  const brief = JSON.parse(
    execFileSync(
      process.execPath,
      [serverPath, 'brief', '--audience', 'technical', '--repository', 'package-fixture'],
      {
        cwd: clientPath,
        env: environment,
        encoding: 'utf8',
        windowsHide: true,
      },
    ),
  );
  if (!/^[0-9a-f]{64}$/.test(brief.evidenceSetId) || brief.knownFacts.length < 1) {
    throw new Error('Packed Context Brief did not contain a deterministic evidence set and cited known facts.');
  }

  const sdkRoot = join(clientPath, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'esm', 'client');
  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import(pathToFileURL(join(sdkRoot, 'index.js')).href),
    import(pathToFileURL(join(sdkRoot, 'stdio.js')).href),
  ]);
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

  console.log(
    JSON.stringify({
      status: 'ready',
      package: basename(tarballPath),
      cleanInstall: 'verified',
      doctor: 'verified',
      contextBrief: 'verified',
      firstAnswer: 'verified',
    }),
  );
} finally {
  if (client) await client.close();
  rmSync(temporaryRoot, { recursive: true, force: true });
}

function run(command, args, cwd, environment = commandEnvironment) {
  const invocation = commandInvocation(command, args);
  execFileSync(invocation.command, invocation.args, {
    cwd,
    env: environment,
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
  if (process.platform !== 'win32' || command !== npmCommand) return { command, args };
  return { command: process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', command, ...args] };
}
