import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/RepoContext/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Commit-pinned context for coding agents.');
  expect(errors).toEqual([]);
});

test('presents the release path and safety boundary without analytics by default', async ({ page }) => {
  const analyticsRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('posthog')) analyticsRequests.push(request.url());
  });

  await expect(page.getByText('No database. No embeddings. No write tools.')).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Safety', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A deliberately narrow trust boundary.' })).toBeVisible();
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Install', exact: true }).click();
  await expect(page.locator('.terminal')).toContainText('@shmindmaster/repocontext@latest init --client codex');
  await expect(page.locator('body')).not.toContainText(/release candidate/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://shmindmaster.github.io/repocontext/',
  );
  await expect(page.getByRole('link', { name: 'Privacy', exact: true })).toHaveAttribute('href', './privacy.html');
  expect(analyticsRequests).toEqual([]);
});

test('makes npm-first onboarding the primary activation path', async ({ page }) => {
  const primaryAction = page.getByRole('link', { name: 'Start with npx', exact: true });
  await expect(primaryAction).toHaveAttribute('href', '#install');
  await primaryAction.click();
  await expect(page.getByRole('heading', { name: 'From install to cited answer.' })).toBeVisible();
  await expect(page.locator('.terminal')).toContainText('init --client codex');
  await expect(page.locator('.terminal')).toContainText('Registry: ~/.repocontext/repositories.yaml');
  await expect(page.locator('.terminal')).toContainText('First context: README.md:1');
});

test('publishes a narrow, accessible privacy statement', async ({ page }) => {
  await page.goto('/privacy.html');
  await expect(page).toHaveTitle(/Privacy/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy at RepoContext');
  await expect(page.getByText('The CLI and MCP transports do not send telemetry.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to RepoContext', exact: true })).toHaveAttribute('href', './');
});

test('switches audience presentation while preserving the evidence set', async ({ page }) => {
  const evidenceSet = await page.locator('.evidence-id code').textContent();
  await page.getByRole('tab', { name: 'Product' }).click();
  await expect(page.getByRole('tab', { name: 'Product' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#audience-question')).toHaveText('What can users trust in a Context Brief?');
  await expect(page.locator('.evidence-id code')).toHaveText(evidenceSet);

  await page.getByRole('tab', { name: 'Product' }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Operations' })).toBeFocused();
  await expect(page.locator('#audience-fact')).toHaveText('HTTP snapshots contain documentation and manifests only.');
  await expect(page.locator('.evidence-id code')).toHaveText(evidenceSet);
});

test('delivers custom events after the asynchronous analytics loader replaces its queue', async ({ page }) => {
  await page.route('https://us-assets.i.posthog.com/static/array.js', async (route) => {
    await route.fulfill({
      body: `
        window.__capturedEvents = [];
        window.posthog = {
          capture: (...args) => window.__capturedEvents.push(args),
        };
      `,
      contentType: 'application/javascript',
    });
  });
  await page.route('http://127.0.0.1:4173/analytics-fixture', async (route) => {
    await route.fulfill({
      body: `
        <meta name="posthog-project-key" content="phc_test" />
        <meta name="posthog-api-host" content="https://us.i.posthog.com" />
        <script src="/analytics.js"></script>
      `,
      contentType: 'text/html',
    });
  });

  await page.goto('/analytics-fixture');
  await expect.poll(() => page.evaluate(() => Array.isArray(window.__capturedEvents))).toBe(true);

  await page.evaluate(() => window.repocontextTrack('audience_changed', { audience: 'product' }));
  await expect
    .poll(() => page.evaluate(() => window.__capturedEvents))
    .toContainEqual(['audience_changed', { audience: 'product' }]);
});

test('keeps the primary content within the viewport', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('link', { name: 'View on GitHub', exact: true }).first()).toBeVisible();
});
