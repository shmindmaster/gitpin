import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const workflow = parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'));
const releaseWorkflow = parse(readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8'));
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
for (const [file, parsed] of [
  ['ci.yml', workflow],
  ['release.yml', releaseWorkflow],
]) {
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

const releaseStep = releaseJob.steps?.find((step) => step.name === 'Create GitHub Release');
if (
  releaseStep?.env?.GH_TOKEN !== githubTokenExpression ||
  !releaseStep.run?.includes('gh release create') ||
  !releaseStep.run.includes('gh release view') ||
  !releaseStep.run.includes('--generate-notes')
) {
  throw new Error('The trusted release workflow must create a non-duplicate GitHub Release from its version tag.');
}
