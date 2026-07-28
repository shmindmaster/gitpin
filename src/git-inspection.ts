import { existsSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { resolveRepoPath } from './registry';
import {
  findFiles,
  gitComponents,
  gitHeadPaths,
  gitHeadSha,
  normalizeRelative,
  readGitPackageManifest,
  readPackageManifest,
  snapshotMetadata,
  testDirectoriesForPath,
} from './git-shared';

interface ComponentStatus {
  component: string;
  branch: string | null;
  commitSha: string | null;
  isClean: boolean;
  modified: number;
  latestCommit: { hash: string; message: string; date: string } | null;
}

interface CommitResult {
  component: string;
  hash: string;
  short: string;
  message?: string;
  author?: string;
  date?: string;
  branch?: string | null;
  snapshotGeneratedAt?: string;
}

export async function getRepoStatus(name: string) {
  const root = resolveRepoPath(name);
  const snapshot = snapshotMetadata(root);
  if (snapshot) {
    return {
      repository: name,
      mode: 'snapshot',
      generatedAt: snapshot.generatedAt,
      sourceRoot: snapshot.sourceRoot,
      components: snapshot.components,
      unversionedDocumentCount: snapshot.unversionedDocuments.length,
    };
  }

  const components = gitComponents(name);
  if (components.length === 0) {
    return {
      repository: name,
      mode: 'workspace',
      isClean: null,
      components: [],
      note: 'No Git repository exists at this workspace root or below it.',
    };
  }
  const statuses: ComponentStatus[] = [];
  for (const component of components) {
    const status = await component.git.status();
    const log = await component.git.log({ maxCount: 1 });
    statuses.push({
      component: component.relativePath,
      branch: status.current,
      commitSha: log.latest?.hash ?? null,
      isClean: status.isClean(),
      modified: status.files.length,
      latestCommit: log.latest ? { hash: log.latest.hash, message: log.latest.message, date: log.latest.date } : null,
    });
  }
  if (components.length === 1 && components[0].relativePath === '.') {
    return { repository: name, mode: 'repository', ...statuses[0] };
  }
  return { repository: name, mode: 'workspace', components: statuses };
}

export async function getRepoCommits(name: string, limit = 10) {
  const root = resolveRepoPath(name);
  const snapshot = snapshotMetadata(root);
  if (snapshot) {
    return snapshot.components.map((component) => ({
      component: component.relativePath,
      hash: component.commitSha,
      short: component.commitSha.slice(0, 7),
      branch: component.branch,
      snapshotGeneratedAt: snapshot.generatedAt,
    }));
  }

  const components = gitComponents(name);
  const commits: CommitResult[] = [];
  for (const component of components) {
    const log = await component.git.log({ maxCount: limit });
    commits.push(
      ...log.all.map((commit) => ({
        component: component.relativePath,
        hash: commit.hash,
        short: commit.hash.slice(0, 7),
        message: commit.message,
        author: commit.author_name,
        date: commit.date,
      })),
    );
  }
  return commits.slice(0, Math.max(limit, limit * components.length));
}

export async function getRepoManifest(name: string) {
  const root = resolveRepoPath(name);
  const snapshot = snapshotMetadata(root);
  const manifestNames = new Set([
    'Cargo.toml',
    'Dockerfile',
    'go.mod',
    'package.json',
    'pnpm-workspace.yaml',
    'pyproject.toml',
    'requirements.txt',
  ]);
  if (snapshot) {
    const manifests = findFiles(root, (path) => manifestNames.has(basename(path)), 100);
    const packageJson = readPackageManifest(root, 'package.json');
    return {
      repository: name,
      mode: 'snapshot',
      commitSha:
        snapshot.components.find((component) => component.relativePath === '.')?.commitSha ??
        snapshot.components[0]?.commitSha ??
        null,
      manifests: manifests.map((path) => normalizeRelative(relative(root, path))),
      hasReadme: existsSync(join(root, 'README.md')),
      hasAgentsMd: existsSync(join(root, 'AGENTS.md')),
      hasCI: existsSync(join(root, '.github', 'workflows')),
      ...(packageJson ? { packageJson } : {}),
    };
  }

  const components = gitComponents(name);
  const componentManifests = components.map((component) => ({
    component: component.relativePath,
    commitSha: gitHeadSha(component),
    files: gitHeadPaths(component),
  }));
  const rootComponent = componentManifests.find((component) => component.component === '.') ?? componentManifests[0];
  const rootGitComponent = rootComponent
    ? components.find((component) => component.relativePath === rootComponent.component)
    : undefined;
  const packageJson =
    rootComponent?.files.includes('package.json') && rootGitComponent
      ? readGitPackageManifest(rootGitComponent, 'package.json')
      : null;
  return {
    repository: name,
    mode: components.length === 1 ? 'repository' : 'workspace',
    commitSha: components.length === 1 ? (componentManifests[0]?.commitSha ?? null) : null,
    components: componentManifests.map(({ component, commitSha }) => ({ component, commitSha })),
    manifests: componentManifests.flatMap(({ component, files }) =>
      files
        .filter((path) => manifestNames.has(basename(path)))
        .map((path) => (component === '.' ? path : `${component}/${path}`)),
    ),
    hasReadme: componentManifests.some(({ files }) => files.includes('README.md')),
    hasAgentsMd: componentManifests.some(({ files }) => files.includes('AGENTS.md')),
    hasCI: componentManifests.some(({ files }) => files.some((path) => path.startsWith('.github/workflows/'))),
    ...(packageJson ? { packageJson } : {}),
  };
}

export async function getRepoTests(name: string) {
  const root = resolveRepoPath(name);
  const snapshot = snapshotMetadata(root);
  if (snapshot) {
    return {
      repository: name,
      mode: 'snapshot',
      commitSha:
        snapshot.components.find((component) => component.relativePath === '.')?.commitSha ??
        snapshot.components[0]?.commitSha ??
        null,
      hasTests: null,
      note: 'Remote snapshots intentionally omit test source; use local stdio to inspect tests.',
    };
  }

  const testDirectoryNames = new Set(['tests', 'test', '__tests__', 'spec']);
  const configNames = new Set([
    'jest.config.js',
    'jest.config.ts',
    'playwright.config.ts',
    'pytest.ini',
    'vitest.config.ts',
  ]);
  const components = gitComponents(name);
  const componentFiles = components.map((component) => ({
    component,
    commitSha: gitHeadSha(component),
    files: gitHeadPaths(component),
  }));
  const testDirs = componentFiles.flatMap(({ component, files }) =>
    files
      .flatMap((path) => testDirectoriesForPath(path, testDirectoryNames))
      .map((path) => (component.relativePath === '.' ? path : `${component.relativePath}/${path}`)),
  );
  const testFiles = componentFiles.flatMap(({ component, files }) =>
    files
      .filter((path) => /(^|\/)([^/]+\.)?(test|spec)\.[^.]+$/i.test(path))
      .map((path) => (component.relativePath === '.' ? path : `${component.relativePath}/${path}`)),
  );
  const configs = componentFiles.flatMap(({ component, files }) =>
    files
      .filter((path) => configNames.has(basename(path)))
      .map((path) => (component.relativePath === '.' ? path : `${component.relativePath}/${path}`)),
  );
  const testScripts = componentFiles.flatMap(({ component, files }) => {
    if (!files.includes('package.json')) return [];
    const packageJson = readGitPackageManifest(component, 'package.json');
    return packageJson?.scripts.includes('test')
      ? [component.relativePath === '.' ? 'test' : `${component.relativePath}:test`]
      : [];
  });
  return {
    repository: name,
    mode: components.length === 1 ? 'repository' : 'workspace',
    commitSha: components.length === 1 ? (componentFiles[0]?.commitSha ?? null) : null,
    components: componentFiles.map(({ component, commitSha }) => ({ component: component.relativePath, commitSha })),
    testDirs: [...new Set(testDirs)],
    testConfigs: [...new Set(configs)],
    testFiles,
    testScripts,
    hasTests: testDirs.length > 0 || configs.length > 0 || testFiles.length > 0 || testScripts.length > 0,
  };
}
