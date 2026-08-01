# Website and analytics

GitPin ships a static public site in `site/`. It leads with the required PR evidence gate, explains the trust boundary, demonstrates the local EvidenceBrief companion, and links directly to source setup and contributor documentation.

The source in this repository is the GitPin 0.6.2 website release candidate. The previous immutable release remains published until Pages deployment and production verification establish 0.6.2.

The deployable surface includes a privacy page, canonical and social metadata, `robots.txt`, and a sitemap for the GitHub Pages URL. These are static release artifacts; they do not change the MCP server's read-only boundary.

## Local verification

```bash
pnpm site:serve
pnpm site:test
pnpm site:build
```

`site:test` runs the critical navigation, audience-switching, keyboard, responsive, and no-analytics-by-default paths in Chromium, Firefox, WebKit, and mobile Chromium. Playwright is the only website development dependency; it exists to make that browser matrix repeatable in CI.

## Deployment

The `Deploy website` workflow is manual so merging source cannot publish a public site accidentally.

1. Configure GitHub Pages to use GitHub Actions.
2. Optionally create a dedicated `GitPin` PostHog project and enable its cookieless server-hash mode.
3. Set the repository variable `POSTHOG_GITPIN_PROJECT_KEY` to that project's `phc_` key.
4. Run the `Deploy website` workflow.
5. Add a custom domain only after DNS ownership is confirmed.

The build succeeds with analytics disabled when the variable is absent. Repository source and unconfigured build
output keep both analytics meta values empty. When the variable is present, the builder injects the same dedicated
project key and API host into every HTML page that loads the analytics script, including the homepage and privacy page.

## Analytics boundary

Use one PostHog project per application. Do not send GitPin events to a portfolio-wide or another product's project.

Website collection is intentionally narrow:

| Event | Properties |
| --- | --- |
| `cta_clicked` | `placement` only (`feedback_footer`, `feedback_footer_nav`, `feedback_nav`, `github_footer`, `github_hero`, `github_nav`, `setup_hero`) |
| `setup_intent` | `surface` only (`hero`, `navigation`) |
| `setup_guide_intent` | `step` only (`open_setup_guide`) |
| `gate_result_intent` | `result` only (`fail_demo`, `pass_demo`) |
| `sample_view_intent` | `phase` only (`sample_view`) |
| `audience_changed` | `audience` only |
| `feedback_intent` | `surface` only (`footer`, `footer_nav`, `feedback_nav`, `feedback_footer`, `feedback_footer_nav`, `navigation`) |

Autocapture, pageview/pageleave capture, feature flags and remote configuration, and session replay are disabled,
person profiles are never created, and the site uses cookieless mode. Disabling feature flags prevents the SDK from
making an initialization-time `/flags` request outside the explicit launch-funnel event transport.

Launch-funnel transport fields are explicit and constrained before `before_send` strips SDK enrichment:

- allowlisted event name and its single allowlisted launch-funnel property,
- public PostHog project key in `token` (must match the configured `posthog-project-key`; this is not a secret),
- anonymous `distinct_id`,
- optional `$session_id` (if session analysis is active),
- optional `$process_person_profile` (SDK-required process-person flag only),
- `$geoip_disable: true` to instruct PostHog not to enrich the event through GeoIP,
- optional `traffic_class`, constrained to `production` or `synthetic_qa`,
- event timestamp,
- SDK-generated event UUID used for deduplication.

The outbound event object is not sent with URL/referrer/host/browser/device/screen context.

The browser-level `$geoip_disable: true` control is active in every permitted event. The separate PostHog
project-level setting that discards raw IP addresses is still pending independent verification, so GitPin does not
claim server-side raw-IP discard yet.

## Browser opt-out

The homepage and privacy page expose a native, keyboard-operable **Turn off website analytics** control. Its
preference is stored in the browser until site data is cleared. A stored opt-out prevents the PostHog SDK from loading
on later visits; activating the control also stops subsequent capture immediately in the current page. If browser
preference storage cannot be read, written, or cleaned up, the site fails closed and does not load analytics. The
startup check uses a fixed, non-identifying probe key and never changes the stored opt-out value. If storage later becomes
unavailable during the button action, capture still stops for the current page and the status reports that persistence
was unavailable.

This browser control does not alter the PostHog project configuration. Clearing site storage clears the browser
choice, so the control does not promise a permanent opt-out.

Test-traffic suppression is explicitly bounded to:

- automated signal detected (`navigator.webdriver`, headless, Playwright, etc.),
- plus explicit test marker (`gitpin_test_traffic=true` query flag or `window.__gitpinTestTraffic === true`).

Every browser capture defaults to `traffic_class: production`. An explicit `gitpin_test_traffic=true` marker labels a human QA capture as `traffic_class: synthetic_qa`; if that same marker is present for an automated visitor, the event remains suppressed. Ordinary QA or unmarked automation traffic is not treated as automatically detectable test traffic.

The launch-funnel schema is strict by design: only enumerated event names and enumerated property values are recorded.
No repository contents, filesystem paths, prompt text, URLs, secret tokens, account identifiers, or free-text answers are sent. The only identifiers retained are the cookieless anonymous `distinct_id`, optional anonymous `$session_id`, and per-event deduplication UUID described above.

Only intent surfaces are observed here:
- site `feedback_*` clicks indicate intent to report friction,
- `setup_guide_intent` and `sample_view_intent` clicks indicate setup-guide navigation and sample-view intent,
- `gate_result_intent` clicks indicate a result check was consulted.
Clicks do not prove GitHub Action installation or pass/fail status; they are not equivalent to completed setup.

For launch inference, the product boundary remains:
- instrumentation: only what is in this event schema (no automatic pageview/page context)
- observed behavior: sessioned counts of event progression and latency windows
- inferred adoption: inferred from post-session interpretation, with confidence tags
- PMF: deferred until approved synthetic and real sessions are completed

The CLI, stdio MCP server, HTTP MCP server, package verifier, and container send no telemetry.
