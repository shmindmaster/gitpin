import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { doctorExitCode, formatDoctorReport, getDoctorReport } from './doctor';
import { clearRegistryCache, setRegistryPath } from './registry';

const tmpRoot = join(tmpdir(), `repocontext-doctor-${process.pid}`);
const repoPath = join(tmpRoot, 'ready-repo');

beforeEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  mkdirSync(join(repoPath, 'docs'), { recursive: true });
  writeFileSync(join(repoPath, 'README.md'), '# Ready\n', 'utf-8');
  writeFileSync(join(repoPath, 'docs', 'architecture.md'), '# Architecture\n', 'utf-8');
  execFileSync('git', ['init', '-q'], { cwd: repoPath, windowsHide: true });
  execFileSync('git', ['config', 'user.email', 'gitpin-test@example.invalid'], {
    cwd: repoPath,
    windowsHide: true,
  });
  execFileSync('git', ['config', 'user.name', 'GitPin Test'], { cwd: repoPath, windowsHide: true });
  execFileSync('git', ['add', '.'], { cwd: repoPath, windowsHide: true });
  execFileSync('git', ['commit', '-qm', 'ready fixture'], { cwd: repoPath, windowsHide: true });
});

afterEach(() => {
  setRegistryPath(null);
  clearRegistryCache();
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('doctor', () => {
  it('reports an indexed clean registry as ready', async () => {
    setRegistry(`repositories:\n  - name: ready\n    path: ${repoPath.replace(/\\/g, '/')}\n`);

    const report = await getDoctorReport();

    expect(report.status).toBe('ready');
    expect(report.summary).toMatchObject({ indexed: 1, unavailable: 0, stale: 0 });
    expect(doctorExitCode(report)).toBe(0);
    expect(formatDoctorReport(report)).toContain('ready: status=indexed');
  });

  it('returns attention for a stale documentation checkout', async () => {
    writeFileSync(join(repoPath, 'README.md'), '# Changed locally\n', 'utf-8');
    setRegistry(`repositories:\n  - name: ready\n    path: ${repoPath.replace(/\\/g, '/')}\n`);

    const report = await getDoctorReport();

    expect(report.status).toBe('attention');
    expect(report.summary.stale).toBe(1);
    expect(doctorExitCode(report)).toBe(0);
  });

  it('blocks an unavailable registry entry', async () => {
    setRegistry(`repositories:\n  - name: missing\n    path: ${join(tmpRoot, 'missing').replace(/\\/g, '/')}\n`);

    const report = await getDoctorReport();

    expect(report.status).toBe('blocked');
    expect(report.summary.unavailable).toBe(1);
    expect(doctorExitCode(report)).toBe(1);
    expect(formatDoctorReport(report)).toContain('missing: status=unavailable');
  });
});

function setRegistry(content: string): void {
  const registryPath = join(tmpRoot, 'repositories.yaml');
  writeFileSync(registryPath, content, 'utf-8');
  setRegistryPath(registryPath);
}
