import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';

const workflowsDirectory = new URL('../.github/workflows/', import.meta.url);
const workflowFiles = readdirSync(workflowsDirectory).filter((file) => /\.ya?ml$/u.test(file));
const workflows = Object.fromEntries(
  workflowFiles.map((file) => [file, parse(readFileSync(new URL(file, workflowsDirectory), 'utf8'))]),
);
const workflow = workflows['ci.yml'];
const releaseWorkflow = workflows['release.yml'];
const rawReleaseWorkflow = readFileSync(new URL('release.yml', workflowsDirectory), 'utf8');
const packageManifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const githubTokenExpression = '$' + '{{ github.token }}';

// CI used to route fork pull requests to ubuntu-latest and everything else to a
// self-hosted DigitalOcean runner, so this script asserted that exact
// expression. That runner has been retired; every job is now on ephemeral
// hosted runners.
//
// The invariant worth keeping is the security one underneath the old routing:
// untrusted pull-request code must never execute on a persistent host that
// carries state and credentials between jobs. With no self-hosted runner that
// holds trivially, so assert the stronger property instead -- no workflow may
// reintroduce one. If one ever comes back, fork-routing has to come back with
// it, and this check fails loudly rather than letting untrusted code onto a
// persistent machine.
for (const [file, parsed] of Object.entries(workflows)) {
  for (const [jobName, job] of Object.entries(parsed.jobs ?? {})) {
    if (JSON.stringify(job['runs-on'] ?? '').includes('self-hosted')) {
      throw new Error(
        `${file}:${jobName} targets a self-hosted runner. Reintroducing one requires restoring the fork-routing guard that keeps untrusted PR code off a persistent host.`,
      );
    }
  }
}

for (const jobName of ['validate', 'package', 'package-runtime', 'website']) {
  if (workflow.jobs?.[jobName]?.['runs-on'] !== 'ubuntu-latest') {
    throw new Error(`${jobName} must run on ubuntu-latest so every contributor gets the same validation.`);
  }
}

const releaseJob = releaseWorkflow.jobs?.publish;
if (releaseJob?.permissions?.contents !== 'write' || releaseJob.permissions?.['id-token'] !== 'write') {
  throw new Error('The trusted release job must have contents: write and id-token: write permissions.');
}

if (releaseJob?.['runs-on'] !== 'ubuntu-latest') {
  throw new Error('The npm trusted publisher must run on a GitHub-hosted runner.');
}

const setupNodeStep = releaseJob.steps?.find((step) => String(step.uses ?? '').startsWith('actions/setup-node@'));
// The release job must be on the Node 24 line. Accept either the bare major or
// an exact 24.x.y pin: pinning the patch is strictly more reproducible than
// floating on the major, so a check written as `=== '24'` would reject the
// safer of the two. Anything outside 24 is still refused.
const releaseNodeVersion = String(setupNodeStep?.with?.['node-version'] ?? '');
if (
  !/^24(\.\d+\.\d+)?$/.test(releaseNodeVersion) ||
  setupNodeStep?.with?.['registry-url'] !== 'https://registry.npmjs.org' ||
  setupNodeStep?.with?.['package-manager-cache'] !== false
) {
  throw new Error(
    `The trusted release job must use Node 24 (bare major or exact 24.x.y; got "${releaseNodeVersion}"), the npm registry URL, and package-manager-cache: false.`,
  );
}

const toolchainStep = releaseJob.steps?.find((step) => step.name === 'Install release toolchain');
if (!toolchainStep?.run?.includes('npm@12.0.2')) {
  throw new Error('The trusted release job must use the pinned npm 12 toolchain.');
}

const publishStep = releaseJob.steps?.find((step) => step.name === 'Publish package or verify bootstrap artifact');
if (!publishStep?.run?.includes('npm publish --access public')) {
  throw new Error('The trusted release workflow must publish to npm from its OIDC-enabled job.');
}

if (/NODE_AUTH_TOKEN|NPM_TOKEN|secrets\./u.test(rawReleaseWorkflow)) {
  throw new Error('The trusted release workflow must not fall back to a long-lived npm token.');
}

if (packageManifest.repository?.url !== 'git+https://github.com/shmindmaster/gitpin.git') {
  throw new Error('package.json repository.url must match the npm trusted publisher repository.');
}

const releaseStep = releaseJob.steps?.find((step) => step.name === 'Create GitHub Release');
if (
  releaseStep?.env?.GH_TOKEN !== githubTokenExpression ||
  !releaseStep.run?.includes('gh release create') ||
  !releaseStep.run.includes('gh release view') ||
  !releaseStep.run.includes('--generate-notes')
) {
  throw new Error('The trusted release workflow must create a non-duplicate GitHub Release from its version tag.');
}
