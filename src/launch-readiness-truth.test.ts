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

const announcementArtifacts = [
  'docs/launch.md',
  'docs/demos/pr-gate-fail-to-pass.md',
  'docs/demos/pr-gate-fail-to-pass.artifact.json',
];

const syntheticFailPassArtifacts = {
  base: '982608f3b7521706cabbc39cd0ccf4b4036898fa',
  head: 'bab63b08df51151b6b375f2b6376fb441bcf3a8e',
};

const launchCanonicalLinks = [
  'https://www.npmjs.com/package/gitpin',
  'https://github.com/shmindmaster/gitpin/releases/tag/v0.6.0',
  'https://github.com/shmindmaster/gitpin/actions/workflows/evidence-gate.yml',
  'https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.shmindmaster/gitpin&limit=20',
  'https://shmindmaster.github.io/gitpin/',
  'uses: shmindmaster/gitpin@v0.6.0',
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

function readArtifactJson(relativePath: string): unknown {
  return JSON.parse(readArtifact(relativePath));
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

  it('locks canonical release/setup links and channel copy version claims', () => {
    const launchCopy = readArtifact('docs/launch.md');
    const releaseArtifact = readArtifactJson('docs/demos/pr-gate-fail-to-pass.artifact.json') as {
      links?: { [key: string]: string };
      version?: string;
    };
    const launchBootstrapMatches = launchCopy.match(/npx -y gitpin@\d+\.\d+\.\d+(?: init --client codex)?/g) || [];

    for (const link of launchCanonicalLinks) {
      expect(launchCopy, `docs/launch.md missing canonical link: ${link}`).toContain(link);
    }

    expect(launchBootstrapMatches).toContain('npx -y gitpin@0.6.0');
    expect(launchBootstrapMatches).toContain('npx -y gitpin@0.6.0 init --client codex');
    expect(launchCopy).not.toMatch(/gitpin@latest/g);

    for (const link of launchCanonicalLinks) {
      expect(JSON.stringify(releaseArtifact)).toContain(link);
      if (link === 'uses: shmindmaster/gitpin@v0.6.0') {
        expect(JSON.stringify(releaseArtifact.links)).toContain(link);
      }
    }

    for (const file of announcementArtifacts) {
      const artifact = readArtifact(file);
      expect(artifact, `${file} missed current release version`).toContain(`v${packageVersion}`);
      expect(
        artifact,
        `${file} has stale claim boundary text (adoption/security proof/product-market-fit)`,
      ).not.toMatch(/\badoption\b/i);
      expect(
        artifact,
        `${file} has stale claim boundary text (adoption/security proof/product-market-fit)`,
      ).not.toMatch(/\bsecurity proof\b/i);
      expect(
        artifact,
        `${file} has stale claim boundary text (adoption/security proof/product-market-fit)`,
      ).not.toMatch(/\bproduct[- ]market fit\b/i);
      expect(
        artifact,
        `${file} has stale claim boundary text (adoption/security proof/product-market-fit)`,
      ).not.toMatch(/\bcertif/i);
    }

    expect(releaseArtifact).toMatchObject({
      version: packageVersion,
      reducedMotionSafe: true,
      failCase: { status: 1 },
      passCase: { status: 0 },
      accessibility: { staticOnly: true },
      links: { mcp_registry: expect.any(String) },
    });
  });

  it('contains deterministic fail-to-pass evidence locus with exact full-SHA path and line data', () => {
    const artifact = readArtifactJson('docs/demos/pr-gate-fail-to-pass.artifact.json') as {
      fixture: { base: string; head: string; changedPath: string };
      passCase: {
        coverage: { path: string; lineStart: number; lineEnd: number; sha: string; contentSha256: string };
      };
    };

    expect(typeof artifact.fixture.base).toBe('string');
    expect(typeof artifact.fixture.head).toBe('string');
    expect(artifact.fixture.base).toMatch(/^[0-9a-f]{40}$/);
    expect(artifact.fixture.head).toMatch(/^[0-9a-f]{40}$/);
    expect(artifact.fixture.base).toBe(syntheticFailPassArtifacts.base);
    expect(artifact.fixture.head).toBe(syntheticFailPassArtifacts.head);
    expect(artifact.fixture.changedPath).toBe('docs/protocol.md');
    expect(artifact.passCase.coverage.path).toBe(artifact.fixture.changedPath);
    expect(artifact.passCase.coverage.lineStart).toBe(5);
    expect(artifact.passCase.coverage.lineEnd).toBe(5);
    expect(artifact.passCase.coverage.sha).toBe(artifact.fixture.head);
    expect(artifact.passCase.coverage.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(artifact.passCase.coverage.path).toMatch(/^docs\/protocol\.md$/);
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
