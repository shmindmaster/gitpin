import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  run('git', ['config', 'user.email', 'gitpin-test@example.invalid'], repositoryPath);
  run('git', ['config', 'user.name', 'GitPin Test'], repositoryPath);
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
    'server.json',
    'docs/clients.md',
    'docs/configuration.md',
    'docs/migration-gitpin.md',
    'docs/remote-deployment.md',
    'docs/website.md',
    'templates/wiki.yaml',
  ];
  const missingPublicFiles = requiredPublicFiles.filter((file) => !existsSync(join(packageRoot, file)));
  if (missingPublicFiles.length > 0) {
    throw new Error(`Packed public documentation is incomplete: ${missingPublicFiles.join(', ')}.`);
  }
  const packedManifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  const packedRegistryMetadata = JSON.parse(readFileSync(join(packageRoot, 'server.json'), 'utf8'));
  if (packedManifest.bin?.gitpin !== 'dist/server.js' || packedManifest.bin?.repocontext !== 'dist/server.js') {
    throw new Error('Packed npm manifest must retain both the GitPin command and its repocontext migration alias.');
  }
  if (
    packedManifest.mcpName !== 'io.github.shmindmaster/gitpin' ||
    packedRegistryMetadata.name !== packedManifest.mcpName ||
    packedRegistryMetadata.version !== packedManifest.version ||
    packedRegistryMetadata.packages?.[0]?.identifier !== packedManifest.name ||
    packedRegistryMetadata.packages?.[0]?.version !== packedManifest.version
  ) {
    throw new Error('Packed npm and MCP Registry metadata must remain version-matched.');
  }
  const environmentExample = readFileSync(join(packageRoot, '.env.example'), 'utf8');
  if (!environmentExample.split(/\r?\n/u).includes('GITPIN_MCP_TOKEN=')) {
    throw new Error('Packed .env.example must keep GITPIN_MCP_TOKEN empty.');
  }
  const packageReadme = readFileSync(join(packageRoot, 'README.md'), 'utf8');
  if (!packageReadme.includes('@shmindmaster/gitpin@latest')) {
    throw new Error('Packed README must document the published GitPin package.');
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
  const legacyCommand = join(
    clientPath,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'repocontext.cmd' : 'repocontext',
  );
  const legacyInvocation =
    process.platform === 'win32'
      ? { command: process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', legacyCommand, 'help'] }
      : { command: legacyCommand, args: ['help'] };
  const legacyHelp = execFileSync(legacyInvocation.command, legacyInvocation.args, {
    cwd: clientPath,
    env: commandEnvironment,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (!legacyHelp.includes('GitPin') || !legacyHelp.includes('gitpin init')) {
    throw new Error('Packed repocontext migration alias did not invoke the GitPin CLI.');
  }
  const initializedRegistryPath = join(temporaryRoot, 'initialized', 'repositories.yaml');
  const initialization = execFileSync(
    process.execPath,
    [serverPath, 'init', '--client', 'codex', '--repository', repositoryPath, '--registry', initializedRegistryPath],
    {
      cwd: clientPath,
      env: commandEnvironment,
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  if (
    !initialization.includes('GitPin initialized: ready') ||
    !initialization.includes('First evidence:') ||
    !initialization.includes('README.md') ||
    !initialization.includes('codex mcp add --env') ||
    !initialization.includes('@shmindmaster/gitpin@latest') ||
    !existsSync(initializedRegistryPath)
  ) {
    throw new Error(`Packed init journey did not reach a configured first fact: ${initialization.trim()}`);
  }
  const environment = { ...commandEnvironment, GITPIN_REGISTRY: registryPath };
  const doctor = execFileSync(process.execPath, [serverPath, 'doctor'], {
    cwd: clientPath,
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (!doctor.includes('GitPin readiness: ready') || !doctor.includes('package-fixture: status=indexed')) {
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
  const answer = await client.callTool({ name: 'pin.search_docs', arguments: { query: marker } });
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
      initialization: 'verified',
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
