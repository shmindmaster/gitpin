import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  asCandidateHits,
  buildCitation,
  buildEvidencePack,
  buildEvidenceSet,
  extractCitesFromText,
  parseCiteString,
  parseHandle,
  PRODUCT_CONTRACT,
  verifyEvidenceClaim,
  verifyEvidenceSet,
} from './evidence';
import { clearRegistryCache, setRegistryPath } from './registry';

let root: string;
let repoPath: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gitpin-evidence-'));
  repoPath = join(root, 'sample');
  mkdirSync(repoPath, { recursive: true });
  writeFileSync(join(repoPath, 'README.md'), '# Sample\n\nBearer tokens required on HTTP.\n', 'utf8');
  writeFileSync(join(repoPath, 'POLICY.md'), '# Policy\n\nRead-only Git HEAD only.\n', 'utf8');
  execFileSync('git', ['init'], { cwd: repoPath, windowsHide: true });
  execFileSync('git', ['config', 'user.email', 'gitpin-test@example.invalid'], {
    cwd: repoPath,
    windowsHide: true,
  });
  execFileSync('git', ['config', 'user.name', 'GitPin Test'], { cwd: repoPath, windowsHide: true });
  execFileSync('git', ['add', 'README.md', 'POLICY.md'], { cwd: repoPath, windowsHide: true });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: repoPath, windowsHide: true });
  const registry = join(root, 'repositories.yaml');
  writeFileSync(registry, `repositories:\n  - name: sample\n    path: ${repoPath.replace(/\\/g, '/')}\n`, 'utf8');
  setRegistryPath(registry);
});

afterEach(() => {
  setRegistryPath(null);
  clearRegistryCache();
  rmSync(root, { recursive: true, force: true });
});

describe('evidence contract', () => {
  it('builds a cite string with path, line, full SHA, and durable handle', () => {
    const sha = 'abc123def4567890abc123def4567890abc123de';
    const citation = buildCitation({
      repository: 'sample',
      sourcePath: 'README.md',
      line: 3,
      commitSha: sha,
    });
    expect(citation.cite).toBe(`sample/README.md:3 @ ${sha}`);
    expect(citation.handle).toBe(`gitpin:sample@${sha}:README.md:3`);
    expect(citation.repoAtSha).toBe(`sample@${sha}`);
    expect(citation.verify.gitShow).toContain('git show abc123');
    expect(citation.verify.gitpinCli).toContain('gitpin verify');
  });

  it('parses cite and handle forms', () => {
    const cite = parseCiteString('sample/README.md:3 @ abc123def4567890abc123def4567890abc123de');
    expect(cite).toMatchObject({
      repository: 'sample',
      sourcePath: 'README.md',
      line: 3,
      commitSha: 'abc123def4567890abc123def4567890abc123de',
    });
    const handle = parseHandle('gitpin:sample@abc123def4567890abc123def4567890abc123de:README.md:3');
    expect(handle).toMatchObject({
      repository: 'sample',
      sourcePath: 'README.md',
      line: 3,
    });
    expect(extractCitesFromText('See sample/README.md:3 @ abc123def4567890abc123def4567890abc123de end')).toHaveLength(
      1,
    );
  });

  it('returns an evidence pack from pin.prove semantics', async () => {
    const pack = await buildEvidencePack({
      repository: 'sample',
      sourcePath: 'README.md',
      lineStart: 3,
      lineEnd: 3,
      claim: 'HTTP requires bearer tokens',
    });
    expect(pack.kind).toBe('evidence-pack');
    expect(pack.product).toBe('gitpin');
    expect(pack.contract).toBe(PRODUCT_CONTRACT);
    expect(pack.status).toBe('ok');
    expect(pack.claim).toBe('HTTP requires bearer tokens');
    expect(pack.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(pack.content).toContain('3:');
    expect(pack.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(pack.citation.cite).toContain('sample/README.md:3 @');
    expect(pack.citation.handle).toMatch(/^gitpin:sample@[0-9a-f]{40}:README.md:3$/);
    expect(pack.next?.tool).toBe('pin.verify');
    expect(pack.next?.arguments).toMatchObject({ mustContain: 'HTTP requires bearer tokens' });
  });

  it('wraps search hits as candidates that point at pin.prove', () => {
    const envelope = asCandidateHits(
      [{ repository: 'sample', sourcePath: 'README.md', line: 3, snippet: 'Bearer', commitSha: 'a'.repeat(40) }],
      'Bearer',
    );
    expect(envelope.kind).toBe('evidence-candidates');
    expect(envelope.hits[0]?.next.tool).toBe('pin.prove');
    expect(envelope.hits[0]?.citation.handle).toContain('gitpin:sample@');
    expect(envelope.note).toMatch(/candidates/i);
  });

  it('verifies a claimed SHA against git show', async () => {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPath, encoding: 'utf8' }).trim();
    const report = await verifyEvidenceClaim({
      repository: 'sample',
      sourcePath: 'README.md',
      line: 3,
      sha,
    });
    expect(report.kind).toBe('verification-report');
    expect(report.status).toBe('ok');
    expect(report.headMatchesClaimedSha).toBe(true);
    expect(report.lineText).toContain('Bearer');
    expect(report.claimVerdict).toBeNull();
    expect(report.citation?.handle).toContain('gitpin:sample@');
  });

  it('contradicts when mustContain text is absent', async () => {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPath, encoding: 'utf8' }).trim();
    const report = await verifyEvidenceClaim({
      repository: 'sample',
      sourcePath: 'README.md',
      line: 3,
      sha,
      mustContain: 'this-text-is-not-in-the-file',
    });
    expect(report.status).toBe('contradicted');
    expect(report.claimVerdict).toBe('contradicted');
    expect(report.claimTextMatch).toBe(false);
  });

  it('supports claim text when mustContain matches', async () => {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPath, encoding: 'utf8' }).trim();
    const report = await verifyEvidenceClaim({
      repository: 'sample',
      sourcePath: 'README.md',
      line: 3,
      sha,
      mustContain: 'Bearer tokens',
    });
    expect(report.status).toBe('ok');
    expect(report.claimVerdict).toBe('supported');
    expect(report.claimTextMatch).toBe(true);
  });

  it('builds and verifies a multi-cite evidence set', async () => {
    const set = await buildEvidenceSet([
      { repository: 'sample', sourcePath: 'README.md', lineStart: 3, lineEnd: 3, claim: 'Bearer tokens' },
      { repository: 'sample', sourcePath: 'POLICY.md', lineStart: 3, lineEnd: 3, claim: 'Git HEAD' },
    ]);
    expect(set.kind).toBe('evidence-set');
    expect(set.status).toBe('ok');
    expect(set.count).toBe(2);
    expect(set.evidenceSetId).toMatch(/^[0-9a-f]{16}$/);
    expect(set.next?.tool).toBe('pin.verify_set');

    const verifyArgs = set.next?.arguments as {
      evidenceSetId: string;
      items: Array<{ repository: string; sourcePath: string; sha: string; mustContain?: string }>;
    };
    const report = await verifyEvidenceSet({
      evidenceSetId: verifyArgs.evidenceSetId,
      items: verifyArgs.items,
    });
    expect(report.kind).toBe('verification-set-report');
    expect(report.status).toBe('ok');
    expect(report.okCount).toBe(2);
    expect(report.items.every((item) => item.claimVerdict === 'supported')).toBe(true);
  });
});
