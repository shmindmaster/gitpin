import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const workflow = parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'));
const releaseWorkflow = parse(readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8'));
const githubTokenExpression = '$' + '{{ github.token }}';
const expectedRunner =
  '$' +
  '{{ github.event_name == \'pull_request\' && github.event.pull_request.head.repo.fork && \'ubuntu-latest\' || fromJSON(\'["self-hosted", "Linux", "X64", "sh-runner-repocontext"]\') }}';

for (const jobName of ['validate', 'package', 'package-runtime', 'website']) {
  if (workflow.jobs?.[jobName]?.['runs-on'] !== expectedRunner) {
    throw new Error(
      `${jobName} must use GitHub-hosted runners for untrusted fork pull requests and the dedicated DigitalOcean runner otherwise.`,
    );
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
