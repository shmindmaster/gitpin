import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const server = JSON.parse(readFileSync(new URL('../server.json', import.meta.url), 'utf8'));
const workflow = parse(readFileSync(new URL('../.github/workflows/publish-mcp.yml', import.meta.url), 'utf8'));
const expectedName = 'io.github.shmindmaster/gitpin';
const releaseInputExpression = '$' + '{{ inputs.release_ref }}';

if (packageJson.mcpName !== expectedName || server.name !== expectedName) {
  throw new Error('package.json mcpName and server.json name must match the GitHub-owned RepoContext namespace.');
}
if (server.version !== packageJson.version) {
  throw new Error(`server.json version ${server.version} does not match package version ${packageJson.version}.`);
}
if (server.description.length > 100) {
  throw new Error('MCP Registry descriptions must not exceed 100 characters.');
}
if (
  server.repository?.url !== 'https://github.com/shmindmaster/gitpin' ||
  server.repository?.source !== 'github'
) {
  throw new Error('server.json must point to the canonical public GitHub repository.');
}

const npmPackages = server.packages?.filter((entry) => entry.registryType === 'npm') ?? [];
if (
  npmPackages.length !== 1 ||
  npmPackages[0].identifier !== packageJson.name ||
  npmPackages[0].version !== packageJson.version ||
  npmPackages[0].transport?.type !== 'stdio'
) {
  throw new Error('server.json must expose exactly one version-matched npm stdio package.');
}

const registryEnvironment = npmPackages[0].environmentVariables ?? [];
if (
  registryEnvironment.length !== 1 ||
  registryEnvironment[0].name !== 'GITPIN_REGISTRY' ||
  registryEnvironment[0].isRequired !== false ||
  registryEnvironment[0].isSecret !== false
) {
  throw new Error('server.json must describe the optional, non-secret RepoContext registry path.');
}

if (workflow.on?.workflow_dispatch?.inputs?.release_ref?.required !== true) {
  throw new Error('MCP Registry publication must remain an explicit workflow dispatch with a required release tag.');
}
if (workflow.on?.push || workflow.on?.release || workflow.on?.schedule) {
  throw new Error(
    'MCP Registry publication must not run automatically before the initial immutable publication is approved.',
  );
}

const publishJob = workflow.jobs?.publish;
if (publishJob?.permissions?.contents !== 'read' || publishJob.permissions?.['id-token'] !== 'write') {
  throw new Error('MCP Registry publication must use least-privilege GitHub OIDC permissions.');
}
const installCommands = (publishJob.steps ?? []).map((step) => step.run ?? '').filter(Boolean);
if (
  !installCommands.includes('npm install --global pnpm@11.15.0') ||
  !installCommands.includes('pnpm install --frozen-lockfile')
) {
  throw new Error('MCP Registry publication must install the locked verifier dependencies before validation.');
}
const metadataStep = (publishJob.steps ?? []).find((step) => step.name === 'Match metadata to the release tag');
if (
  metadataStep?.env?.RELEASE_REF !== releaseInputExpression ||
  !metadataStep.run?.includes('verify-release-tag.mjs "$RELEASE_REF"') ||
  !metadataStep.run?.includes('show-ref --verify --quiet "refs/tags/$RELEASE_REF"') ||
  metadataStep.run.includes(releaseInputExpression)
) {
  throw new Error('MCP Registry publication must validate its release tag without shell input interpolation.');
}
const commands = (publishJob.steps ?? []).map((step) => step.run ?? '').join('\n');
for (const required of [
  'mcp-publisher login github-oidc',
  'mcp-publisher publish',
  'npm view',
  'git merge-base --is-ancestor',
  'ab128162b0616090b47cf245afe0a23f3ef08936fdce19074f5ba0a4469281ac',
]) {
  if (!commands.includes(required)) {
    throw new Error(`MCP Registry publication workflow is missing required gate: ${required}`);
  }
}

console.log(
  JSON.stringify({
    name: server.name,
    version: server.version,
    package: npmPackages[0].identifier,
    transport: npmPackages[0].transport.type,
    publication: 'manual-oidc',
    status: 'matched',
  }),
);
