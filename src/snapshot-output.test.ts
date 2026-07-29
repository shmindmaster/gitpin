import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prepareSnapshotOutput } from './snapshot-output';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'repocontext-snapshot-output-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('snapshot output safety', () => {
  it('refuses to delete an existing unmarked directory', () => {
    const workspace = join(root, 'workspace');
    const repository = join(workspace, 'repository');
    const output = join(root, 'existing');
    mkdirSync(repository, { recursive: true });
    mkdirSync(output);
    const sentinel = join(output, 'uncommitted-work.txt');
    writeFileSync(sentinel, 'preserve me', 'utf-8');

    expect(() => prepareSnapshotOutput(workspace, output, [repository])).toThrow(/unmarked directory/);
    expect(readFileSync(sentinel, 'utf-8')).toBe('preserve me');
  });

  it('replaces only a directory carrying the RepoContext output marker', () => {
    const workspace = join(root, 'workspace');
    const repository = join(workspace, 'repository');
    const output = join(root, 'snapshot');
    mkdirSync(repository, { recursive: true });

    prepareSnapshotOutput(workspace, output, [repository]);
    const stale = join(output, 'stale.txt');
    writeFileSync(stale, 'old snapshot', 'utf-8');
    prepareSnapshotOutput(workspace, output, [repository]);

    expect(existsSync(stale)).toBe(false);
    expect(existsSync(join(output, '.repocontext-snapshot-output.json'))).toBe(true);
  });

  it('refuses a registered repository root or any of its ancestors', () => {
    const workspace = join(root, 'workspace');
    const repository = join(workspace, 'repository');
    mkdirSync(repository, { recursive: true });
    const sentinel = join(root, 'keep.txt');
    writeFileSync(sentinel, 'safe', 'utf-8');

    expect(() => prepareSnapshotOutput(workspace, root, [repository])).toThrow(/registered repository root/);
    expect(readFileSync(sentinel, 'utf-8')).toBe('safe');
  });
});
