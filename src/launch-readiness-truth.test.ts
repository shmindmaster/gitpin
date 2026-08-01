import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
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

function verifyArtifactFromCleanCheckout(artifactPath: string, workspaceDirectory: string): string {
  try {
    execFileSync(
      process.execPath,
      [join(rootDirectory, 'scripts/build-pr-gate-fail-to-pass-artifact.mjs'), '--verify', '--artifact', artifactPath],
      { cwd: workspaceDirectory, encoding: 'utf8', stdio: 'pipe', windowsHide: true },
    );
    return '';
  } catch (error) {
    if (typeof error !== 'object' || error === null) return '';
    const processError = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
    return [processError.stdout, processError.stderr, processError.message]
      .filter((value): value is string | Buffer => value !== undefined)
      .map((value) => value.toString())
      .join('\n');
  }
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

    expect(launchBootstrapMatches).not.toContain('npx -y gitpin@0.6.0');
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
      fixture: { base: string; failHead: string; head: string; changedPath: string; lineAdded: number };
      failCase: { command: string; status: number; output: string; outputSha256: string };
      passCase: {
        command: string;
        status: number;
        output: string;
        outputSha256: string;
        coverage: {
          path: string;
          lineStart: number;
          lineEnd: number;
          sha: string;
          contentSha256: string;
          citation: string;
          handle: string;
        };
      };
      reproducibility: {
        checks: { rawStdoutHash: string };
        artifactSha256: string;
        commandRuns: Array<{ command: string; status: number; outputSha256: string }>;
      };
    };

    expect(typeof artifact.fixture.base).toBe('string');
    expect(typeof artifact.fixture.head).toBe('string');
    expect(typeof artifact.fixture.failHead).toBe('string');
    expect(artifact.fixture.base).toMatch(/^[0-9a-f]{40}$/);
    expect(artifact.fixture.head).toMatch(/^[0-9a-f]{40}$/);
    expect(artifact.fixture.failHead).toMatch(/^[0-9a-f]{40}$/);
    expect(artifact.fixture.changedPath).toBe('docs/protocol.md');
    expect(artifact.passCase.coverage.path).toBe(artifact.fixture.changedPath);
    expect(artifact.passCase.coverage.lineStart).toBe(artifact.fixture.lineAdded);
    expect(artifact.passCase.coverage.lineEnd).toBe(artifact.fixture.lineAdded);
    expect(artifact.passCase.coverage.sha).toBe(artifact.fixture.head);
    expect(artifact.passCase.coverage.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(artifact.passCase.coverage.path).toMatch(/^docs\/protocol\.md$/);
    expect(artifact.fixture.base).not.toEqual(artifact.fixture.failHead);
    expect(artifact.fixture.failHead).not.toEqual(artifact.fixture.head);
    expect(artifact.failCase.command).toBe(
      `gitpin gate --base ${artifact.fixture.base} --head ${artifact.fixture.failHead}`,
    );
    expect(artifact.passCase.command).toBe(
      `gitpin gate --base ${artifact.fixture.base} --head ${artifact.fixture.head}`,
    );
    expect(artifact.failCase.status).toBe(1);
    expect(artifact.passCase.status).toBe(0);
    expect(artifact.failCase.output).toContain('Gate failed with');
    expect(artifact.passCase.output).toContain('PASS');
    expect(artifact.failCase.output).toMatch(/FAIL:|Gate failed with/);
    expect(artifact.passCase.output).toMatch(/PASS|checked 1 claim/);
    expect(createHash('sha256').update(artifact.failCase.output, 'utf8').digest('hex')).toBe(
      artifact.failCase.outputSha256,
    );
    expect(createHash('sha256').update(artifact.passCase.output, 'utf8').digest('hex')).toBe(
      artifact.passCase.outputSha256,
    );
    expect(artifact.reproducibility.commandRuns).toEqual([
      expect.objectContaining({
        command: artifact.failCase.command,
        status: artifact.failCase.status,
        outputSha256: artifact.failCase.outputSha256,
      }),
      expect.objectContaining({
        command: artifact.passCase.command,
        status: artifact.passCase.status,
        outputSha256: artifact.passCase.outputSha256,
      }),
    ]);
    expect(
      createHash('sha256').update(`${artifact.failCase.output}\n${artifact.passCase.output}`, 'utf8').digest('hex'),
    ).toBe(artifact.reproducibility.checks.rawStdoutHash);

    const payloadWithoutChecksum = {
      ...artifact,
      reproducibility: {
        ...artifact.reproducibility,
        artifactSha256: undefined,
      },
    };
    const expectedDigest = createHash('sha256')
      .update(JSON.stringify(payloadWithoutChecksum, null, 2), 'utf8')
      .digest('hex');
    expect(artifact.reproducibility.artifactSha256).toBe(expectedDigest);

    expect(artifact.passCase.coverage.citation).toMatch(
      /^task-2-synthetic-pr-fixture\/docs\/protocol\.md:5 @ [0-9a-f]{40}$/,
    );
    expect(artifact.passCase.coverage.handle).toMatch(
      /^gitpin:task-2-synthetic-pr-fixture@[0-9a-f]{40}:docs\/protocol\.md:5$/,
    );

    const markdown = readArtifact('docs/demos/pr-gate-fail-to-pass.md');
    expect(markdown).toContain(artifact.fixture.base);
    expect(markdown).toContain(artifact.fixture.failHead);
    expect(markdown).toContain(artifact.fixture.head);
    expect(markdown).toContain(artifact.passCase.coverage.citation);
  });

  it('rejects a tampered advertised artifact checksum during deterministic artifact verification', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'gitpin-artifact-checksum-'));
    const artifactPath = join(temporaryDirectory, 'pr-gate-fail-to-pass.artifact.json');

    try {
      const artifact = readArtifactJson('docs/demos/pr-gate-fail-to-pass.artifact.json') as {
        reproducibility: { artifactSha256: string };
      };
      artifact.reproducibility.artifactSha256 = '0'.repeat(64);
      writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

      const verificationFailure = verifyArtifactFromCleanCheckout(artifactPath, temporaryDirectory);

      expect(verificationFailure).toContain('advertised reproducibility.artifactSha256 does not match');
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }, 15_000);

  it('reports malformed artifact shapes deterministically before built-CLI preflight', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'gitpin-artifact-shape-'));
    const artifactPath = join(temporaryDirectory, 'pr-gate-fail-to-pass.artifact.json');

    try {
      for (const [artifactJson, expectedMessage] of [
        ['{}\n', 'expected reproducibility to be a JSON object.'],
        [
          '{"reproducibility": {}}\n',
          'expected reproducibility.artifactSha256 to be a 64-character lowercase hexadecimal string.',
        ],
      ]) {
        writeFileSync(artifactPath, artifactJson, 'utf8');

        const verificationFailure = verifyArtifactFromCleanCheckout(artifactPath, temporaryDirectory);

        expect(verificationFailure).toContain(expectedMessage);
        expect(verificationFailure).not.toContain('Expected built GitPin CLI');
      }
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }, 15_000);

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
