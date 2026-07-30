import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { asCandidateHits, buildCitation, buildEvidencePack, PRODUCT_CONTRACT, verifyEvidenceClaim } from './evidence';
import { clearRegistryCache, setRegistryPath } from './registry';

let root: string;
let repoPath: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gitpin-evidence-'));
  repoPath = join(root, 'sample');
  mkdirSync(repoPath, { recursive: true });
  writeFileSync(join(repoPath, 'README.md'), '# Sample\n\nBearer tokens required on HTTP.\n', 'utf8');
  execFileSync('git', ['init'], { cwd: repoPath, windowsHide: true });
  execFileSync('git', ['config', 'user.email', 'gitpin-test@example.invalid'], {
    cwd: repoPath,
    windowsHide: true,
  });
  execFileSync('git', ['config', 'user.name', 'GitPin Test'], { cwd: repoPath, windowsHide: true });
  execFileSync('git', ['add', 'README.md'], { cwd: repoPath, windowsHide: true });
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
  it('builds a cite string with path, line, and full SHA', () => {
    const citation = buildCitation({
      repository: 'sample',
      sourcePath: 'README.md',
      line: 3,
      commitSha: 'abc123def4567890abc123def4567890abc123de',
    });
    expect(citation.cite).toBe('sample/README.md:3 @ abc123def4567890abc123def4567890abc123de');
    expect(citation.verify.gitShow).toContain('git show abc123');
    expect(citation.verify.gitpinCli).toContain('gitpin verify');
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
    expect(pack.next?.tool).toBe('pin.verify');
  });

  it('wraps search hits as candidates that point at pin.prove', () => {
    const envelope = asCandidateHits(
      [{ repository: 'sample', sourcePath: 'README.md', line: 3, snippet: 'Bearer', commitSha: 'a'.repeat(40) }],
      'Bearer',
    );
    expect(envelope.kind).toBe('evidence-candidates');
    expect(envelope.hits[0]?.next.tool).toBe('pin.prove');
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
  });
});
