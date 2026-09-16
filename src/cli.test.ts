import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './cli';
import { PACKAGE_VERSION } from './version';

describe('version command', () => {
  afterEach(() => vi.restoreAllMocks());

  for (const command of ['--version', '-v', 'version']) {
    it(`prints the package version for ${command}`, async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await runCli([command]);

      expect(log).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith(PACKAGE_VERSION);
    });
  }

  it('rejects extra version arguments', async () => {
    await expect(runCli(['--version', 'unexpected'])).rejects.toThrow('The version command does not accept options.');
  });
});
