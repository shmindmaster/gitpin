import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const siteIndex = readFileSync(resolve(process.cwd(), 'site/index.html'), 'utf8');
const optOutStorageKey = 'gitpin.analytics.opt_out';
const sdkUrl = 'https://us-assets.i.posthog.com/static/array.js';
const captureUrl = 'https://us.i.posthog.com/e/';
const flagsUrl = 'https://us.i.posthog.com/flags/?v=2';
const canary = 'gitpin-private-canary-never-send';

const analyticsFixture = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="posthog-project-key" content="phc_test" />
      <meta name="posthog-api-host" content="https://us.i.posthog.com" />
    </head>
    <body>
      <section aria-labelledby="analytics-choice-heading">
        <h2 id="analytics-choice-heading">Website analytics choice</h2>
        <button type="button" data-analytics-opt-out>Turn off website analytics</button>
        <p role="status" data-analytics-opt-out-status></p>
      </section>
      <a
        id="setup"
        data-analytics="setup_hero"
        data-analytics-event="setup_intent"
        data-analytics-prop-surface="hero"
        href="#"
      >Start setup</a>
      <script src="/analytics.js"></script>
    </body>
  </html>
`;

function configuredIndex() {
  return siteIndex.replace(
    '<meta name="posthog-project-key" content="" />',
    '<meta name="posthog-project-key" content="phc_test" />',
  );
}

async function installInspectableAnalytics(page, fixtureHtml = analyticsFixture) {
  const sdkRequests = [];
  const captureRequests = [];
  const unexpectedPosthogRequests = [];

  page.on('request', (request) => {
    if (request.url() === sdkUrl) sdkRequests.push(request.url());
    if (request.url() === captureUrl) {
      captureRequests.push({
        body: request.postData() || '',
        method: request.method(),
      });
    }
    if (request.url().startsWith('https://us.i.posthog.com/') && request.url() !== captureUrl) {
      unexpectedPosthogRequests.push({ body: request.postData() || '', url: request.url() });
    }
  });

  await page.route(sdkUrl, async (route) => {
    await route.fulfill({
      body: `
        const queuedPosthog = window.posthog || [];
        const config = queuedPosthog._i?.[0]?.[1] || null;
        let optedOut = false;
        if (!config?.advanced_disable_flags) {
          fetch('${flagsUrl}', {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ token: 'phc_test', canary: '${canary}' }),
          });
        }
        window.posthog = {
          capture(eventName, properties) {
            if (optedOut) return;
            const enriched = {
              event: eventName,
              uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
              token: 'phc_test',
              distinct_id: 'anon_session_001',
              top_level_canary: '${canary}',
              properties: {
                ...properties,
                token: 'phc_test',
                distinct_id: 'anon_session_001',
                $session_id: 'session_abc1234567890',
                $process_person_profile: false,
                $current_url: 'https://example.com/private-path',
                referrer: 'https://example.com/private-referrer',
                browser: 'private-browser',
                device: 'private-device',
                canary: '${canary}',
              },
            };
            const filtered = config?.before_send ? config.before_send(enriched) : enriched;
            if (!filtered) return;
            fetch('${captureUrl}', {
              method: 'POST',
              mode: 'no-cors',
              body: JSON.stringify(filtered),
            });
          },
          opt_out_capturing() {
            optedOut = true;
          },
        };
      `,
      contentType: 'application/javascript',
    });
  });
  await page.route(captureUrl, async (route) => {
    await route.fulfill({ status: 200, body: 'ok', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('https://us.i.posthog.com/flags/**', async (route) => {
    await route.fulfill({ status: 200, body: '{}', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('http://127.0.0.1:4173/analytics-privacy-fixture', async (route) => {
    await route.fulfill({ body: fixtureHtml, contentType: 'text/html' });
  });

  return { captureRequests, sdkRequests, unexpectedPosthogRequests };
}

test('exposes a keyboard-operable persistent analytics opt-out on the homepage and privacy page', async ({ page }) => {
  await page.goto('/');
  const homepageControl = page.getByRole('button', { name: 'Turn off website analytics' });
  await expect(homepageControl).toBeVisible();
  await homepageControl.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-analytics-opt-out-status]')).toHaveText(
    'Website analytics are off on this browser.',
  );
  await expect(homepageControl).toBeDisabled();

  await page.goto('/privacy.html');
  const privacyControl = page.getByRole('button', { name: 'Turn off website analytics' });
  await expect(privacyControl).toBeVisible();
  await expect(privacyControl).toBeDisabled();
  await expect(page.locator('[data-analytics-opt-out-status]')).toHaveText(
    'Website analytics are off on this browser.',
  );
  expect(await page.evaluate((key) => localStorage.getItem(key), optOutStorageKey)).toBe('true');
});

test('does not load the PostHog SDK or capture when opt-out is already stored', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, 'true'), optOutStorageKey);
  const requests = await installInspectableAnalytics(page);

  await page.goto('/analytics-privacy-fixture');
  await page.getByRole('link', { name: 'Start setup' }).click();
  await page.waitForTimeout(100);

  expect(requests.sdkRequests).toEqual([]);
  expect(requests.captureRequests).toEqual([]);
  await expect(page.getByRole('status')).toHaveText('Website analytics are off on this browser.');
});

test('stops capture immediately after runtime opt-out', async ({ page }) => {
  const requests = await installInspectableAnalytics(page);
  await page.goto('/analytics-privacy-fixture');
  await expect.poll(() => requests.sdkRequests.length).toBe(1);

  await page.getByRole('link', { name: 'Start setup' }).click();
  await expect.poll(() => requests.captureRequests.length).toBe(1);
  await page.getByRole('button', { name: 'Turn off website analytics' }).press('Enter');
  await page.getByRole('link', { name: 'Start setup' }).click();
  await page.evaluate(() => window.gitpinTrack?.('setup_intent', { surface: 'hero' }));
  await page.waitForTimeout(100);

  expect(requests.captureRequests).toHaveLength(1);
  await expect(page.getByRole('status')).toHaveText('Website analytics are off on this browser.');
});

test('sends only the allowlisted payload with geo-IP enrichment disabled and no canary', async ({ page }) => {
  const requests = await installInspectableAnalytics(page);
  await page.goto('/analytics-privacy-fixture');
  await expect.poll(() => requests.sdkRequests.length).toBe(1);
  await page.getByRole('link', { name: 'Start setup' }).click();
  await expect.poll(() => requests.captureRequests.length).toBe(1);

  const request = requests.captureRequests[0];
  const payload = JSON.parse(request.body);
  expect(request.method).toBe('POST');
  expect(payload).toEqual({
    event: 'setup_intent',
    token: 'phc_test',
    distinct_id: 'anon_session_001',
    uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
    properties: {
      surface: 'hero',
      token: 'phc_test',
      distinct_id: 'anon_session_001',
      traffic_class: 'production',
      $geoip_disable: true,
      $session_id: 'session_abc1234567890',
      $process_person_profile: false,
    },
  });
  expect(request.body).not.toContain(canary);
  expect(request.body).not.toContain('current_url');
  expect(request.body).not.toContain('referrer');
  expect(request.body).not.toContain('browser');
  expect(request.body).not.toContain('device');
  expect(requests.unexpectedPosthogRequests).toEqual([]);
});

test('emits no capture request during the automatic hero playback', async ({ page }) => {
  const requests = await installInspectableAnalytics(page, configuredIndex());
  await page.goto('/analytics-privacy-fixture');
  await expect.poll(() => requests.sdkRequests.length).toBe(1);
  await expect(page.locator('[data-hero-demo]')).toHaveAttribute('data-hero-phase', 'pass', { timeout: 5_000 });
  await page.waitForTimeout(100);

  expect(requests.captureRequests).toEqual([]);
});

test('fails closed without loading or capture when preference storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    Storage.prototype.setItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
  });
  const requests = await installInspectableAnalytics(page);

  await page.goto('/analytics-privacy-fixture');
  await page.getByRole('link', { name: 'Start setup' }).click();
  await page.waitForTimeout(100);

  expect(requests.sdkRequests).toEqual([]);
  expect(requests.captureRequests).toEqual([]);
  await expect(page.getByRole('status')).toHaveText(
    'Website analytics are off because this browser cannot store the preference.',
  );
  await expect(page.getByRole('button', { name: 'Turn off website analytics' })).toBeDisabled();
});
