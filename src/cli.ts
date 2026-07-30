import { BRIEF_AUDIENCES, type BriefAudience, getContextBrief } from './context-brief';
import { doctorExitCode, formatDoctorReport, getDoctorReport } from './doctor';
import { initializeRepoContext, parseInitOptions, supportedInitClients } from './onboarding';

export async function runCli(args: string[]): Promise<void> {
  const [command, ...options] = args;
  if (command === 'doctor') {
    if (options.length > 0) throw new Error('The doctor command does not accept options.');
    const report = await getDoctorReport();
    console.log(formatDoctorReport(report));
    process.exitCode = doctorExitCode(report);
    return;
  }
  if (command === 'brief') {
    const input = parseBriefOptions(options);
    console.log(JSON.stringify(await getContextBrief(input), null, 2));
    return;
  }
  if (command === 'init') {
    const result = await initializeRepoContext(parseInitOptions(options));
    console.log(formatInitResult(result));
    process.exitCode = doctorExitCode(result.readiness);
    return;
  }
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(cliHelp());
    return;
  }
  throw new Error(`Unknown command: ${command}. Run "repocontext help" for supported commands.`);
}

function parseBriefOptions(options: string[]) {
  let audience: BriefAudience = 'technical';
  const repositories: string[] = [];
  let changeRepository: string | undefined;
  let base: string | undefined;
  let head: string | undefined;

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    const value = options[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Option ${option} requires a value.`);
    switch (option) {
      case '--audience':
        if (!BRIEF_AUDIENCES.includes(value as BriefAudience)) {
          throw new Error(`Audience must be one of: ${BRIEF_AUDIENCES.join(', ')}.`);
        }
        audience = value as BriefAudience;
        break;
      case '--repository':
        repositories.push(value);
        break;
      case '--change-repository':
        changeRepository = value;
        break;
      case '--base':
        base = revision(value, '--base');
        break;
      case '--head':
        head = revision(value, '--head');
        break;
      default:
        throw new Error(`Unknown brief option: ${option}. Run "repocontext help" for usage.`);
    }
    index += 1;
  }

  const changeValues = [changeRepository, base, head].filter(Boolean).length;
  if (changeValues !== 0 && changeValues !== 3) {
    throw new Error('Change evidence requires --change-repository, --base, and --head together.');
  }
  if (changeRepository && repositories.length > 0 && !repositories.includes(changeRepository)) {
    throw new Error('--change-repository must also be selected with --repository.');
  }
  return {
    audience,
    ...(repositories.length > 0 ? { repositories: [...new Set(repositories)] } : {}),
    ...(changeRepository && base && head ? { changeRange: { repository: changeRepository, base, head } } : {}),
  };
}

function revision(value: string, option: string): string {
  if (!/^[0-9a-f]{7,40}$/iu.test(value))
    throw new Error(`${option} must be a 7-40 character hexadecimal Git revision.`);
  return value;
}

function cliHelp(): string {
  return `RepoContext

Usage:
  repocontext                         Start the stdio MCP server
  repocontext init --client <name>    Create a registry, verify it, and print client configuration
  repocontext doctor                  Validate registry readiness
  repocontext brief [options]         Print a deterministic Context Brief as JSON

Init options:
  --client <name>                     ${supportedInitClients.join(', ')}
  --repository <path>                 Git repository root; repeat for multiple (default: current directory)
  --registry <path>                   Registry destination (default: ~/.repocontext/repositories.yaml)

Brief options:
  --audience <name>                   technical, product, design, support, operations, or leadership
  --repository <name>                 Limit scope; repeat for multiple repositories
  --change-repository <name>          Repository for bounded change evidence
  --base <sha> --head <sha>           Compare two 7-40 character Git revisions

RepoContext writes the brief only to stdout. Redirect it explicitly when an artifact is required.`;
}

function formatInitResult(result: Awaited<ReturnType<typeof initializeRepoContext>>): string {
  const first = result.firstContext;
  return [
    `RepoContext initialized: ${result.readiness.status}`,
    `Registry: ${result.registry.path} (${result.registry.created ? 'created' : 'already matched'})`,
    formatDoctorReport(result.readiness),
    '',
    `First context: ${first.statement}`,
    `Source: ${first.repository}/${first.sourcePath}:${first.line}`,
    `Commit: ${first.commitSha}`,
    '',
    `Client configuration (${result.client}):`,
    result.clientConfig,
    '',
    'Next: add this configuration to your MCP client, restart it, and call wiki.catalog.',
  ].join('\n');
}
