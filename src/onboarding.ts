import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, resolve, sep } from 'node:path';
import { stringify } from 'yaml';
import { getContextBrief } from './context-brief';
import { type DoctorReport, getDoctorReport } from './doctor';
import { getDocumentationRows } from './documentation-analysis';
import { clearRegistryCache, setRegistryPath } from './registry';
import { getDocs } from './wiki';

export const supportedInitClients = ['claude-code', 'codex', 'cursor', 'windsurf', 'zed', 'continue'] as const;
export type InitClient = (typeof supportedInitClients)[number];

export interface InitInput {
  client: InitClient;
  repositories: string[];
  registryPath?: string;
}

export interface InitResult {
  registry: {
    path: string;
    created: boolean;
    repositories: string[];
  };
  readiness: DoctorReport;
  firstContext: {
    statement: string;
    repository: string;
    sourcePath: string;
    line: number;
    commitSha: string;
  };
  client: InitClient;
  clientConfig: string;
}

interface RegisteredRepository {
  name: string;
  path: string;
  branches: string[];
}

export async function initializeRepoContext(input: InitInput): Promise<InitResult> {
  const registryPath = resolve(input.registryPath ?? defaultRegistryPath());
  const repositories = uniqueRepositories(input.repositories).map(inspectRepository);
  assertUniqueNames(repositories);
  assertRegistryOutsideRepositories(registryPath, repositories);
  const registry = stringify({
    repositories: repositories.map(({ name, path, branches }) => ({
      name,
      path: path.replace(/\\/gu, '/'),
      branches,
    })),
  });
  const created = writeRegistryIfAbsentOrIdentical(registryPath, registry);

  setRegistryPath(registryPath);
  clearRegistryCache();
  try {
    const readiness = await getDoctorReport();
    const repositoryNames = repositories.map(({ name }) => name);
    const brief = await getContextBrief({ repositories: repositoryNames });
    const firstContext = await findFirstContext(repositoryNames, brief.knownFacts);
    return {
      registry: {
        path: registryPath,
        created,
        repositories: repositories.map(({ name }) => name),
      },
      readiness,
      firstContext,
      client: input.client,
      clientConfig: clientConfiguration(input.client, registryPath),
    };
  } finally {
    setRegistryPath(null);
    clearRegistryCache();
  }
}

export function parseInitOptions(options: string[], currentDirectory = process.cwd()): InitInput {
  let client: InitClient | undefined;
  let registryPath: string | undefined;
  const repositories: string[] = [];

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    const value = options[index + 1];
    if (!['--client', '--repository', '--registry'].includes(option)) {
      throw new Error(`Unknown init option: ${option}. Run "gitpin help" for usage.`);
    }
    if (!value || value.startsWith('--')) throw new Error(`Option ${option} requires a value.`);
    if (option === '--client') {
      if (!supportedInitClients.includes(value as InitClient)) {
        throw new Error(`Client must be one of: ${supportedInitClients.join(', ')}.`);
      }
      client = value as InitClient;
    } else if (option === '--repository') {
      repositories.push(resolve(currentDirectory, value));
    } else {
      registryPath = resolve(currentDirectory, value);
    }
    index += 1;
  }

  if (!client) throw new Error(`--client is required. Choose one of: ${supportedInitClients.join(', ')}.`);
  return {
    client,
    repositories: repositories.length > 0 ? repositories : [resolve(currentDirectory)],
    ...(registryPath ? { registryPath } : {}),
  };
}

function defaultRegistryPath(): string {
  return resolve(homedir(), '.gitpin', 'repositories.yaml');
}

function uniqueRepositories(paths: string[]): string[] {
  const unique = [...new Set(paths.map((path) => resolve(path)))];
  if (unique.length === 0) throw new Error('At least one repository is required.');
  return unique;
}

function inspectRepository(path: string): RegisteredRepository {
  const repositoryPath = resolve(path);
  let gitRoot: string;
  try {
    gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: repositoryPath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }).trim();
  } catch {
    throw new Error(
      `${repositoryPath} is not a Git repository root. Pass a committed Git repository with --repository.`,
    );
  }
  if (realpathSync.native(resolve(gitRoot)).toLowerCase() !== realpathSync.native(repositoryPath).toLowerCase()) {
    throw new Error(`${repositoryPath} is not a Git repository root. Use ${resolve(gitRoot)} instead.`);
  }
  try {
    execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repositoryPath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch {
    throw new Error(`${repositoryPath} has no commit at HEAD. Commit documentation before initializing GitPin.`);
  }
  const branch = execFileSync('git', ['branch', '--show-current'], {
    cwd: repositoryPath,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim();
  return {
    name: basename(repositoryPath),
    path: repositoryPath,
    branches: [branch || 'main'],
  };
}

function assertUniqueNames(repositories: RegisteredRepository[]): void {
  const names = new Set<string>();
  for (const repository of repositories) {
    if (names.has(repository.name)) {
      throw new Error(
        `Repository name "${repository.name}" is duplicated. Use registry YAML directly to assign distinct names.`,
      );
    }
    names.add(repository.name);
  }
}

function assertRegistryOutsideRepositories(path: string, repositories: RegisteredRepository[]): void {
  const registryPath = canonicalPath(path);
  for (const repository of repositories) {
    const root = canonicalPath(repository.path);
    if (registryPath === root || registryPath.startsWith(`${root}${sep}`)) {
      throw new Error(`Registry must stay outside indexed repositories. Choose a path outside ${repository.path}.`);
    }
  }
}

function canonicalPath(path: string): string {
  let existingAncestor = resolve(path);
  const missingSegments: string[] = [];
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor);
    if (parent === existingAncestor) break;
    missingSegments.unshift(basename(existingAncestor));
    existingAncestor = parent;
  }
  const canonicalAncestor = existsSync(existingAncestor) ? realpathSync.native(existingAncestor) : existingAncestor;
  return resolve(canonicalAncestor, ...missingSegments).toLowerCase();
}

function writeRegistryIfAbsentOrIdentical(path: string, content: string): boolean {
  if (existsSync(path)) {
    if (readFileSync(path, 'utf8') === content) return false;
    throw new Error(
      `Refusing to replace existing registry at ${path}. Review it or pass --registry with a new destination.`,
    );
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, { encoding: 'utf8', flag: 'wx' });
  return true;
}

function clientConfiguration(client: InitClient, registryPath: string): string {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const packageSpec = 'gitpin@latest';
  const server = {
    command,
    args: ['-y', packageSpec],
    env: { GITPIN_REGISTRY: registryPath },
  };
  if (client === 'codex')
    return `codex mcp add --env ${shellArgument(`GITPIN_REGISTRY=${registryPath}`)} gitpin -- ${command} -y ${packageSpec}`;
  if (client === 'claude-code')
    return `claude mcp add gitpin -e ${shellArgument(`GITPIN_REGISTRY=${registryPath}`)} -- ${command} -y ${packageSpec}`;
  if (client === 'cursor') return JSON.stringify({ mcpServers: { gitpin: { type: 'stdio', ...server } } }, null, 2);
  if (client === 'zed') return JSON.stringify({ context_servers: { gitpin: server } }, null, 2);
  if (client === 'continue') {
    return stringify({
      name: 'GitPin',
      version: '0.5.2',
      schema: 'v1',
      mcpServers: [{ name: 'GitPin', type: 'stdio', ...server }],
    }).trim();
  }
  return JSON.stringify({ mcpServers: { gitpin: server } }, null, 2);
}

async function findFirstContext(
  repositoryNames: string[],
  knownFacts: Awaited<ReturnType<typeof getContextBrief>>['knownFacts'],
): Promise<InitResult['firstContext']> {
  const fact = knownFacts.find(
    ({ trace }) => Boolean(trace.sourcePath) && trace.line !== null && Boolean(trace.commitSha),
  );
  if (fact?.trace.sourcePath && fact.trace.line !== null && fact.trace.commitSha) {
    return {
      statement: fact.statement,
      repository: fact.trace.repository,
      sourcePath: fact.trace.sourcePath,
      line: fact.trace.line,
      commitSha: fact.trace.commitSha,
    };
  }

  for (const row of getDocumentationRows(repositoryNames)) {
    for (const sourcePath of row.sourcePaths) {
      const page = await getDocs(row.repository, sourcePath);
      if (!page?.body.trim() || !page.commitSha) continue;
      const line = page.body.split(/\r?\n/u).findIndex((value) => value.trim().length > 0) + 1;
      return {
        statement: `${row.repository} exposes ${page.title} at ${sourcePath}.`,
        repository: row.repository,
        sourcePath,
        line,
        commitSha: page.commitSha,
      };
    }
  }
  throw new Error('GitPin could not produce a cited first result. Commit a non-empty documentation file and retry.');
}

function shellArgument(value: string): string {
  if (process.platform === 'win32') return `"${value.replace(/`/gu, '``').replace(/"/gu, '`"')}"`;
  return `'${value.replace(/'/gu, "'\\''")}'`;
}
