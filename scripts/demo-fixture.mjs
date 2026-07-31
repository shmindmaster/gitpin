import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtureAuthor = {
  GIT_AUTHOR_NAME: 'GitPin Demo',
  GIT_AUTHOR_EMAIL: 'demo@gitpin.invalid',
  GIT_COMMITTER_NAME: 'GitPin Demo',
  GIT_COMMITTER_EMAIL: 'demo@gitpin.invalid',
};

export function resetDemoFixture(workspace = process.cwd()) {
  const resolvedWorkspace = resolve(workspace);
  const root = resolve(process.env.REPOCONTEXT_DEMO_ROOT ?? join(resolvedWorkspace, '.demo', 'runtime'));
  assertSafeDemoRoot(resolvedWorkspace, root);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });

  const repositoriesRoot = join(root, 'repositories');
  const atlasApi = createAtlasApi(repositoriesRoot);
  const merchantWeb = createMerchantWeb(repositoriesRoot);
  const supportOps = createSupportOps(repositoriesRoot);
  const registryPath = join(root, 'repositories.yaml');
  writeFileSync(
    registryPath,
    `repositories:\n  - name: atlas-api\n    path: ./repositories/atlas-api\n    branches: [main]\n  - name: merchant-web\n    path: ./repositories/merchant-web\n    branches: [main]\n  - name: support-ops\n    path: ./repositories/support-ops\n    branches: [main]\n`,
    'utf8',
  );

  const fixture = {
    schemaVersion: 1,
    persona: 'Release engineering lead',
    root,
    registryPath,
    repositories: {
      'atlas-api': atlasApi,
      'merchant-web': merchantWeb,
      'support-ops': supportOps,
    },
    expected: {
      repositories: 3,
      documents: 7,
      staleRepositories: ['merchant-web'],
      changedRepository: 'atlas-api',
      changedPaths: ['docs/architecture.md'],
    },
  };
  writeFileSync(join(root, 'truth.json'), `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  return fixture;
}

function createAtlasApi(repositoriesRoot) {
  const path = join(repositoriesRoot, 'atlas-api');
  initializeRepository(path);
  writeFiles(path, {
    'README.md': `# Atlas API\n\nAtlas API validates release evidence before a deployment review.\n`,
    'AGENTS.md': `# Atlas API Agent Instructions\n\nKeep release evidence commit-pinned and reviewable.\n`,
    'docs/architecture.md': `# Architecture\n\nRelease gates begin with a cited source commit.\n`,
  });
  const initialCommit = commit(path, 'seed atlas architecture', '2026-07-01T09:00:00Z');
  writeFileSync(
    join(path, 'docs', 'architecture.md'),
    `# Architecture\n\nRelease gates begin with a cited source commit.\n\nA release brief compares the selected revision before review.\n`,
    'utf8',
  );
  const headCommit = commit(path, 'document release brief evidence', '2026-07-02T09:00:00Z');
  return { path, initialCommit, headCommit, stale: false };
}

function createMerchantWeb(repositoriesRoot) {
  const path = join(repositoriesRoot, 'merchant-web');
  initializeRepository(path);
  writeFiles(path, {
    'README.md': `# Merchant Web\n\nMerchant Web presents release-ready storefront status.\n`,
    'docs/architecture.md': `# Architecture\n\nThe storefront reads only approved release metadata.\n`,
  });
  const headCommit = commit(path, 'seed merchant web', '2026-07-01T09:05:00Z');
  appendFileSync(
    join(path, 'README.md'),
    `\nThis local note is intentionally uncommitted and excluded from evidence.\n`,
    'utf8',
  );
  return { path, initialCommit: headCommit, headCommit, stale: true };
}

function createSupportOps(repositoriesRoot) {
  const path = join(repositoriesRoot, 'support-ops');
  initializeRepository(path);
  writeFiles(path, {
    'README.md': `# Support Ops\n\nSupport Ops records release communications and recovery ownership.\n`,
    'AGENTS.md': `# Support Ops Agent Instructions\n\nEscalate unavailable evidence before a release decision.\n`,
  });
  const headCommit = commit(path, 'seed support operations', '2026-07-01T09:10:00Z');
  return { path, initialCommit: headCommit, headCommit, stale: false };
}

function initializeRepository(path) {
  mkdirSync(path, { recursive: true });
  run('git', ['init', '--quiet', '--initial-branch=main'], path);
  run('git', ['config', 'user.name', fixtureAuthor.GIT_AUTHOR_NAME], path);
  run('git', ['config', 'user.email', fixtureAuthor.GIT_AUTHOR_EMAIL], path);
  run('git', ['config', 'core.autocrlf', 'false'], path);
}

function writeFiles(root, files) {
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, ...path.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
}

function commit(path, message, timestamp) {
  run('git', ['add', '--all'], path);
  run('git', ['commit', '--quiet', '-m', message], path, {
    ...fixtureAuthor,
    GIT_AUTHOR_DATE: timestamp,
    GIT_COMMITTER_DATE: timestamp,
  });
  return runOutput('git', ['rev-parse', 'HEAD'], path).trim();
}

function assertSafeDemoRoot(workspace, root) {
  const demoRoot = resolve(workspace, '.demo');
  const pathFromDemoRoot = relative(demoRoot, root);
  if (
    root === demoRoot ||
    pathFromDemoRoot === '' ||
    pathFromDemoRoot === '..' ||
    pathFromDemoRoot.startsWith('..\\') ||
    pathFromDemoRoot.startsWith('../')
  ) {
    throw new Error('REPOCONTEXT_DEMO_ROOT must be a child directory of this workspace .demo folder.');
  }
}

function run(command, args, cwd, environment = {}) {
  execFileSync(command, args, {
    cwd,
    env: { ...process.env, ...environment },
    stdio: 'pipe',
    windowsHide: true,
  });
}

function runOutput(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', windowsHide: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixture = resetDemoFixture();
  console.log(
    JSON.stringify({
      status: 'ready',
      registry: fixture.registryPath,
      repositories: fixture.expected.repositories,
      documents: fixture.expected.documents,
      staleRepositories: fixture.expected.staleRepositories,
    }),
  );
}
