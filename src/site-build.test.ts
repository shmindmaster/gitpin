import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const projectKey = 'phc_GitPinBuildTest123';
const apiHost = 'https://us.i.posthog.com';
const analyticsPages = ['index.html', 'privacy.html'];

function buildSite(configuredProjectKey?: string): void {
  const env = { ...process.env };
  if (configuredProjectKey) env.POSTHOG_GITPIN_PROJECT_KEY = configuredProjectKey;
  else delete env.POSTHOG_GITPIN_PROJECT_KEY;
  execFileSync(process.execPath, [resolve('scripts/build-site.mjs')], {
    cwd: resolve('.'),
    env,
    windowsHide: true,
  });
}

function pageHtml(root: 'site' | '.site-dist', page: string): string {
  return readFileSync(resolve(root, page), 'utf8');
}

function metaContent(html: string, name: string): string | null {
  return html.match(new RegExp(`<meta name="${name}" content="([^"]*)" />`, 'u'))?.[1] ?? null;
}

afterAll(() => buildSite());

describe('AEO discovery surfaces', () => {
  it('keeps llms.txt and JSON-LD in the source and the built site', () => {
    buildSite();

    const sourceLlms = readFileSync(resolve('site/llms.txt'), 'utf8');
    expect(sourceLlms).toContain('GitPin');
    expect(sourceLlms).toContain('https://shmindmaster.github.io/gitpin/');

    const builtLlms = readFileSync(resolve('.site-dist/llms.txt'), 'utf8');
    expect(builtLlms).toBe(sourceLlms);

    const builtIndex = pageHtml('.site-dist', 'index.html');
    expect(builtIndex).toContain('application/ld+json');
    expect(builtIndex).toContain('"@type": "SoftwareApplication"');
  });
});

describe('configured static-site analytics', () => {
  it('keeps every analytics-enabled source and unconfigured build telemetry-free', () => {
    buildSite();

    for (const page of analyticsPages) {
      for (const root of ['site', '.site-dist'] as const) {
        const html = pageHtml(root, page);
        expect(metaContent(html, 'posthog-project-key'), `${root}/${page} project key`).toBe('');
        expect(metaContent(html, 'posthog-api-host'), `${root}/${page} API host`).toBe('');
      }
    }
  });

  it('injects one project and API host into every analytics-enabled built page', () => {
    buildSite(projectKey);

    for (const page of analyticsPages) {
      const html = pageHtml('.site-dist', page);
      expect(metaContent(html, 'posthog-project-key'), `${page} project key`).toBe(projectKey);
      expect(metaContent(html, 'posthog-api-host'), `${page} API host`).toBe(apiHost);
    }
  });
});
