import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runGitPinGate } from './gate';
import { sha256 } from './gate-policy';

let root: string;
let baseSha: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gitpin-gate-'));
  mkdirSync(join(root, '.gitpin'), { recursive: true });
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(
    join(root, '.gitpin', 'gate.yml'),
    [
      'schemaVersion: 1',
      'manifestPath: .gitpin/change-evidence.json',
      'coverage:',
      '  include: ["**"]',
      '  exclude: []',
      'policyChanges: block',
      'limits:',
      '  changedPaths: 100',
      '  claims: 50',
      '  evidencePerClaim: 8',
      '  fileBytes: 2097152',
      '',
    ].join('\n'),
    'utf8',
  );
  writeFileSync(join(root, 'src', 'feature.ts'), "export const state = 'before';\n", 'utf8');
  git(['init']);
  git(['config', 'user.email', 'gate-test@example.invalid']);
  git(['config', 'user.name', 'Gate Test']);
  git(['add', '.']);
  git(['commit', '-qm', 'base']);
  baseSha = git(['rev-parse', 'HEAD']);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('PR evidence gate', () => {
  it('verifies changed-path coverage and exact committed evidence', async () => {
    const headSha = commitFeature();
    const report = await runGitPinGate({ root, repository: 'sample', base: baseSha, head: headSha });
    expect(report.status).toBe('ok');
    expect(report.changedPaths.required).toEqual(['src/feature.ts']);
    expect(report.claims[0]?.evidence[0]?.citation).toContain(`sample/src/feature.ts:1 @ ${headSha}`);
    expect(report.reportId).toMatch(/^[0-9a-f]{16}$/u);
  });

  it('fails when a changed path has no material claim', async () => {
    writeFileSync(join(root, 'src', 'feature.ts'), "export const state = 'after';\n", 'utf8');
    writeManifest([]);
    const headSha = commitAll('uncovered');
    const report = await runGitPinGate({ root, base: baseSha, head: headSha });
    expect(report.status).toBe('failed');
    expect(report.violations).toContainEqual(
      expect.objectContaining({ code: 'uncovered-change', path: 'src/feature.ts' }),
    );
  });

  it('fails an evidence hash mismatch without calling the claim semantically proven', async () => {
    writeFileSync(join(root, 'src', 'feature.ts'), "export const state = 'after';\n", 'utf8');
    writeManifest([claim({ evidence: [headEvidence('0'.repeat(64))] })]);
    const headSha = commitAll('bad hash');
    const report = await runGitPinGate({ root, base: baseSha, head: headSha });
    expect(report.status).toBe('failed');
    expect(report.claims[0]?.status).toBe('failed');
    expect(report.violations.some((item) => item.code === 'content-hash-mismatch')).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(/claim proven/iu);
  });

  it('reads policy from base and blocks a weakening policy change in head', async () => {
    writeFileSync(join(root, 'src', 'feature.ts'), "export const state = 'after';\n", 'utf8');
    writeFileSync(
      join(root, '.gitpin', 'gate.yml'),
      'schemaVersion: 1\nmanifestPath: .gitpin/change-evidence.json\ncoverage:\n  include: ["docs/**"]\n',
      'utf8',
    );
    writeManifest([claim()]);
    const headSha = commitAll('weaken policy');
    const report = await runGitPinGate({ root, base: baseSha, head: headSha });
    expect(report.status).toBe('failed');
    expect(report.violations).toContainEqual(expect.objectContaining({ code: 'policy-change-blocked' }));
    expect(report.changedPaths.required).toContain('src/feature.ts');
  });

  it('ignores dirty workspace changes to policy and manifest', async () => {
    const headSha = commitFeature();
    writeFileSync(join(root, '.gitpin', 'gate.yml'), 'not: valid: yaml:', 'utf8');
    writeFileSync(
      join(root, '.gitpin', 'change-evidence.json'),
      '{"schemaVersion":1,"summary":"dirty","claims":[]}',
      'utf8',
    );
    const report = await runGitPinGate({ root, base: baseSha, head: headSha });
    expect(report.status).toBe('ok');
  });

  it('supports deleted files with evidence read from base', async () => {
    const before = "export const state = 'before';";
    rmSync(join(root, 'src', 'feature.ts'));
    writeManifest([
      claim({
        evidence: [
          {
            ref: 'base' as const,
            path: 'src/feature.ts',
            lineStart: 1,
            lineEnd: 1,
            contentSha256: sha256(before),
          },
        ],
      }),
    ]);
    const headSha = commitAll('delete feature');
    const report = await runGitPinGate({ root, base: baseSha, head: headSha });
    expect(report.status).toBe('ok');
    expect(report.claims[0]?.evidence[0]).toMatchObject({ ref: 'base', status: 'verified' });
  });

  it('rejects short revisions before reading repository content', async () => {
    await expect(runGitPinGate({ root, base: baseSha.slice(0, 7), head: baseSha })).rejects.toThrow(/full 40/u);
  });

  it('ignores local Git replace refs so citations still bind to the printed SHA', async () => {
    const headSha = commitFeature();
    writeFileSync(join(root, 'src', 'feature.ts'), "export const state = 'replacement';\n", 'utf8');
    const replacementSha = commitAll('replacement object');
    git(['replace', headSha, replacementSha]);
    const report = await runGitPinGate({ root, repository: 'sample', base: baseSha, head: headSha });
    expect(report.status).toBe('ok');
    expect(report.headSha).toBe(headSha);
    expect(report.claims[0]?.evidence[0]?.citation).toContain(headSha);
  });

  it('rejects traversal and duplicate claim IDs in submitted manifests', async () => {
    writeFileSync(join(root, 'src', 'feature.ts'), "export const state = 'after';\n", 'utf8');
    writeManifest([claim(), { ...claim(), id: 'FEATURE-1' }]);
    const duplicateHead = commitAll('duplicate');
    const duplicateReport = await runGitPinGate({ root, base: baseSha, head: duplicateHead });
    expect(duplicateReport.violations.some((item) => item.code === 'duplicate-claim-id')).toBe(true);

    git(['reset', '--hard', baseSha]);
    writeFileSync(join(root, 'src', 'feature.ts'), "export const state = 'after';\n", 'utf8');
    const bad = claim();
    bad.covers = ['../outside'];
    writeManifest([bad]);
    const traversalHead = commitAll('traversal');
    await expect(runGitPinGate({ root, base: baseSha, head: traversalHead })).rejects.toThrow(/normalized/u);
  });
});

function commitFeature(): string {
  const content = "export const state = 'after';";
  writeFileSync(join(root, 'src', 'feature.ts'), `${content}\n`, 'utf8');
  writeManifest([claim({ evidence: [headEvidence(sha256(content))] })]);
  return commitAll('feature');
}

function claim(overrides: Partial<ReturnType<typeof baseClaim>> = {}) {
  return { ...baseClaim(), ...overrides };
}

function baseClaim() {
  return {
    id: 'FEATURE-1',
    statement: 'The feature state changed.',
    covers: ['src/feature.ts'],
    evidence: [
      {
        ref: 'head' as const,
        path: 'src/feature.ts',
        lineStart: 1,
        lineEnd: 1,
        contentSha256: sha256("export const state = 'after';"),
      },
    ],
  };
}

function headEvidence(contentSha256: string) {
  return {
    ref: 'head' as const,
    path: 'src/feature.ts',
    lineStart: 1,
    lineEnd: 1,
    contentSha256,
  };
}

function writeManifest(claims: unknown[]): void {
  writeFileSync(
    join(root, '.gitpin', 'change-evidence.json'),
    `${JSON.stringify({ schemaVersion: 1, summary: 'Test change evidence.', claims }, null, 2)}\n`,
    'utf8',
  );
}

function commitAll(message: string): string {
  git(['add', '-A']);
  git(['commit', '-qm', message]);
  return git(['rev-parse', 'HEAD']);
}

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
}
