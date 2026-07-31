# Security policy

GitPin is intentionally read-only, but it can expose repository evidence to MCP clients. Treat registry configuration and remote deployment as security-sensitive.

## Supported versions

Security fixes are applied to the latest published release on npm and to `main`. Older patch lines do not receive a separate long-term maintenance window. Always prefer the latest `gitpin` version.

## Report a vulnerability

Use [GitHub's private vulnerability-reporting form](https://github.com/shmindmaster/gitpin/security/advisories/new). Do not open a public issue or pull request for an undisclosed vulnerability, and do not include live credentials or proprietary repository content.

When reporting, include the affected version, reproduction steps, impact, and any relevant path or policy configuration. We will acknowledge valid reports, investigate, and coordinate a fix before disclosure.

If the private reporting form is unavailable, contact the repository owner through the private contact method listed on their GitHub profile and mention only that you need a secure reporting channel.

## Scope and safe testing

Relevant issues include bypasses of sensitive-path or documentation-deny rules, working-tree or untracked-data exposure, access without the configured HTTP bearer token, path traversal, snapshot contamination, and secrets included in packaged or container artifacts.

Use repositories and credentials you own or are authorized to test. Do not test against third-party deployments, degrade service, or retain exposed data. Maintainers will coordinate disclosure after a fix is available; avoid public discussion until that process is complete.
