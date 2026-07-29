import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const workflow = parse(readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'));
const expectedRunner =
  '$' +
  '{{ github.event_name == \'pull_request\' && github.event.pull_request.head.repo.fork && \'ubuntu-latest\' || fromJSON(\'["self-hosted", "Linux", "X64", "sh-runner", "repocontext"]\') }}';

for (const jobName of ['validate', 'package', 'package-runtime', 'website']) {
  if (workflow.jobs?.[jobName]?.['runs-on'] !== expectedRunner) {
    throw new Error(
      `${jobName} must use GitHub-hosted runners for untrusted fork pull requests and the dedicated DigitalOcean runner otherwise.`,
    );
  }
}
