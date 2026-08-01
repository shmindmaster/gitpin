import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const source = resolve('site');
const output = resolve('.site-dist');
const projectKey = process.env.POSTHOG_GITPIN_PROJECT_KEY?.trim() ?? '';
const apiHost = 'https://us.i.posthog.com';

if (projectKey && !/^phc_[A-Za-z0-9]+$/.test(projectKey)) {
  throw new Error('POSTHOG_GITPIN_PROJECT_KEY must be a PostHog project key beginning with "phc_".');
}

rmSync(output, { force: true, recursive: true });
mkdirSync(output, { recursive: true });
cpSync(source, output, { recursive: true });
mkdirSync(join(output, '_gitpin-artifacts'), { recursive: true });
cpSync(
  resolve('docs/demos/pr-gate-fail-to-pass.artifact.json'),
  join(output, '_gitpin-artifacts/pr-gate-fail-to-pass.artifact.json'),
);

if (projectKey) {
  for (const pagePath of analyticsEnabledPages(output)) {
    let page = readFileSync(pagePath, 'utf8');
    page = injectMeta(page, pagePath, 'posthog-project-key', projectKey);
    page = injectMeta(page, pagePath, 'posthog-api-host', apiHost);
    writeFileSync(pagePath, page, 'utf8');
  }
}

console.log(JSON.stringify({ analytics: projectKey ? 'configured' : 'disabled', output }));

function analyticsEnabledPages(directory) {
  const pages = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) pages.push(...analyticsEnabledPages(entryPath));
    else if (entry.name.endsWith('.html') && readFileSync(entryPath, 'utf8').includes('analytics.js')) {
      pages.push(entryPath);
    }
  }
  return pages;
}

function injectMeta(page, pagePath, name, value) {
  const placeholder = `<meta name="${name}" content="" />`;
  if (!page.includes(placeholder)) {
    throw new Error(`Analytics-enabled page ${pagePath} is missing the empty ${name} meta placeholder.`);
  }
  return page.replace(placeholder, `<meta name="${name}" content="${value}" />`);
}
