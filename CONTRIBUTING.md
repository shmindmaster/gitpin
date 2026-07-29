# Contributing

Thanks for improving RepoContext.

## Before you start

- Use a GitHub issue for bugs and feature proposals so scope and safety implications can be discussed first.
- Use GitHub's private security-advisory flow for vulnerabilities; do not disclose them in issues or pull requests.
- Keep changes within RepoContext's Git-only, read-only, commit-pinned architecture.

## Local setup

```bash
git clone https://github.com/shmindmaster/repocontext.git
cd repocontext
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium firefox webkit
pnpm validate
pnpm build
pnpm verify:package
pnpm verify:clients
pnpm site:test
pnpm mcp:serve
```

Node.js 22.13 or newer and Git are required for source development. The packed package is separately validated on Node.js 20, 22, and 24. Copy the registry shape from [README.md](README.md) and set `REPOCONTEXT_REGISTRY` to a safe local fixture; never commit a registry containing machine-specific or private paths.

## Workflow

1. Fork the repository and create a focused branch from `main`.
2. Add a failing regression test before fixing a defect when practical.
3. Implement the smallest change that preserves public tool names and result provenance.
4. Run `pnpm validate`, `pnpm build`, and `pnpm verify:package`. Run `pnpm site:test` for website changes.
5. Open a pull request using the repository template and link the issue it addresses.

Do not mix unrelated refactors with behavioral work. Maintainers may ask for a design discussion before accepting new MCP tools, transports, dependencies, or exposure-policy changes.

## CI runner isolation

`main` and same-repository pull requests use the dedicated DigitalOcean runner fleet to keep routine validation fast and avoid GitHub-hosted runner consumption. Pull requests from forks run on GitHub-hosted runners instead: never execute untrusted fork code on a self-hosted runner. `pnpm verify:ci` enforces this routing contract.

## Coding standards

- TypeScript is strict; avoid `any` in new code.
- Use named exports and domain-specific names.
- Keep production modules at or below 300 lines and one bounded responsibility per file.
- Errors must explain what failed and how the operator can correct it.
- Run `pnpm format` before committing; CI enforces Biome linting and formatting.
- Add dependencies only when the pull request documents why existing platform or project APIs are insufficient.

## Design constraints

- Do not add repository write operations, databases, cache layers, background workers, or hidden network calls.
- Every source result must identify its commit provenance.
- New sensitive-path handling must fail safely.
- Keep public documentation specific about what is implemented and what is only a future idea.

## Tests and pull requests

Behavior changes need regression coverage. Security-boundary changes should include both allowed and denied cases. Transport changes should verify the MCP contract, authentication behavior, and health checks. Packaging changes must pass the clean packed install-to-first-answer test. Website changes must pass the Chromium, Firefox, WebKit, and mobile Chromium regression suite.

Pull requests should state the problem, approach, user-visible behavior, validation performed, security impact, and documentation changes. A passing check is not a substitute for review, and maintainers will not merge changes that weaken tests or suppress findings without a documented reason.

## Bug reports

Open an issue with the MCP tool call, expected result, actual result, relevant commit SHA, and a minimal safe reproduction. Do not include credentials, customer data, or proprietary repository contents.

## Feature proposals

Describe the coding-agent workflow that is currently blocked, the evidence the agent should receive, alternatives using the existing eight tools, provenance requirements, and any new exposure risk. Proposals are evaluated against [ROADMAP.md](ROADMAP.md) and may remain research-gated until validated with users.

## Releases

Maintainers update [CHANGELOG.md](CHANGELOG.md), run all checks documented in the README, inspect the package archive, and verify a clean external install before publishing. A trusted version-tag workflow validates the exact tag, publishes or verifies the npm artifact through OIDC, and creates the matching GitHub Release. Contributors should not publish packages or create release tags from forks.
