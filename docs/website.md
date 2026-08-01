# Website and analytics

GitPin ships a static public site in `site/`. It leads with the required PR evidence gate, explains the trust boundary, demonstrates the local EvidenceBrief companion, and links directly to source setup and contributor documentation.

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

The build succeeds with analytics disabled when the variable is absent.

## Analytics boundary

Use one PostHog project per application. Do not send GitPin events to a portfolio-wide or another product's project.

Website collection is intentionally narrow:

| Event | Properties |
| --- | --- |
| `cta_clicked` | `placement` only (`feedback_footer`, `feedback_footer_nav`, `feedback_nav`, `github_footer`, `github_hero`, `github_nav`, `setup_hero`) |
| `setup_intent` | `surface` only (`hero`, `install`, `navigation`) |
| `setup_progress` | `step` only (`open_setup_guide`, `open_install_section`) |
| `gate_result_intent` | `result` only (`fail_demo`, `pass_demo`) |
| `first_pass_intent` | `phase` only (`first_pass`) |
| `audience_changed` | `audience` only |
| `feedback_intent` | `surface` only (`footer`, `footer_nav`, `feedback_nav`, `feedback_footer`, `feedback_footer_nav`, `navigation`) |

Autocapture, pageview/pageleave capture, and session replay are disabled, person profiles are never created, and the site uses cookieless mode.

The launch-funnel schema is strict by design: only enumerated event names and enumerated property values are recorded.
No repository contents, filesystem paths, prompt text, URLs, tokens, secrets, user identifiers, or free-text answers are sent.

Only intent surfaces are observed here:
- site `feedback_*` clicks indicate intent to report friction,
- `setup_*` and `first_pass_*` clicks indicate navigation and first-pass intent,
- `gate_result_intent` clicks indicate a result check was consulted.
Clicks do not prove GitHub Action installation or pass/fail status; they are not equivalent to completed setup.

For launch inference, the product boundary remains:
- instrumentation: only what is in this event schema (no automatic pageview/page context)
- observed behavior: sessioned counts of event progression and latency windows
- inferred adoption: inferred from post-session interpretation, with confidence tags
- PMF: deferred until approved synthetic and real sessions are completed

The CLI, stdio MCP server, HTTP MCP server, package verifier, and container send no telemetry.
