import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));

describe('source structure', () => {
  it('keeps production modules within the 300-line ownership limit', () => {
    const oversized = readdirSync(sourceDirectory)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => ({
        name,
        lines: readFileSync(join(sourceDirectory, name), 'utf8').split(/\r?\n/u).length - 1,
      }))
      .filter(({ lines }) => lines > 300);

    expect(oversized).toEqual([]);
  });
});
