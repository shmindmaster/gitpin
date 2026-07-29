import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const source = resolve('site');
const output = resolve('.site-dist');
const projectKey = process.env.POSTHOG_REPOCONTEXT_PROJECT_KEY?.trim() ?? '';

if (projectKey && !/^phc_[A-Za-z0-9]+$/.test(projectKey)) {
  throw new Error('POSTHOG_REPOCONTEXT_PROJECT_KEY must be a PostHog project key beginning with "phc_".');
}

rmSync(output, { force: true, recursive: true });
mkdirSync(output, { recursive: true });
cpSync(source, output, { recursive: true });

if (projectKey) {
  const indexPath = join(output, 'index.html');
  const index = readFileSync(indexPath, 'utf8');
  writeFileSync(
    indexPath,
    index.replace(
      '<meta name="posthog-project-key" content="" />',
      `<meta name="posthog-project-key" content="${projectKey}" />`,
    ),
    'utf8',
  );
}

console.log(JSON.stringify({ analytics: projectKey ? 'configured' : 'disabled', output }));
