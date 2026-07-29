import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const marker = 'REPOCONTEXT_PACKED_FIRST_ANSWER';
const packageManifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const packageName = packageManifest.name;
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

  const packageRoot = join(clientPath, 'node_modules', ...packageName.split('/'));
  const requiredPublicFiles = [
    '.env.example',
    'CHANGELOG.md',
    'CODE_OF_CONDUCT.md',
    'CONTRIBUTING.md',
    'LICENSE',
    'README.md',
    'ROADMAP.md',
    'SECURITY.md',
    'docs/clients.md',
    'docs/configuration.md',
    'docs/remote-deployment.md',
    'docs/website.md',
    'templates/wiki.yaml',
  ];
  const missingPublicFiles = requiredPublicFiles.filter((file) => !existsSync(join(packageRoot, file)));
  if (missingPublicFiles.length > 0) {
    throw new Error(`Packed public documentation is incomplete: ${missingPublicFiles.join(', ')}.`);
  }
  const environmentExample = readFileSync(join(packageRoot, '.env.example'), 'utf8');
  if (!environmentExample.split(/\r?\n/u).includes('REPOCONTEXT_MCP_TOKEN=')) {
    throw new Error('Packed .env.example must keep REPOCONTEXT_MCP_TOKEN empty.');
  }
  const packageReadme = readFileSync(join(packageRoot, 'README.md'), 'utf8');
  if (!packageReadme.includes('args: ["-y", "@shmindmaster/repocontext@latest"]')) {
    throw new Error('Packed README must document the published npx MCP command.');
  }
  if (
    packageReadme.includes('After the package is published') ||
    packageReadme.includes('GitHub Discussions or issues')
  ) {
    throw new Error('Packed README must not contain stale pre-publication or disabled-community guidance.');
  }
  const missingReadmeTargets = [...packageReadme.matchAll(/\]\((?!https?:\/\/|#)([^)#]+)(?:#[^)]*)?\)/gu)]
    .map((match) => match[1])
    .filter((target) => !existsSync(join(packageRoot, target)));
  if (missingReadmeTargets.length > 0) {
    throw new Error(`Packed README links are incomplete: ${missingReadmeTargets.join(', ')}.`);
  }

  const serverPath = join(packageRoot, 'dist', 'server.js');
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
      publicDocs: 'verified',
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
