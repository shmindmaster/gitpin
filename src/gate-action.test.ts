import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isSafeRelativePath } from './gate-types';

describe('GitHub Action trust boundary', () => {
  it('runs the exact gate version from the public npm registry and documents read-only workflow permissions', () => {
    const action = readFileSync(resolve('action.yml'), 'utf8');
    const docs = readFileSync(resolve('docs/pr-evidence-gate.md'), 'utf8');
    expect(action).toContain('default: 0.6.2');
    expect(action).toContain('--registry="https://registry.npmjs.org"');
    expect(action).toContain('--userconfig="$EMPTY_NPMRC"');
    expect(action).toContain('cd "$RUNNER_TEMP"');
    expect(action).toContain('--root "$GITHUB_WORKSPACE"');
    expect(action.indexOf('cd "$RUNNER_TEMP"')).toBeLessThan(action.indexOf('npm exec --yes'));
    expect(action).not.toContain('\nnpx ');
    expect(docs).toContain('permissions:\n  contents: read');
    expect(docs).not.toContain('permissions:\n  contents: write');
  });

  it('commit-pins the repository self-gate to the published 0.6.2 Action source', () => {
    const workflow = readFileSync(resolve('.github/workflows/evidence-gate.yml'), 'utf8');
    expect(workflow).toContain('commit-pin the self-gate to the published v0.6.2 release source');
    expect(workflow).toContain('uses: shmindmaster/gitpin@d2122379f4be315973a0bfa92bbd628e2cf7cfeb');
    expect(workflow).not.toContain('uses: shmindmaster/gitpin@v0.6.2');
    expect(workflow).not.toContain('uses: shmindmaster/gitpin@v0.6.0');
    expect(workflow).not.toContain('uses: shmindmaster/gitpin@v0.6.1');
  });

  it('fails closed when the gate output is not a valid report', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'gitpin-action-report-'));
    const report = resolve(root, 'report.json');
    writeFileSync(report, 'not json', 'utf8');
    try {
      expect(() =>
        execFileSync(process.execPath, [resolve('scripts/render-gate-action-report.mjs'), report], {
          cwd: process.cwd(),
          stdio: 'pipe',
          windowsHide: true,
        }),
      ).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('emits a legible error annotation when the gate report status is failed', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'gitpin-action-report-'));
    const report = resolve(root, 'report.json');
    writeFileSync(
      report,
      JSON.stringify({
        kind: 'gitpin-gate-report',
        schemaVersion: 1,
        status: 'failed',
        reportId: 'c4f2f5f25eabd5c1',
        message: 'Gate failed with 1 violation(s).',
        changedPaths: { required: ['package.json'], claimed: [] },
        claims: [],
        violations: [
          {
            kind: 'uncovered-change',
            path: 'package.json',
            message: 'Changed path has no material claim: package.json.',
          },
        ],
      }),
      'utf8',
    );
    let stderr = '';
    try {
      const result = spawnSync(process.execPath, [resolve('scripts/render-gate-action-report.mjs'), report], {
        cwd: process.cwd(),
        stdio: 'pipe',
        windowsHide: true,
        encoding: 'utf8',
      });
      stderr = result.stderr ?? '';
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    expect(stderr).toContain('::error title=GitPin Evidence Gate::');
    expect(stderr).toContain('Gate failed with 1 violation(s).');
    expect(stderr).toContain('Changed path has no material claim: package.json.');
  });

  it('keeps the public path schema aligned with runtime validation', () => {
    const schema = JSON.parse(readFileSync(resolve('docs/schemas/change-evidence.schema.json'), 'utf8')) as {
      $defs: { path: { pattern: string } };
    };
    const publicPattern = new RegExp(schema.$defs.path.pattern, 'u');
    for (const path of ['src/file.ts', '.gitpin/change-evidence.json']) {
      expect(publicPattern.test(path)).toBe(isSafeRelativePath(path));
    }
    for (const path of ['src//file.ts', 'src/', '../file.ts', './file.ts', 'C:/file.ts', 'src\\file.ts']) {
      expect(publicPattern.test(path), path).toBe(isSafeRelativePath(path));
    }
  });
});
