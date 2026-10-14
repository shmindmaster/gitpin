#!/usr/bin/env node
// Live hero fixture for the PR evidence gate: an agent-authored change fails with
// `uncovered-change`, one evidence locator is added, and the same gate passes.
//
// Every step is a real `gitpin gate` run against a real synthetic git repository, so a
// recording shows commands and exit codes, not stored artifact JSON.
//
//   node scripts/demo-gate-hero.mjs setup <dir>        build the repo, stop at the failing PR
//   node scripts/demo-gate-hero.mjs gate <dir>         run `gitpin gate` for base..HEAD
//   node scripts/demo-gate-hero.mjs add-locator <dir>  commit the one missing locator
//   node scripts/demo-gate-hero.mjs run [dir]          whole sequence; exit 0 only on fail -> pass
//
// The repository is created in a scratch directory and never inside GitPin itself.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SERVER_PATH = resolve(HERE, '..', 'dist', 'server.js');

export const UNCOVERED_PATH = 'docs/protocol.md';
export const UNCOVERED_LINE = 5;
const COVERED_PATH = 'docs/overview.md';
const COVERED_LINE = 3;
const UNCOVERED_TEXT = 'Retries stop after three attempts and are logged with the request id.';
const COVERED_TEXT = 'Release notes are generated from the merged pull requests.';
const MANIFEST_PATH = '.gitpin/change-evidence.json';

const AUTHOR = { name: 'GitPin Demo', email: 'demo@gitpin.invalid' };
const DATES = {
  base: '2026-01-01T10:00:00Z',
  agent: '2026-01-01T10:01:00Z',
  locator: '2026-01-01T10:02:00Z',
};

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const GIT_ENV = {
  GIT_AUTHOR_NAME: AUTHOR.name,
  GIT_AUTHOR_EMAIL: AUTHOR.email,
  GIT_COMMITTER_NAME: AUTHOR.name,
  GIT_COMMITTER_EMAIL: AUTHOR.email,
};

function git(cwd, args, env = {}) {
  return execFileSync('git', args, {
    cwd,
    env: { ...process.env, ...GIT_ENV, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim();
}

function commitAll(cwd, message, date) {
  git(cwd, ['add', '--all']);
  git(cwd, ['commit', '-qm', message], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date });
  return git(cwd, ['rev-parse', 'HEAD']);
}

function write(cwd, path, text) {
  const target = join(cwd, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text, 'utf8');
}

function manifest(claims) {
  return `${JSON.stringify({ schemaVersion: 1, summary: 'Reword the overview notes line.', claims }, null, 2)}\n`;
}

function overviewClaim() {
  return {
    id: 'CLAIM-1',
    statement: 'The overview now says release notes come from merged pull requests.',
    covers: [COVERED_PATH],
    evidence: [
      {
        ref: 'head',
        path: COVERED_PATH,
        lineStart: COVERED_LINE,
        lineEnd: COVERED_LINE,
        contentSha256: sha256(COVERED_TEXT),
      },
    ],
  };
}

function protocolClaim() {
  return {
    id: 'CLAIM-2',
    statement: 'The protocol now caps retries at three attempts.',
    covers: [UNCOVERED_PATH],
    evidence: [
      {
        ref: 'head',
        path: UNCOVERED_PATH,
        lineStart: UNCOVERED_LINE,
        lineEnd: UNCOVERED_LINE,
        contentSha256: sha256(UNCOVERED_TEXT),
      },
    ],
  };
}

/** Build the repo up to the failing agent PR. Returns the base and head SHAs. */
export function setupHeroFixture(dir) {
  const repo = resolve(dir);
  if (existsSync(join(repo, '.git'))) throw new Error(`${repo} already holds a repository; pass an empty directory.`);
  mkdirSync(repo, { recursive: true });
  git(repo, ['init', '--quiet', '--initial-branch=main']);
  git(repo, ['config', 'core.autocrlf', 'false']);

  write(repo, 'README.md', '# Synthetic service\n\nA synthetic repository for the GitPin gate demo.\n');
  write(
    repo,
    '.gitpin/gate.yml',
    [
      'schemaVersion: 1',
      'manifestPath: .gitpin/change-evidence.json',
      '',
      'coverage:',
      '  include:',
      '    - "docs/**"',
      '',
      'policyChanges: block',
      '',
    ].join('\n'),
  );
  write(repo, COVERED_PATH, '# Overview\n\nRelease notes are written by hand.\n');
  write(repo, UNCOVERED_PATH, '# Protocol\n\nRequests carry a request id.\n');
  write(repo, MANIFEST_PATH, manifest([]));
  const base = commitAll(repo, 'synthetic service base', DATES.base);

  // The agent's PR: it edits two documents but its manifest claims only one of them.
  write(repo, COVERED_PATH, `# Overview\n\n${COVERED_TEXT}\n`);
  write(repo, UNCOVERED_PATH, `# Protocol\n\nRequests carry a request id.\n\n${UNCOVERED_TEXT}\n`);
  write(repo, MANIFEST_PATH, manifest([overviewClaim()]));
  const head = commitAll(repo, 'agent: reword overview and add retry rule', DATES.agent);
  return { repo, base, head };
}

/** The one missing piece: a locator that covers the second file. */
export function addMissingLocator(dir) {
  const repo = resolve(dir);
  write(repo, MANIFEST_PATH, manifest([overviewClaim(), protocolClaim()]));
  return commitAll(repo, 'agent: add evidence locator for docs/protocol.md', DATES.locator);
}

export function rootCommit(dir) {
  return git(resolve(dir), ['rev-list', '--max-parents=0', 'HEAD']).split('\n')[0];
}

/** Run the real CLI. Returns the exit code, the raw text and the parsed report. */
export function runGate(dir, base, head) {
  if (!existsSync(SERVER_PATH)) throw new Error('Expected dist/server.js. Run pnpm build first.');
  const args = [SERVER_PATH, 'gate', '--base', base, '--head', head];
  let output;
  let exitCode = 0;
  try {
    output = execFileSync(process.execPath, args, { cwd: resolve(dir), encoding: 'utf8', windowsHide: true });
  } catch (error) {
    exitCode = typeof error.status === 'number' ? error.status : 1;
    output = String(error.stdout ?? '');
  }
  return { command: `gitpin gate --base ${base} --head ${head}`, exitCode, output, report: JSON.parse(output) };
}

function summarize(result) {
  const { report } = result;
  const lines = [`$ ${result.command}`, `status: ${report.status}   exit code: ${result.exitCode}`];
  for (const violation of report.violations ?? []) {
    lines.push(`violation: ${violation.code}: ${violation.message}`);
  }
  for (const claim of report.claims ?? []) {
    for (const item of claim.evidence ?? []) lines.push(`covered: ${item.citation ?? item.path} (${item.status})`);
  }
  return lines.join('\n');
}

function main(argv) {
  const [command, dirArg] = argv;
  if (command === 'setup') {
    if (!dirArg) throw new Error('setup requires a target directory.');
    const { repo, base, head } = setupHeroFixture(dirArg);
    console.log(JSON.stringify({ repo, base, head, gate: `gitpin gate --base ${base} --head ${head}` }, null, 2));
    return 0;
  }
  if (command === 'gate') {
    if (!dirArg) throw new Error('gate requires the fixture directory.');
    const result = runGate(dirArg, rootCommit(dirArg), git(resolve(dirArg), ['rev-parse', 'HEAD']));
    console.log(summarize(result));
    return result.exitCode;
  }
  if (command === 'add-locator') {
    if (!dirArg) throw new Error('add-locator requires the fixture directory.');
    const head = addMissingLocator(dirArg);
    console.log(JSON.stringify({ head, added: `locator for ${UNCOVERED_PATH}:${UNCOVERED_LINE}` }, null, 2));
    return 0;
  }
  if (command === 'run') {
    const parent = dirArg ? undefined : mkdtempSync(join(tmpdir(), 'gitpin-gate-hero-'));
    // A fixed repository name keeps the citations readable on screen.
    const scratch = dirArg ? resolve(dirArg) : join(parent, 'synthetic-service');
    try {
      const { repo, base, head } = setupHeroFixture(scratch);
      const failed = runGate(repo, base, head);
      console.log(summarize(failed));
      const newHead = addMissingLocator(repo);
      const passed = runGate(repo, base, newHead);
      console.log(summarize(passed));
      const failedForTheRightReason = (failed.report.violations ?? []).some(
        (v) => v.code === 'uncovered-change' && v.path === UNCOVERED_PATH,
      );
      return failed.exitCode !== 0 && failedForTheRightReason && passed.exitCode === 0 ? 0 : 1;
    } finally {
      if (parent) rmSync(parent, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    }
  }
  throw new Error('Usage: demo-gate-hero.mjs setup|gate|add-locator <dir> | run [dir]');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
