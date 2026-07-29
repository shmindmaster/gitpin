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
  await expect(page.locator('.terminal')).toContainText('node dist/server.js doctor');
  expect(analyticsRequests).toEqual([]);
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

test('keeps the primary content within the viewport', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('link', { name: 'View on GitHub', exact: true }).first()).toBeVisible();
});
