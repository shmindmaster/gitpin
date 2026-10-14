import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain ES module without type declarations
import { UNCOVERED_PATH, addMissingLocator, rootCommit, setupHeroFixture } from '../scripts/demo-gate-hero.mjs';
import { runCli } from './cli';

// The film's hero sequence, driven through the real CLI entry point:
// an agent PR touches two documents but claims one, the gate fails with
// `uncovered-change`, one locator is added, and the same gate passes.
let scratch: string;
let repo: string;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'gitpin-gate-hero-test-'));
  repo = join(scratch, 'synthetic-service');
  process.exitCode = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  rmSync(scratch, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
});

async function gate(base: string, head: string) {
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  process.exitCode = undefined;
  await runCli(['gate', '--base', base, '--head', head, '--root', repo]);
  const exitCode = Number(process.exitCode ?? 0);
  const report = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
  log.mockRestore();
  process.exitCode = undefined;
  return { exitCode, report };
}

describe('gate hero fixture (fail to pass)', { timeout: 60_000 }, () => {
  it('fails with uncovered-change on the unclaimed file, then passes after one locator', async () => {
    const { base, head } = setupHeroFixture(repo);

    const failed = await gate(base, head);
    expect(failed.exitCode).toBe(1);
    expect(failed.report.status).toBe('failed');
    expect(failed.report.violations).toEqual([
      expect.objectContaining({ code: 'uncovered-change', path: UNCOVERED_PATH }),
    ]);
    expect(failed.report.changedPaths.required).toEqual(['docs/overview.md', UNCOVERED_PATH]);
    expect(failed.report.changedPaths.uncovered).toEqual([UNCOVERED_PATH]);

    const newHead = addMissingLocator(repo);
    expect(newHead).not.toBe(head);
    expect(rootCommit(repo)).toBe(base);

    const passed = await gate(base, newHead);
    expect(passed.exitCode).toBe(0);
    expect(passed.report.status).toBe('ok');
    expect(passed.report.violations ?? []).toEqual([]);
    const cited = passed.report.claims.flatMap((claim: { evidence: { citation: string; status: string }[] }) =>
      claim.evidence.map((item) => `${item.status} ${item.citation}`),
    );
    expect(cited).toEqual([
      expect.stringContaining(`verified synthetic-service/docs/overview.md:3 @ ${newHead}`),
      expect.stringContaining(`verified synthetic-service/${UNCOVERED_PATH}:5 @ ${newHead}`),
    ]);
  });

  it('is deterministic: two builds produce the same SHAs', () => {
    const a = setupHeroFixture(join(scratch, 'a'));
    const b = setupHeroFixture(join(scratch, 'b'));
    expect(a.base).toBe(b.base);
    expect(a.head).toBe(b.head);
  });
});
