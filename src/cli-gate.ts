import { runGitPinGate } from './gate';

export async function runGateCommand(options: string[]) {
  let base: string | undefined;
  let head: string | undefined;
  let root: string | undefined;
  let repository: string | undefined;
  let policyPath: string | undefined;

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
      default:
        throw new Error(`Unknown gate option: ${option}. Run "gitpin help" for usage.`);
    }
    index += 1;
  }
  if (!base || !head) throw new Error('gate requires --base <full-sha> and --head <full-sha>.');
  return runGitPinGate({
    base,
    head,
    ...(root ? { root } : {}),
    ...(repository ? { repository } : {}),
    ...(policyPath ? { policyPath } : {}),
  });
}
