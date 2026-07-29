import { describe, expect, it } from 'vitest';
import { parseExposurePolicy } from './policy';
import { isSnapshotFile } from './snapshot-files';

describe('snapshot file selection', () => {
  it('keeps supported polyglot root manifests available to the HTTP transport', () => {
    const policy = parseExposurePolicy(null);
    for (const manifest of ['bun.lockb', 'composer.json', 'deno.json', 'flake.nix', 'pom.xml']) {
      expect(isSnapshotFile(manifest, policy), manifest).toBe(true);
    }
    expect(isSnapshotFile('packages/service/composer.json', policy)).toBe(false);
  });
});
