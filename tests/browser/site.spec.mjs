import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const heroArtifact = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/demos/pr-gate-fail-to-pass.artifact.json'), 'utf8'),
);
const siteIndex = readFileSync(resolve(process.cwd(), 'site/index.html'), 'utf8');
const siteApp = readFileSync(resolve(process.cwd(), 'site/app.js'), 'utf8');
const siteAnalytics = readFileSync(resolve(process.cwd(), 'site/analytics.js'), 'utf8');
const siteStyles = readFileSync(resolve(process.cwd(), 'site/styles.css'), 'utf8');

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
  await expect(page.locator('.terminal')).toContainText('shmindmaster/gitpin@v0.6.2');
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
  await expect(page.locator('.terminal')).toContainText('uses: shmindmaster/gitpin@v0.6.2');
  await expect(page.locator('.terminal')).toContainText('contents: read');
  await expect(page.getByRole('link', { name: 'Open the complete setup guide' })).toHaveAttribute(
    'href',
    'https://github.com/shmindmaster/gitpin/blob/main/docs/pr-evidence-gate.md',
  );
  await expect(page.getByText(/Keep retrieval local with the optional MCP server/)).toBeVisible();
});

test('renders a finite, artifact-derived fail-to-pass hero with keyboard controls', async ({ page }) => {
  const coverage = heroArtifact.passCase.coverage;
  const demo = page.locator('[data-hero-demo]');
  const replay = page.getByRole('button', { name: 'Replay gate walkthrough', exact: true });
  const play = page.getByRole('button', { name: 'Play gate walkthrough', exact: true });
  const pause = page.getByRole('button', { name: 'Pause gate walkthrough', exact: true });

  await expect(demo).toBeVisible();
  await expect(demo).toContainText(coverage.path);
  await expect(demo).toContainText(String(coverage.lineStart));
  await expect(demo).toContainText(coverage.sha);
  await expect(demo).toContainText(coverage.contentSha256);
  await expect(page.locator('[data-hero-summary]')).toContainText(heroArtifact.accessibility.caption);

  await replay.click();
  await expect(demo).toHaveAttribute('data-hero-phase', 'material');
  await play.press('Enter');
  await expect(demo).toHaveAttribute('data-hero-phase', 'uncovered');
  await pause.press('Space');
  await expect(demo).toHaveAttribute('data-hero-paused', 'true');
  await play.click();
  await expect(demo).toHaveAttribute('data-hero-phase', 'evidence');
  await expect(demo).toHaveAttribute('data-hero-phase', 'pass', { timeout: 5_000 });
  await expect(demo).toHaveAttribute('data-hero-complete', 'true');
  await expect(pause).toBeDisabled();
});

test('loads the hero artifact from the GitHub Pages project subpath', async ({ page }) => {
  const artifactRequests = [];
  await page.route('**/gitpin/', async (route) => {
    await route.fulfill({ body: siteIndex, contentType: 'text/html' });
  });
  await page.route('**/gitpin/app.js', async (route) => {
    await route.fulfill({ body: siteApp, contentType: 'text/javascript' });
  });
  await page.route('**/gitpin/analytics.js', async (route) => {
    await route.fulfill({ body: siteAnalytics, contentType: 'text/javascript' });
  });
  await page.route('**/gitpin/styles.css', async (route) => {
    await route.fulfill({ body: siteStyles, contentType: 'text/css' });
  });
  await page.route('**/gitpin/_gitpin-artifacts/pr-gate-fail-to-pass.artifact.json', async (route) => {
    artifactRequests.push(route.request().url());
    await route.fulfill({ body: JSON.stringify(heroArtifact), contentType: 'application/json' });
  });

  await page.goto('/gitpin/');
  await expect(page.locator('[data-hero-demo]')).toContainText(heroArtifact.fixture.changedPath);
  expect(artifactRequests).toEqual([
    'http://127.0.0.1:4173/gitpin/_gitpin-artifacts/pr-gate-fail-to-pass.artifact.json',
  ]);
});

test('keeps the active tab as the tabpanel name and the artifact summary as its description', async ({ page }) => {
  const panel = page.getByRole('tabpanel');
  const summary = page.locator('#hero-walkthrough-summary');

  await expect(panel).toHaveAttribute('aria-labelledby', 'tab-engineering');
  await expect(panel).not.toHaveAttribute('aria-label');
  await expect(panel).toHaveAttribute('aria-describedby', 'hero-walkthrough-summary');
  await expect(summary).toHaveText(heroArtifact.accessibility.caption);
  await page.getByRole('tab', { name: 'Release owners' }).click();
  await expect(panel).toHaveAttribute('aria-labelledby', 'tab-release');
  await expect(panel).not.toHaveAttribute('aria-label');
});

test('bails out cleanly and clears busy state when a required hero node is missing', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/hero-missing-node-fixture', async (route) => {
    await route.fulfill({
      body: siteIndex.replace(' data-hero-play', ''),
      contentType: 'text/html',
    });
  });

  await page.goto('/hero-missing-node-fixture');
  await expect(page.locator('[data-hero-demo]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-hero-demo]')).toHaveAttribute('data-hero-unavailable', 'true');
  expect(pageErrors).toEqual([]);
});

test('loads and remains operable without IntersectionObserver', async ({ page }) => {
  await page.addInitScript(() => {
    delete window.IntersectionObserver;
  });
  await page.reload();

  const demo = page.locator('[data-hero-demo]');
  const replay = page.getByRole('button', { name: 'Replay gate walkthrough', exact: true });
  const play = page.getByRole('button', { name: 'Play gate walkthrough', exact: true });
  await expect(demo).toContainText(heroArtifact.fixture.changedPath);
  await replay.click();
  await play.click();
  await expect(demo).toHaveAttribute('data-hero-phase', 'uncovered');
});

test('exposes the walkthrough controls as a named group', async ({ page }) => {
  const controls = page.getByRole('group', { name: 'Gate walkthrough controls' });
  await expect(controls).toBeVisible();
  await expect(controls.getByRole('button')).toHaveCount(3);
});

test('pauses the hero walkthrough outside the viewport without shifting page layout', async ({ page }) => {
  const demo = page.locator('[data-hero-demo]');
  const replay = page.getByRole('button', { name: 'Replay gate walkthrough', exact: true });
  const play = page.getByRole('button', { name: 'Play gate walkthrough', exact: true });
  const before = await demo.boundingBox();

  await replay.click();
  await play.click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(demo).toHaveAttribute('data-hero-paused', 'true');
  await page.evaluate(() => window.scrollTo(0, 0));

  const after = await demo.boundingBox();

  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBeCloseTo(before?.height ?? 0, 3);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('pauses the hero walkthrough when the visible document becomes hidden', async ({ page }) => {
  const demo = page.locator('[data-hero-demo]');
  const replay = page.getByRole('button', { name: 'Replay gate walkthrough', exact: true });
  const play = page.getByRole('button', { name: 'Play gate walkthrough', exact: true });

  await expect(demo).toBeInViewport();
  await replay.click();
  await play.click();
  await expect(demo).toHaveAttribute('data-hero-phase', 'uncovered');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(demo).toHaveAttribute('data-hero-paused', 'true');
  await page.waitForTimeout(1_000);
  await expect(demo).toHaveAttribute('data-hero-phase', 'uncovered');
});

test('uses the real configured analytics transport and emits no autoplay analytics', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.route('https://us-assets.i.posthog.com/static/array.js', async (route) => {
    await route.fulfill({
      body: `
        window.__capturedAnalytics = [];
        window.posthog.capture = (...args) => window.__capturedAnalytics.push(args);
      `,
      contentType: 'application/javascript',
    });
  });
  await page.route('**/analytics-hero-fixture', async (route) => {
    await route.fulfill({
      body: siteIndex.replace(
        '<meta name="posthog-project-key" content="" />',
        '<meta name="posthog-project-key" content="phc_test" />',
      ),
      contentType: 'text/html',
    });
  });
  await page.goto('/analytics-hero-fixture');
  await expect.poll(() => page.evaluate(() => typeof window.gitpinTrack)).toBe('function');
  await expect.poll(() => page.evaluate(() => Array.isArray(window.__capturedAnalytics))).toBe(true);
  await expect(page.locator('[data-hero-demo]')).toHaveAttribute('data-hero-phase', 'pass', { timeout: 5_000 });
  expect(await page.evaluate(() => window.__capturedAnalytics)).toEqual([]);
  await context.close();
});

test('uses a complete static before-and-after hero under reduced motion', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto('/');

  const demo = page.locator('[data-hero-demo]');
  await expect(demo).toHaveAttribute('data-hero-reduced-motion', 'true');
  await expect(demo).toHaveAttribute('data-hero-phase', 'pass');
  await expect(demo).toContainText(heroArtifact.failCase.message);
  await expect(demo).toContainText(heroArtifact.passCase.message);
  await context.close();
});

test('keeps the product walkthrough visible on wide, tablet, and mobile viewports', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 820, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const consoleBox = await page.locator('[data-hero-demo]').boundingBox();
    expect(consoleBox).not.toBeNull();
    expect(consoleBox?.y).toBeGreaterThanOrEqual(0);
    expect(consoleBox?.y).toBeLessThan(viewport.height);
    expect((consoleBox?.y ?? viewport.height) + Math.min(consoleBox?.height ?? 0, 160)).toBeLessThanOrEqual(
      viewport.height,
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test('publishes a narrow, accessible privacy statement', async ({ page }) => {
  await page.goto('/privacy.html');
  await expect(page).toHaveTitle(/Privacy/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy at GitPin');
  await expect(page.getByText('The CLI and MCP transports do not send telemetry.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to GitPin', exact: true })).toHaveAttribute('href', './');
});

test('switches audience presentation while preserving the evidence set', async ({ page }) => {
  const evidenceSet = page.locator('.evidence-id code');
  await expect(evidenceSet).toHaveText('8e44b735…be61');
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
  await expect(evidenceSet).toHaveText('8e44b735…be61');

  await page.getByRole('tab', { name: 'Release owners' }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Governance & review' })).toBeFocused();
  await expect(page.locator('#audience-fact')).toHaveText('Policy is loaded from the trusted base branch.');
  await expect(evidenceSet).toHaveText('8e44b735…be61');

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

test('launch-funnel analytics accepts SDK-shaped events without timestamps and emits only strict allowlisted payloads', async ({
  page,
}) => {
  await page.route('https://us-assets.i.posthog.com/static/array.js', async (route) => {
    await route.fulfill({
      body: `
        const posthog = window.posthog || [];
        window.posthog = posthog;
        if (!Array.isArray(posthog._i)) posthog._i = [];
        window.__posthogInitConfig = posthog._i?.[0]?.[1] || null;
        window.__capturedEvents = [];
        const getPosthogConfig = () =>
          window.__posthogInitConfig || window.posthog?._i?.[0]?.[1] || null;
        const applyBeforeSend = (payload) => {
          const config = getPosthogConfig();
          const beforeSend = config?.before_send;
          return beforeSend ? beforeSend(payload) : payload;
        };
        posthog.capture = (...args) => {
          const [eventName, properties] = args;
          const payload = {
            event: eventName,
            uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
            token: 'phc_test',
            distinct_id: 'anon_session_001',
            ip: '127.0.0.1',
            top_level_secret: 'must-be-dropped',
            properties: {
              ...properties,
              $current_url: 'https://example.com/page',
              $pageview: false,
              $lib: 'js',
              current_url: 'https://example.com/page',
              page_url: 'https://example.com/page',
              url: 'https://example.com/page?sample=1',
              referrer: 'https://example.com/entry',
              host: 'example.com',
              browser: 'chromium',
              device: 'desktop',
              screen: '1920x1080',
              os: 'macOS',
              ip: '127.0.0.1',
              screen_resolution: '1920x1080',
              app_version: '1.2.3',
              referrer_url: 'https://example.com/previous',
              $session_id: 'session_abc1234567890',
              $process_person_profile: false,
            },
          };
          const filtered = applyBeforeSend(payload);
          if (filtered?.properties?.token && filtered?.properties?.distinct_id) {
            window.__capturedEvents.push(filtered);
          }
        };
        posthog.init = (key, config) => {
          posthog._i.push([key, config]);
          window.__posthogInitConfig = config;
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
            <a id="progress" data-analytics="setup_guide" data-analytics-event="setup_guide_intent" data-analytics-prop-step="open_setup_guide" href="#">Open setup guide</a>
            <a id="sample-view" data-analytics="first_pass" data-analytics-event="sample_view_intent" data-analytics-prop-phase="sample_view" href="#">View sample</a>
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
  await page.getByRole('link', { name: 'View sample' }).click();
  await page.getByRole('link', { name: 'PASS result' }).click();
  await page.getByRole('link', { name: 'FAIL result' }).click();
  await page.getByRole('link', { name: 'Feedback' }).click();
  await page.locator('#missing').click();
  await page.locator('#extra').click();
  await page.locator('#invalid').click();
  await page.locator('#invalid-cta-extra-prop').click();

  await expect
    .poll(async () => page.evaluate(() => window.__capturedEvents.filter(Boolean)))
    .toEqual([
      {
        event: 'setup_intent',
        token: 'phc_test',
        distinct_id: 'anon_session_001',
        uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
        properties: {
          surface: 'hero',
          token: 'phc_test',
          distinct_id: 'anon_session_001',
          $session_id: 'session_abc1234567890',
          $process_person_profile: false,
          traffic_class: 'production',
          $geoip_disable: true,
        },
      },
      {
        event: 'setup_guide_intent',
        token: 'phc_test',
        distinct_id: 'anon_session_001',
        uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
        properties: {
          step: 'open_setup_guide',
          token: 'phc_test',
          distinct_id: 'anon_session_001',
          $session_id: 'session_abc1234567890',
          $process_person_profile: false,
          traffic_class: 'production',
          $geoip_disable: true,
        },
      },
      {
        event: 'sample_view_intent',
        token: 'phc_test',
        distinct_id: 'anon_session_001',
        uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
        properties: {
          phase: 'sample_view',
          token: 'phc_test',
          distinct_id: 'anon_session_001',
          $session_id: 'session_abc1234567890',
          $process_person_profile: false,
          traffic_class: 'production',
          $geoip_disable: true,
        },
      },
      {
        event: 'gate_result_intent',
        token: 'phc_test',
        distinct_id: 'anon_session_001',
        uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
        properties: {
          result: 'pass_demo',
          token: 'phc_test',
          distinct_id: 'anon_session_001',
          $session_id: 'session_abc1234567890',
          $process_person_profile: false,
          traffic_class: 'production',
          $geoip_disable: true,
        },
      },
      {
        event: 'gate_result_intent',
        token: 'phc_test',
        distinct_id: 'anon_session_001',
        uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
        properties: {
          result: 'fail_demo',
          token: 'phc_test',
          distinct_id: 'anon_session_001',
          $session_id: 'session_abc1234567890',
          $process_person_profile: false,
          traffic_class: 'production',
          $geoip_disable: true,
        },
      },
      {
        event: 'feedback_intent',
        token: 'phc_test',
        distinct_id: 'anon_session_001',
        uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
        properties: {
          surface: 'footer',
          token: 'phc_test',
          distinct_id: 'anon_session_001',
          $session_id: 'session_abc1234567890',
          $process_person_profile: false,
          traffic_class: 'production',
          $geoip_disable: true,
        },
      },
    ]);

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const keys = Object.keys(window.__capturedEvents?.[0]?.properties || {});
        const sensitiveKeys = [
          'url',
          'referrer',
          'host',
          'browser',
          'device',
          'screen',
          'screen_resolution',
          'ip',
          'current_url',
          'page_url',
          'url',
          'referrer',
          '$current_url',
          '$pageview',
          '$lib',
          'app_version',
          'referrer_url',
        ];
        return {
          hasSensitiveKeys: keys.some((key) => sensitiveKeys.includes(key)),
          keys,
        };
      }),
    )
    .toEqual({
      hasSensitiveKeys: false,
      keys: [
        'surface',
        'token',
        'distinct_id',
        'traffic_class',
        '$geoip_disable',
        '$session_id',
        '$process_person_profile',
      ],
    });

  const capturedEvents = await page.evaluate(() =>
    window.__capturedEvents.filter(Boolean).map((event) => Object.keys(event.properties || {})),
  );
  expect(capturedEvents).toEqual([
    ['surface', 'token', 'distinct_id', 'traffic_class', '$geoip_disable', '$session_id', '$process_person_profile'],
    ['step', 'token', 'distinct_id', 'traffic_class', '$geoip_disable', '$session_id', '$process_person_profile'],
    ['phase', 'token', 'distinct_id', 'traffic_class', '$geoip_disable', '$session_id', '$process_person_profile'],
    ['result', 'token', 'distinct_id', 'traffic_class', '$geoip_disable', '$session_id', '$process_person_profile'],
    ['result', 'token', 'distinct_id', 'traffic_class', '$geoip_disable', '$session_id', '$process_person_profile'],
    ['surface', 'token', 'distinct_id', 'traffic_class', '$geoip_disable', '$session_id', '$process_person_profile'],
  ]);

  const topLevelKeys = await page.evaluate(() => Object.keys(window.__capturedEvents[0]).sort());
  expect(topLevelKeys).toEqual(['distinct_id', 'event', 'properties', 'token', 'uuid']);

  const propertyFallback = await page.evaluate(() =>
    window.__posthogInitConfig?.before_send?.({
      event: 'setup_intent',
      uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
      properties: {
        surface: 'hero',
        token: 'phc_test',
        distinct_id: 'anon_session_001',
      },
    }),
  );
  expect(propertyFallback).toEqual({
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
    },
  });

  const invalidOutbound = await page.evaluate(() =>
    window.__posthogInitConfig?.before_send?.({
      event: 'setup_intent',
      uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
      timestamp: new Date('2026-07-31T12:00:00.000Z'),
      properties: {
        surface: 'secret-value',
        token: 'phc_test',
        distinct_id: 'anon_session_001',
        $session_id: 'session_abc1234567890',
      },
    }),
  );
  expect(invalidOutbound).toBeNull();

  const invalidTransport = await page.evaluate(() =>
    window.__posthogInitConfig?.before_send?.({
      event: 'setup_intent',
      uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
      timestamp: new Date('2026-07-31T12:00:00.000Z'),
      properties: {
        surface: 'hero',
        token: 'phc_wrong',
        distinct_id: 'anon_session_001',
        $session_id: 'session_abc1234567890',
      },
    }),
  );
  expect(invalidTransport).toBeNull();

  const invalidDistinctId = await page.evaluate(() =>
    window.__posthogInitConfig?.before_send?.({
      event: 'setup_intent',
      uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
      timestamp: new Date('2026-07-31T12:00:00.000Z'),
      properties: {
        surface: 'hero',
        token: 'phc_test',
        distinct_id: 'email@example.com',
        $session_id: 'session_abc1234567890',
      },
    }),
  );
  expect(invalidDistinctId).toBeNull();

  const invalidSession = await page.evaluate(() =>
    window.__posthogInitConfig?.before_send?.({
      event: 'setup_intent',
      uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
      timestamp: new Date('2026-07-31T12:00:00.000Z'),
      properties: {
        surface: 'hero',
        token: 'phc_test',
        distinct_id: 'anon_session_001',
        $session_id: 'x'.repeat(300),
      },
    }),
  );
  expect(invalidSession).toBeNull();

  const invalidEventMetadata = await page.evaluate(() =>
    window.__posthogInitConfig?.before_send?.({
      event: 'setup_intent',
      uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
      timestamp: 'not-a-timestamp',
      properties: {
        surface: 'hero',
        token: 'phc_test',
        distinct_id: 'anon_session_001',
      },
    }),
  );
  expect(invalidEventMetadata).toBeNull();

  await expect
    .poll(() => page.evaluate(() => window.__posthogInitConfig))
    .toEqual(
      expect.objectContaining({
        capture_pageview: false,
        capture_pageleave: false,
      }),
    );
});

test('launch-funnel analytics drops events only for automation + explicit test-traffic marker', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => true,
      configurable: true,
    });
  });
  await page.route('https://us-assets.i.posthog.com/static/array.js', async (route) => {
    await route.fulfill({
      body: `
        const posthog = window.posthog || [];
        window.posthog = posthog;
        if (!Array.isArray(posthog._i)) posthog._i = [];
        window.__posthogInitConfig = posthog._i?.[0]?.[1] || null;
        window.__capturedEvents = [];
        const getPosthogConfig = () =>
          window.__posthogInitConfig || window.posthog?._i?.[0]?.[1] || null;
        const applyBeforeSend = (payload) => {
          const config = getPosthogConfig();
          const beforeSend = config?.before_send;
          return beforeSend ? beforeSend(payload) : payload;
        };
        posthog.capture = (...args) => {
          const [eventName, properties] = args;
          const payload = {
            event: eventName,
            uuid: '018f3f9a-7b2c-7def-8123-456789abcdef',
            timestamp: new Date('2026-07-31T12:00:00.000Z'),
            properties: {
              ...properties,
              token: 'phc_test',
              distinct_id: 'anon_session_001',
              $session_id: 'session_abc1234567890',
              $process_person_profile: false,
            },
          };
          const filtered = applyBeforeSend(payload);
          if (filtered) window.__capturedEvents.push(filtered);
        };
        posthog.init = (key, config) => {
          posthog._i.push([key, config]);
          window.__posthogInitConfig = config;
        };
      `,
      contentType: 'application/javascript',
    });
  });
  await page.route('**/task-3-analytics-fixture-auto*', async (route) => {
    await route.fulfill({
      body: `
        <html>
          <head>
            <meta name="posthog-project-key" content="phc_test" />
            <meta name="posthog-api-host" content="https://us.i.posthog.com" />
          </head>
          <body>
            <a id="setup" data-analytics="setup_hero" data-analytics-event="setup_intent" data-analytics-prop-surface="hero" href="#">Start setup</a>
            <script src="/analytics.js"></script>
          </body>
        </html>
      `,
      contentType: 'text/html',
    });
  });

  await page.goto('/task-3-analytics-fixture-auto');
  await page.getByRole('link', { name: 'Start setup' }).click();
  await expect.poll(() => page.evaluate(() => window.__capturedEvents.length)).toEqual(1);

  await page.evaluate(() => {
    window.__capturedEvents = [];
  });
  await page.goto('/task-3-analytics-fixture-auto?gitpin_test_traffic=true');
  await page.getByRole('link', { name: 'Start setup' }).click();
  await expect.poll(() => page.evaluate(() => window.__capturedEvents.length)).toEqual(0);

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true,
    });
    window.__capturedEvents = [];
    delete window.__posthogInitConfig;
    delete window.posthog._i;
  });
  await page.goto('/task-3-analytics-fixture-auto');
  await page.getByRole('link', { name: 'Start setup' }).click();
  await expect.poll(() => page.evaluate(() => window.__capturedEvents.length)).toEqual(1);
  await expect
    .poll(() => page.evaluate(() => window.__capturedEvents[0]?.properties?.traffic_class))
    .toEqual('production');

  await page.evaluate(() => {
    window.__capturedEvents = [];
  });
  await page.goto('/task-3-analytics-fixture-auto?gitpin_test_traffic=true');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true,
    });
  });
  await page.getByRole('link', { name: 'Start setup' }).click();
  await expect.poll(() => page.evaluate(() => window.__capturedEvents.length)).toEqual(1);
  await expect
    .poll(() => page.evaluate(() => window.__capturedEvents[0]?.properties?.traffic_class))
    .toEqual('synthetic_qa');
});

test('launch-funnel SVG text stays inside panels and text blocks do not overlap', async ({ page }) => {
  const svg = readFileSync(resolve(process.cwd(), 'docs/demos/pr-gate-fail-to-pass.svg'), 'utf8');
  await page.setContent(`<html><body>${svg}</body></html>`);
  await expect(page.locator('svg')).toBeVisible();

  const summary = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    const svgRect = svg.getBoundingClientRect();
    const panels = Array.from(svg.querySelectorAll('g[data-panel-width][data-panel-height]'));
    const panelChecks = [];
    const overlap = [];

    for (const panel of panels) {
      const panelRect = panel.querySelector('rect').getBoundingClientRect();
      const texts = Array.from(panel.querySelectorAll('text'));
      const bounds = [];
      const violations = [];

      for (const text of texts) {
        const b = text.getBoundingClientRect();
        bounds.push(b);
        if (b.left < panelRect.left - 0.5 || b.top < panelRect.top - 0.5) {
          violations.push(`underflow-${text.textContent}`);
        }
        if (b.right > panelRect.right + 0.5 || b.bottom > panelRect.bottom + 0.5) {
          violations.push(`overflow-${text.textContent}`);
        }
      }

      for (let i = 0; i < bounds.length; i += 1) {
        for (let j = i + 1; j < bounds.length; j += 1) {
          const a = bounds[i];
          const b = bounds[j];
          const intersects = !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
          if (intersects) {
            overlap.push(`panel-${panel.id}-overlap`);
          }
        }
      }

      panelChecks.push({
        id: panel.id,
        violations,
      });
    }

    const overflow = Array.from(document.querySelectorAll('text')).some((text) => {
      const b = text.getBoundingClientRect();
      return (
        b.left < svgRect.left - 0.5 ||
        b.top < svgRect.top - 0.5 ||
        b.right > svgRect.right + 0.5 ||
        b.bottom > svgRect.bottom + 0.5
      );
    });

    return {
      overflow,
      panelChecks,
      overlapCount: overlap.length,
    };
  });

  expect(summary?.overflow).toBe(false);
  expect(summary?.overlapCount).toBe(0);
  expect(summary?.panelChecks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'phase-a-(fail)',
        violations: [],
      }),
      expect.objectContaining({
        id: 'phase-b-(pass)',
        violations: [],
      }),
    ]),
  );
});
