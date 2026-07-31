import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const OUTPUT_MARKER = '.repocontext-snapshot-output.json';
const OUTPUT_MARKER_CONTENT = { kind: 'repocontext-snapshot-output', schemaVersion: 1 } as const;

export function prepareSnapshotOutput(workspace: string, outputPath: string, repositoryRoots: string[]): string {
  const outputRoot = resolve(outputPath);
  assertSafeSnapshotOutput(workspace, outputRoot, repositoryRoots);
  if (existsSync(outputRoot)) {
    assertDedicatedSnapshotOutput(outputRoot);
    rmSync(outputRoot, { recursive: true, force: true });
  }
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(join(outputRoot, OUTPUT_MARKER), `${JSON.stringify(OUTPUT_MARKER_CONTENT)}\n`, 'utf-8');
  return outputRoot;
}

export function assertSafeSnapshotOutput(workspace: string, outputPath: string, repositoryRoots: string[]): void {
  const outputRoot = resolve(outputPath);
  if (samePath(outputRoot, workspace)) {
    throw new Error('Snapshot output path cannot be the current workspace root.');
  }
  if (samePath(outputRoot, dirname(outputRoot))) {
    throw new Error('Snapshot output path cannot be the filesystem root.');
  }
  const endangeredRepository = repositoryRoots.find((repositoryRoot) => isWithin(outputRoot, repositoryRoot));
  if (endangeredRepository) {
    throw new Error(
      `Snapshot output path cannot be a registered repository root or its ancestor: ${endangeredRepository}`,
    );
  }
}

function assertDedicatedSnapshotOutput(outputRoot: string): void {
  const stat = lstatSync(outputRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(
      `Existing snapshot output must be a dedicated directory, not a file or symbolic link: ${outputRoot}`,
    );
  }
  const markerPath = join(outputRoot, OUTPUT_MARKER);
  if (!existsSync(markerPath)) {
    throw new Error(
      `Refusing to replace existing unmarked directory: ${outputRoot}. Choose a new path or a GitPin snapshot output.`,
    );
  }
  try {
    const marker = JSON.parse(readFileSync(markerPath, 'utf-8')) as Record<string, unknown>;
    if (marker.kind !== OUTPUT_MARKER_CONTENT.kind || marker.schemaVersion !== OUTPUT_MARKER_CONTENT.schemaVersion)
      throw new Error('invalid marker');
  } catch {
    throw new Error(`Refusing to replace snapshot directory with an invalid output marker: ${outputRoot}`);
  }
}

function isWithin(parent: string, target: string): boolean {
  const child = relative(resolve(parent), resolve(target));
  return child === '' || (!child.startsWith('..') && !isAbsolute(child));
}

function samePath(left: string, right: string): boolean {
  const normalize = (path: string) => (process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path));
  return normalize(left) === normalize(right);
}
