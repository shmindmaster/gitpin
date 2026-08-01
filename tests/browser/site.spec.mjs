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
  await expect(page.getByRole('tab', { name: 'Engineering managers' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#audience-question')).toHaveText('Did the agent cover every material file it changed?');

  await page.getByRole('tab', { name: 'Release owners' }).click();
  await expect(page.getByRole('tab', { name: 'Release owners' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toBeVisible();
  await expect(page.locator('#audience-question')).toHaveText(
    'Was this evidence generated for the exact pull-request head?',
  );
  await expect(page.locator('#audience-fact')).toHaveText(
    'Each locator is re-hashed at the full base or head commit SHA.',
  );
  await expect(page.locator('.evidence-id code')).toHaveText(evidenceSet);

  await page.getByRole('tab', { name: 'Release owners' }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Governance & review' })).toBeFocused();
  await expect(page.locator('#audience-fact')).toHaveText('Policy is loaded from the trusted base branch.');
  await expect(page.locator('.evidence-id code')).toHaveText(evidenceSet);

  await page.getByRole('tab', { name: 'Governance & review' }).press('Home');
  await expect(page.getByRole('tab', { name: 'Engineering managers' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Engineering managers' })).toHaveAttribute('aria-selected', 'true');
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

  await page.evaluate(() => window.gitpinTrack('audience_changed', { audience: 'release' }));
  await expect
    .poll(() => page.evaluate(() => window.__capturedEvents))
    .toContainEqual(['audience_changed', { audience: 'release' }]);
});

test('frames the gate for engineering, release, and governance owners', async ({ page }) => {
  await expect(page.getByRole('tablist', { name: 'PR evidence gate audience' })).toBeVisible();
  await expect(page.getByText('BASE POLICY · HEAD EVIDENCE')).toBeVisible();
  await expect(page.locator('.process')).toContainText('merge-base diff');
  await expect(page.locator('.process')).toContainText('exact base or head commit');
  await expect(page.locator('.safety')).toContainText('A pull request cannot weaken the policy used to judge itself.');
});

test('keeps the primary content within the viewport', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('link', { name: /View on GitHub/i }).first()).toBeVisible();
  await expect(page.locator('a[data-analytics="feedback_nav"]')).toHaveAttribute(
    'href',
    'https://github.com/shmindmaster/gitpin/issues/new?template=launch_feedback.md',
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://shmindmaster.github.io/gitpin/social-card.png',
  );
  await expect(page.getByRole('link', { name: /Add the PR gate/i })).toBeVisible();
});

test('launch-funnel analytics events only emit strict allowlisted payloads', async ({ page }) => {
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
  await page.route('http://127.0.0.1:4173/task-3-analytics-fixture', async (route) => {
    await route.fulfill({
      body: `
        <html>
          <head>
            <meta name="posthog-project-key" content="phc_test" />
            <meta name="posthog-api-host" content="https://us.i.posthog.com" />
          </head>
          <body>
            <a id="setup" data-analytics="setup_hero" data-analytics-event="setup_intent" data-analytics-prop-surface="hero" href="#">Start setup</a>
            <a id="progress" data-analytics="setup_guide" data-analytics-event="setup_progress" data-analytics-prop-step="open_setup_guide" href="#">Open setup guide</a>
            <a id="first-pass" data-analytics="first_pass" data-analytics-event="first_pass_intent" data-analytics-prop-phase="first_pass" href="#">Run first pass</a>
            <a id="pass-result" data-analytics="result_pass" data-analytics-event="gate_result_intent" data-analytics-prop-result="pass_demo" href="#">PASS result</a>
            <a id="fail-result" data-analytics="result_fail" data-analytics-event="gate_result_intent" data-analytics-prop-result="fail_demo" href="#">FAIL result</a>
            <a id="feedback" data-analytics="feedback_footer" data-analytics-event="feedback_intent" data-analytics-prop-surface="footer" href="#">Feedback</a>
            <a id="missing" data-analytics="setup_hero" data-analytics-event="setup_intent" href="#">Missing required surface</a>
            <a id="extra" data-analytics="setup_hero" data-analytics-event="setup_intent" data-analytics-prop-surface="hero" data-analytics-prop-extra="value" href="#">Extra property</a>
            <a id="invalid" data-analytics="invalid_event" data-analytics-event="forbidden_event" data-analytics-prop-surface="hero" href="#">Invalid</a>
            <a id="invalid-cta-extra-prop" data-analytics="feedback_footer" data-analytics-prop-surface="footer" href="#">CTA extra prop invalid</a>
            <script src="/analytics.js"></script>
          </body>
        </html>
      `,
      contentType: 'text/html',
    });
  });

  await page.goto('/task-3-analytics-fixture');
  await expect.poll(() => page.evaluate(() => Array.isArray(window.__capturedEvents))).toBe(true);

  await page.getByRole('link', { name: 'Start setup' }).click();
  await page.getByRole('link', { name: 'Open setup guide' }).click();
  await page.getByRole('link', { name: 'Run first pass' }).click();
  await page.getByRole('link', { name: 'PASS result' }).click();
  await page.getByRole('link', { name: 'FAIL result' }).click();
  await page.getByRole('link', { name: 'Feedback' }).click();
  await page.locator('#missing').click();
  await page.locator('#extra').click();
  await page.locator('#invalid').click();
  await page.locator('#invalid-cta-extra-prop').click();

  await expect
    .poll(() => page.evaluate(() => window.__capturedEvents))
    .toEqual([
      ['setup_intent', { surface: 'hero' }],
      ['setup_progress', { step: 'open_setup_guide' }],
      ['first_pass_intent', { phase: 'first_pass' }],
      ['gate_result_intent', { result: 'pass_demo' }],
      ['gate_result_intent', { result: 'fail_demo' }],
      ['feedback_intent', { surface: 'footer' }],
    ]);
});
