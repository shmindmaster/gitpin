# Website and analytics

GitPin ships a static public site in `site/`. It explains the product boundary, demonstrates an audience-aware EvidenceBrief, and links directly to source setup and contributor documentation.

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
| `$pageview` | PostHog's cookieless page context |
| `cta_clicked` | `placement` only |
| `audience_changed` | `audience` only |

Autocapture and session replay are disabled, person profiles are never created, and the site uses cookieless mode. Do not add repository names, filesystem paths, questions, citations, MCP payloads, tokens, or client configuration to analytics.

The CLI, stdio MCP server, HTTP MCP server, package verifier, and container send no telemetry.
