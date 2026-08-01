import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(join(rootDirectory, 'package.json'), 'utf8') as string) as {
  version: string;
};
const packageVersion = packageJson.version;

const publicArtifacts = [
  'AGENTS.md',
  'README.md',
  'ROADMAP.md',
  'docs/launch.md',
  'docs/website.md',
  'docs/clients.md',
  'docs/configuration.md',
  'docs/faq.md',
  'docs/pr-evidence-gate.md',
  'site/index.html',
];

const legacyBrandPattern = /\bRepoContext\b|\bRepocontext\b|\brepocontext\b|\bREPOCONTEXT\b/;
const legacyBrandCompatibilityAllowlist: Record<string, ((line: string) => boolean)[]> = {
  'AGENTS.md': [(line) => line.includes('.repocontext/wiki.yaml') && line.includes('migration alias')],
  'README.md': [
    (line) => line === 'Formerly RepoContext 0.3.x. See [migration](docs/migration-gitpin.md).',
    (line) => line.startsWith('| `GITPIN_REGISTRY` |') && line.includes('REPOCONTEXT_REGISTRY'),
    (line) => line.startsWith('| `GITPIN_MCP_TOKEN` |') && line.includes('REPOCONTEXT_MCP_TOKEN'),
    (line) => line.startsWith('| `GITPIN_ALLOWED_HOSTS` |') && line.includes('REPOCONTEXT_ALLOWED_HOSTS'),
    (line) => line.includes('~/.repocontext/...') && line.includes('legacy compatibility fallback'),
    (line) =>
      line ===
      'Site: [shmindmaster.github.io/gitpin](https://shmindmaster.github.io/gitpin/). GitPin is the canonical product and repository name; legacy `repocontext` references exist only for migration compatibility.',
  ],
  'docs/configuration.md': [
    (line) => line.includes('~/.repocontext') && line.includes('legacy compatibility fallback'),
  ],
  'docs/faq.md': [
    (line) => line === '## Migration from RepoContext 0.3.x?',
    (line) =>
      line.includes('Supported compatibility aliases are the `repocontext` bin') &&
      line.includes('`REPOCONTEXT_*` environment variables'),
  ],
};

function isAllowlistedLegacyLine(relativePath: string, line: string): boolean {
  const allowlist = legacyBrandCompatibilityAllowlist[relativePath];
  if (!allowlist) return false;
  const normalized = line.trim();
  return allowlist.some((predicate) => predicate(normalized));
}

function readArtifact(relativePath: string): string {
  return readFileSync(join(rootDirectory, relativePath), 'utf8');
}

function detectUnmarkedLegacyBranding(relativePath: string, fileContent: string): string[] {
  const lines = fileContent.split('\n');
  const matches: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!legacyBrandPattern.test(line) || isAllowlistedLegacyLine(relativePath, line)) continue;

    const lineNumber = index + 1;
    matches.push(`${relativePath}#${lineNumber}: ${line.trim()}`);
  }

  return matches;
}

function extractCurrentSemverClaims(fileContent: string): string[] {
  const claims = new Set<string>();
  const gitpinUsePattern = /shmindmaster\/gitpin@v?(?<version>\d+(?:\.\d+){2})/g;
  const gitpinTextPattern = /GitPin (?<version>\d+(?:\.\d+){2})/g;
  const yamlVersionPattern = /version:\s*(?<version>\d+(?:\.\d+){2})/g;

  for (const match of fileContent.matchAll(gitpinUsePattern)) {
    if (match.groups?.version) claims.add(match.groups.version);
  }

  for (const match of fileContent.matchAll(gitpinTextPattern)) {
    if (match.groups?.version) claims.add(match.groups.version);
  }

  for (const match of fileContent.matchAll(yamlVersionPattern)) {
    if (match.groups?.version) claims.add(match.groups.version);
  }

  return [...claims];
}

describe('public launch truth', () => {
  it('keeps AGENTS and roadmap aligned to GitPin 0.6.0 evidence-gate truth', () => {
    const agents = readArtifact('AGENTS.md');
    const roadmap = readArtifact('ROADMAP.md');

    expect(agents).toContain('required PR evidence gate');
    expect(agents).toContain('commit-pinned');
    expect(agents).toContain('read-only');
    expect(agents).toContain(`GitPin ${packageVersion}`);
    expect(roadmap).toContain('0.6.0');
    expect(roadmap).toContain('Read-only `gitpin gate`');
    expect(roadmap).toContain('read-only');
  });

  it('does not regress current branding to legacy RepoContext in current public artifacts', () => {
    for (const artifact of publicArtifacts) {
      const content = readArtifact(artifact);
      const legacyBrandingMatches = detectUnmarkedLegacyBranding(artifact, content);
      expect(
        legacyBrandingMatches,
        `${artifact} contains unmarked legacy branding: ${legacyBrandingMatches.slice(0, 4).join(' | ')}`,
      ).toEqual([]);
    }
  });

  it('allows only enumerated compatibility lines for legacy branding', () => {
    const allowlistedReadmeLine = `Formerly RepoContext 0.3.x. See [migration](docs/migration-gitpin.md).`;
    const allowlistedArtifact = 'README.md';
    expect(detectUnmarkedLegacyBranding(allowlistedArtifact, allowlistedReadmeLine)).toEqual([]);

    const allowlistedAliasLine =
      '| `GITPIN_REGISTRY` | Registry YAML path (legacy compatibility alias: `REPOCONTEXT_REGISTRY`) |';
    expect(detectUnmarkedLegacyBranding(allowlistedArtifact, allowlistedAliasLine)).toEqual([]);
  });

  it('does not allow legacy-branding on non-allowlisted lines even with adjacent context', () => {
    const syntheticArtifact = 'README.md';
    const syntheticContent = [
      'RepoContext references must be explicit and explicit-compat lines cannot be inferred from neighbors.',
      'This following line mentions migration only, which is not on the allowlist.',
    ].join('\n');
    expect(detectUnmarkedLegacyBranding(syntheticArtifact, syntheticContent)).toEqual([
      'README.md#1: RepoContext references must be explicit and explicit-compat lines cannot be inferred from neighbors.',
    ]);
  });

  it('keeps public release/version assertions on the current package version', () => {
    for (const artifact of publicArtifacts) {
      const content = readArtifact(artifact);
      const versions = extractCurrentSemverClaims(content);
      const staleVersions = Array.from(new Set(versions.filter((version) => version !== packageVersion)));
      expect(
        staleVersions,
        `${artifact} contains stale 0.x version claims: ${staleVersions.join(', ') || '(none)'}`,
      ).toEqual([]);
    }
  });
});
