import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors = [];
  const failedRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => {
    const resourceType = request.resourceType();
    if (resourceType === 'document' || resourceType === 'script' || resourceType === 'stylesheet') {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`);
    }
  });
  await page.goto('/');
  await expect(page).toHaveTitle(/GitPin/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Make agent-authored changes show exact evidence before merge.',
  );
  expect(errors, `console errors: ${errors.join('; ')}`).toEqual([]);
  expect(failedRequests, `failed network: ${failedRequests.join('; ')}`).toEqual([]);
});

test('presents the release path and safety boundary without analytics by default', async ({ page }) => {
  const analyticsRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('posthog')) analyticsRequests.push(request.url());
  });

  await expect(page.getByText(/Read-only\. Base-trusted\. Full SHAs\./)).toBeVisible();
  await expect(page.getByText(/No arbitrary command execution/)).toBeVisible();
  const menu = page.getByRole('button', { name: /navigation/i });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Safety', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A deliberately narrow trust boundary.' })).toBeVisible();
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Install', exact: true }).click();
  await expect(page.locator('.terminal')).toContainText('shmindmaster/gitpin@v0.6.0');
  await expect(page.locator('body')).not.toContainText(/release candidate/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://shmindmaster.github.io/gitpin/');
  await expect(page.getByRole('link', { name: 'Privacy', exact: true })).toHaveAttribute('href', './privacy.html');
  await expect(
    page.getByText('Maintained by Sarosh Hussain. Pendoah is his company and operating context.'),
  ).toBeVisible();
  expect(analyticsRequests).toEqual([]);
});

test('makes the pull-request gate the primary activation path', async ({ page }) => {
  const primaryAction = page.getByRole('link', { name: /Add the PR gate/i });
  await expect(primaryAction).toHaveAttribute('href', '#install');
  await primaryAction.click();
  await expect(page.getByRole('heading', { name: 'Require evidence before merge.' })).toBeVisible();
  await expect(page.locator('.terminal')).toContainText('pull_request:');
  await expect(page.locator('.terminal')).toContainText('runs-on: ubuntu-latest');
  await expect(page.locator('.terminal')).toContainText('uses: shmindmaster/gitpin@v0.6.0');
  await expect(page.locator('.terminal')).toContainText('contents: read');
  await expect(page.getByRole('link', { name: 'Open the complete setup guide' })).toHaveAttribute(
    'href',
    'https://github.com/shmindmaster/gitpin/blob/main/docs/pr-evidence-gate.md',
  );
  await expect(page.getByText(/Keep retrieval local with the optional MCP server/)).toBeVisible();
});

test('publishes a narrow, accessible privacy statement', async ({ page }) => {
  await page.goto('/privacy.html');
  await expect(page).toHaveTitle(/Privacy/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy at GitPin');
  await expect(page.getByText('The CLI and MCP transports do not send telemetry.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to GitPin', exact: true })).toHaveAttribute('href', './');
});

test('switches audience presentation while preserving the evidence set', async ({ page }) => {
  const evidenceSet = await page.locator('.evidence-id code').textContent();
  await page.getByRole('tab', { name: 'Product' }).click();
  await expect(page.getByRole('tab', { name: 'Product' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toBeVisible();
  await expect(page.locator('#audience-question')).toHaveText('What can users trust in an EvidenceBrief?');
  await expect(page.locator('.evidence-id code')).toHaveText(evidenceSet);

  await page.getByRole('tab', { name: 'Product' }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Operations' })).toBeFocused();
  await expect(page.locator('#audience-fact')).toHaveText('HTTP snapshots contain documentation and manifests only.');
  await expect(page.locator('.evidence-id code')).toHaveText(evidenceSet);

  await page.getByRole('tab', { name: 'Operations' }).press('Home');
  await expect(page.getByRole('tab', { name: 'Technical' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Technical' })).toHaveAttribute('aria-selected', 'true');
});

test('supports skip-to-content and mobile navigation state transitions', async ({ page }) => {
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toHaveAttribute('href', '#main');
  // Focus the skip target explicitly: WebKit does not always place first-Tab on the
  // visually-hidden skip link the same way Chromium does, but it must remain operable.
  await skip.focus();
  await expect(skip).toBeFocused();
  await skip.press('Enter');
  await expect(page.locator('#main')).toBeVisible();
  await expect(page.locator('#main')).toBeInViewport();

  const menu = page.getByRole('button', { name: /navigation/i });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
  }
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

  await page.evaluate(() => window.gitpinTrack('audience_changed', { audience: 'product' }));
  await expect
    .poll(() => page.evaluate(() => window.__capturedEvents))
    .toContainEqual(['audience_changed', { audience: 'product' }]);
});

test('keeps the primary content within the viewport', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('link', { name: /View on GitHub/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Add the PR gate/i })).toBeVisible();
});
