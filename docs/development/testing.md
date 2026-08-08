# Testing

GitPin uses vitest for unit/integration tests (`src/*.test.ts`) and Playwright for the
static site (`tests/browser/*.spec.mjs`).

## Unit and integration tests

```bash
pnpm test                  # vitest run src
```

Coverage focuses on the gate, evidence, git, snapshot, wiki, policy, registry, http,
and onboarding modules (`src/*.test.ts`), including fixture-driven tests under
`tests/fixtures/`.

## Site tests (Playwright)

```bash
pnpm site:test             # playwright test (config: playwright.config.mjs)
pnpm site:serve            # serve the built site for manual/headed checks
```

Browser specs live in `tests/browser/` (`site.spec.mjs`, `analytics-privacy.spec.mjs`).

## Full gate

`pnpm validate` is the single command that must pass before merge:

```bash
pnpm validate              # lint + format:check + typecheck + verify:* + pnpm test + site:build + verify:artifact-gate-demo
```

See `docs/ci.md` for how CI runs these steps and `docs/pr-evidence-gate.md` for the
evidence gate applied to pull requests.
