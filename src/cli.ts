import { BRIEF_AUDIENCES, type BriefAudience, getContextBrief } from './context-brief';
import { exitForVerify, parseProveSetOptions, runVerifyCitesCommand, runVerifyCommand } from './cli-verify';
import { doctorExitCode, formatDoctorReport, getDoctorReport } from './doctor';
import { buildEvidenceSet } from './evidence';
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
    console.log(JSON.stringify(await getContextBrief(parseBriefOptions(options)), null, 2));
    return;
  }
  if (command === 'init') {
    const result = await initializeRepoContext(parseInitOptions(options));
    console.log(formatInitResult(result));
    process.exitCode = doctorExitCode(result.readiness);
    return;
  }
  if (command === 'verify') {
    const report = await runVerifyCommand(options);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = exitForVerify(report);
    return;
  }
  if (command === 'prove-set') {
    console.log(JSON.stringify(await buildEvidenceSet(parseProveSetOptions(options)), null, 2));
    return;
  }
  if (command === 'verify-cites') {
    const report = await runVerifyCitesCommand(options);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = exitForVerify(report);
    return;
  }
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(cliHelp());
    return;
  }
  throw new Error(`Unknown command: ${command}. Run "gitpin help" for supported commands.`);
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
        throw new Error(`Unknown brief option: ${option}. Run "gitpin help" for usage.`);
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
  return `GitPin — index-free multi-repo evidence (not generic repo context)

Product loop: catalog → search candidates → prove → verify (Git HEAD only).

Usage:
  gitpin                              Start stdio MCP (12 pin.* tools)
  gitpin init --client <name>         Registry + doctor + first evidence line
  gitpin doctor                       Validate readiness (stale/blocked)
  gitpin brief [options]              EvidenceBrief JSON (knownFacts / gaps / evidenceSetId)
  gitpin verify --repository <n> --path <p> --sha <hex> [--line <n>] [--must-contain <text>]
  gitpin verify --handle gitpin:repo@sha:path[:line]
  gitpin verify --from-pack <pack.json>
  gitpin verify-cites --file <notes.md>
  gitpin prove-set --from-json <items.json>

Init options:
  --client <name>                     ${supportedInitClients.join(', ')}
  --repository <path>                 Git repository root; repeat for multiple (default: cwd)
  --registry <path>                   Registry destination (default: ~/.gitpin/repositories.yaml)

Brief options:
  --audience <name>                   technical, product, design, support, operations, leadership
  --repository <name>                 Limit scope; repeat for multiple
  --change-repository <name>          Repository for bounded change evidence
  --base <sha> --head <sha>           Compare two 7-40 character Git revisions

Verify options:
  --repository <name>                 Registry repository name
  --path <sourcePath>                 Path within the repository
  --sha <hex>                         Claimed commit (7-40 hex)
  --line <n>                          Optional 1-based line to check
  --must-contain <text>               Fail with contradicted if text absent at SHA
  --handle <gitpin:...>               Shortcut for repository/path/sha/line
  --from-pack <file>                  Verify evidence-pack or evidence-set JSON

Cite mini-spec: docs/cite-spec.md
Migration: REPOCONTEXT_* env vars and ~/.repocontext still work as aliases.
GitPin writes briefs only to stdout. Redirect explicitly for artifacts.`;
}

function formatInitResult(result: Awaited<ReturnType<typeof initializeRepoContext>>): string {
  const first = result.firstContext;
  return [
    `GitPin initialized: ${result.readiness.status}`,
    `Registry: ${result.registry.path} (${result.registry.created ? 'created' : 'already matched'})`,
    formatDoctorReport(result.readiness),
    '',
    `First evidence: ${first.statement}`,
    `Source: ${first.repository}/${first.sourcePath}:${first.line}`,
    `Commit: ${first.commitSha}`,
    `Verify: gitpin verify --repository ${first.repository} --path ${first.sourcePath} --line ${first.line} --sha ${first.commitSha}`,
    '',
    `Client configuration (${result.client}):`,
    result.clientConfig,
    '',
    'Next: paste this into your MCP client, restart it, then pin.catalog → pin.prove → pin.verify.',
  ].join('\n');
}
