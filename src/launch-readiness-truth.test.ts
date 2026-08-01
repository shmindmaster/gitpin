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
const compatibilityLineHints = [
  /legacy/i,
  /historical/i,
  /migration/i,
  /compatib/i,
  /formerly/i,
  /deprecated/i,
  /renamed/i,
  /removed/i,
  /previous/i,
  /alias/i,
  /why not call this/i,
];

function readArtifact(relativePath: string): string {
  return readFileSync(join(rootDirectory, relativePath), 'utf8');
}

function detectUnmarkedLegacyBranding(fileContent: string): string[] {
  const lines = fileContent.split('\n');
  const matches: string[] = [];

  for (const line of lines) {
    if (!legacyBrandPattern.test(line)) continue;

    const hasCompatibilityContext = compatibilityLineHints.some((hint) => hint.test(line));
    if (!hasCompatibilityContext) {
      matches.push(line.trim());
    }
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
      const legacyBrandingMatches = detectUnmarkedLegacyBranding(content);
      expect(
        legacyBrandingMatches,
        `${artifact} contains unmarked legacy branding: ${legacyBrandingMatches.slice(0, 4).join(' | ')}`,
      ).toEqual([]);
    }
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
