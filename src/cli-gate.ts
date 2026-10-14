import { runGitPinGate } from './gate';
import type { GateReport } from './gate-types';

export async function runGateCommand(options: string[]): Promise<{ report: GateReport; format: 'json' | 'text' }> {
  let base: string | undefined;
  let head: string | undefined;
  let root: string | undefined;
  let repository: string | undefined;
  let policyPath: string | undefined;
  let format: 'json' | 'text' = 'json';

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    const value = options[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Option ${option} requires a value.`);
    switch (option) {
      case '--base':
        base = value;
        break;
      case '--head':
        head = value;
        break;
      case '--root':
        root = value;
        break;
      case '--repository':
        repository = value;
        break;
      case '--policy':
        policyPath = value;
        break;
      case '--format':
        if (value !== 'json' && value !== 'text') {
          throw new Error('Gate format must be one of: json, text.');
        }
        format = value;
        break;
      default:
        throw new Error(`Unknown gate option: ${option}. Run "gitpin help" for usage.`);
    }
    index += 1;
  }
  if (!base || !head) throw new Error('gate requires --base <full-sha> and --head <full-sha>.');
  const report = await runGitPinGate({
    base,
    head,
    ...(root ? { root } : {}),
    ...(repository ? { repository } : {}),
    ...(policyPath ? { policyPath } : {}),
  });
  return { report, format };
}
