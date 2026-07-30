# Npm-first onboarding implementation

## Approved scope

Shorten RepoContext's first-run path from manual source installation, registry authoring, and client configuration to
one package command that establishes a safe registry, proves readiness, returns a cited first result, and gives the
user an explicit client handoff.

The indexed repositories remain immutable. `init` may create only the requested registry outside those repositories;
it does not modify MCP client configuration.

## Expected behavior and validation criteria

- `init --client <name>` registers the current Git root by default and accepts repeated `--repository` paths.
- Only exact Git repository roots with a commit at `HEAD` are accepted.
- The default destination is `~/.repocontext/repositories.yaml`; an explicit `--registry` is supported.
- An identical rerun is idempotent. Different existing content is never overwritten.
- Success includes `doctor` readiness, one path/line/commit-pinned documentation result, and a package-based client
  configuration.
- Claude Code, Codex, Cursor, Windsurf, Zed, and Continue output is covered by automated tests.
- The website presents npm onboarding as the primary action and preserves keyboard and responsive behavior.

## Decisions

- Configuration is printed rather than installed into a client. This keeps external client mutation explicit and
  reversible while still removing registry and verification work.
- Registry entries use the repository directory name and current branch. Duplicate directory names fail with an
  actionable message instead of being renamed silently.
- Existing registries are compared byte-for-byte. Preserving comments and hand-authored policy is more important than
  automatically merging YAML.

## Changed files

- `src/onboarding.ts`, `src/onboarding.test.ts`, `src/cli.ts`
- `site/index.html`, `tests/browser/site.spec.mjs`
- `README.md`, `docs/clients.md`, `CHANGELOG.md`
- `.github/workflows/ci.yml`, `scripts/verify-ci-runner-routing.mjs`
- `_product-experience/04-implementation-log.md`

## Validation

- `pnpm exec vitest run src/onboarding.test.ts` - passed, 15 tests.
- `pnpm typecheck` - passed.
- `pnpm validate` - passed: lint, formatting, strict types, client/environment/release contracts, 52 unit tests, and
  static site build.
- `pnpm build && pnpm verify:package` - passed: packed clean install, `init`, `doctor`, Context Brief, first MCP answer,
  and public documentation.
- `pnpm site:test` - passed, 24 journeys across Chromium, Firefox, WebKit, and mobile Chromium.

## Residual risks

- Client-native activation remains a user-controlled paste/restart step and must be verified in each installed client.
- A first Context Brief fact requires committed supported documentation; repositories without it fail with recovery
  guidance.
- Official MCP Registry publication is a separate distribution gate and is not part of this bounded slice.
