import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './cli';
import { runGitPinGate } from './gate';
import type { GateReport } from './gate-types';

vi.mock('./gate', () => ({ runGitPinGate: vi.fn() }));

const report: GateReport = {
  kind: 'gitpin-gate-report',
  schemaVersion: 1,
  status: 'ok',
  reportId: '0123456789abcdef',
  repository: 'sample',
  baseSha: 'a'.repeat(40),
  headSha: 'b'.repeat(40),
  mergeBaseSha: 'a'.repeat(40),
  policy: { path: '.gitpin/gate.yml', sha256: 'c'.repeat(64) },
  manifest: { path: '.gitpin/change-evidence.json', sha256: 'd'.repeat(64) },
  changedPaths: { all: ['src/feature.ts'], required: ['src/feature.ts'], uncovered: [] },
  claims: [],
  violations: [],
  message: 'Checked 1 claim manifest entry and verified its evidence locators for 1 changed path(s).',
};

describe('gate command output', () => {
  beforeEach(() => {
    vi.mocked(runGitPinGate).mockResolvedValue(report);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it('keeps the default output byte-compatible JSON', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await runCli(['gate', '--base', report.baseSha, '--head', report.headSha]);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(JSON.stringify(report, null, 2));
  });

  it('prints a one-line human summary when text format is requested', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await runCli(['gate', '--base', report.baseSha, '--head', report.headSha, '--format', 'text']);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(`PASS: ${report.message}`);
  });

  it('rejects unsupported output formats', async () => {
    await expect(
      runCli(['gate', '--base', report.baseSha, '--head', report.headSha, '--format', 'yaml']),
    ).rejects.toThrow('Gate format must be one of: json, text.');
  });
});
