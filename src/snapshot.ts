/**
 * Build a docs-only HTTP index from local Git repositories.
 *
 * Only files committed at each current HEAD are copied. Dirty and untracked
 * work never enters the snapshot. The output directory is gitignored and is
 * intended to be embedded in a self-hosted container image.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { stringify } from 'yaml';
import { loadRegistry } from './registry';
import { isAlwaysSensitivePath, isDocumentationAllowed, isPathDenied, parseExposurePolicy } from './policy';

const DOCUMENT_EXTENSIONS = new Set(['.md', '.mdx', '.rst', '.adoc', '.txt']);
const ROOT_MANIFESTS = new Set([
  'AGENTS.md',
  'ARCHITECTURE.md',
  'CHANGELOG.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'Cargo.toml',
  'Dockerfile',
  'GEMINI.md',
  'LICENSE',
  'Makefile',
  'PROJECT_AUDIT.md',
  'README.md',
  'go.mod',
  'package.json',
  'pnpm-workspace.yaml',
  'pyproject.toml',
  'requirements.txt',
]);
const MAX_FILE_BYTES = 500_000;

export interface SnapshotReportEntry {
  repository: string;
  branch: string | null;
  commitSha: string;
  dirtyEntriesExcluded: number;
  files: number;
  bytes: number;
  secretScanExcludedFiles: string[];
}

export function buildSnapshot(outputPath?: string): SnapshotReportEntry[] {
  const workspace = resolve(process.cwd());
  const outputRoot = resolve(outputPath ?? join(workspace, '.repocontext-index'));
  assertSafeOutput(workspace, outputRoot);
  rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(outputRoot, { recursive: true });

  const report: SnapshotReportEntry[] = [];
  const remoteRepositories: Array<{
    name: string;
    path: string;
    branches: string[];
    mode: 'snapshot';
  }> = [];

  for (const repository of loadRegistry()) {
    if (!existsSync(join(repository.path, '.git'))) {
      throw new Error(`Refusing to snapshot non-Git path for "${repository.name}": ${repository.path}`);
    }

    const commitSha = gitText(repository.path, ['rev-parse', 'HEAD']);
    const branch = gitText(repository.path, ['branch', '--show-current']) || null;
    const dirtyEntriesExcluded = gitLines(repository.path, ['status', '--porcelain=v1']).length;
    const tracked = gitNullSeparated(repository.path, ['ls-tree', '-r', '--name-only', '-z', 'HEAD']);
    if (branch && repository.branches.length > 0 && !repository.branches.includes(branch)) {
      throw new Error(
        `Refusing to snapshot "${repository.name}" on unregistered branch "${branch}". Allowed: ${repository.branches.join(', ')}`,
      );
    }
    const policy = loadGitPolicy(repository.path, tracked);
    const selected = tracked.filter((path) => isSnapshotFile(path, policy));
    const folder = safeFolderName(repository.name);
    const destinationRoot = join(outputRoot, folder);
    let bytes = 0;
    let files = 0;

    for (const sourcePath of selected) {
      if (isSensitivePath(sourcePath)) continue;
      const content = execFileSync('git', ['show', `HEAD:${sourcePath}`], {
        cwd: repository.path,
        maxBuffer: MAX_FILE_BYTES + 1,
        windowsHide: true,
      });
      if (content.length > MAX_FILE_BYTES) continue;
      const destination = join(destinationRoot, ...sourcePath.split('/'));
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, content);
      bytes += content.length;
      files += 1;
    }

    const metadata = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      sourceRoot: repository.name,
      components: [
        {
          relativePath: '.',
          branch,
          commitSha,
          dirtyEntriesExcluded,
        },
      ],
      unversionedDocuments: [],
    };
    const metadataPath = join(destinationRoot, '.repocontext', 'snapshot.json');
    mkdirSync(dirname(metadataPath), { recursive: true });
    writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf-8');

    remoteRepositories.push({
      name: repository.name,
      path: `/data/index/${folder}`,
      branches: repository.branches,
      mode: 'snapshot',
    });
    report.push({
      repository: repository.name,
      branch,
      commitSha,
      dirtyEntriesExcluded,
      files,
      bytes,
      secretScanExcludedFiles: [],
    });
  }

  writeFileSync(
    join(outputRoot, 'repositories.yaml'),
    stringify({
      generatedAt: new Date().toISOString(),
      repositories: remoteRepositories,
    }),
    'utf-8',
  );
  excludeSecretFindings(outputRoot, report);
  writeFileSync(join(outputRoot, 'snapshot-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  scanSnapshot(outputRoot);
  return report;
}

function isSnapshotFile(path: string, policy: ReturnType<typeof parseExposurePolicy>): boolean {
  const normalized = path.replace(/\\/g, '/');
  const fileName = basename(normalized);
  if (isPathDenied(normalized, policy)) return false;
  if (DOCUMENT_EXTENSIONS.has(extname(fileName).toLowerCase())) {
    return isDocumentationAllowed(normalized, policy);
  }
  if (!normalized.includes('/') && ROOT_MANIFESTS.has(fileName)) return true;
  if (/^\.github\/workflows\/[^/]+\.(ya?ml)$/i.test(normalized)) return true;
  return false;
}

function loadGitPolicy(repositoryPath: string, tracked: string[]): ReturnType<typeof parseExposurePolicy> {
  const policyPath = ['.repocontext/wiki.yaml', 'docs/wiki.yaml', 'wiki.yaml'].find((path) => tracked.includes(path));
  if (!policyPath) return parseExposurePolicy(null);
  const raw = execFileSync('git', ['show', `HEAD:${policyPath}`], {
    cwd: repositoryPath,
    encoding: 'utf-8',
    maxBuffer: MAX_FILE_BYTES + 1,
    windowsHide: true,
  });
  return parseExposurePolicy(raw);
}

function scanSnapshot(outputRoot: string): void {
  try {
    execFileSync('gitleaks', ['dir', '--no-banner', '--redact', '--exit-code', '1', outputRoot], {
      cwd: process.cwd(),
      stdio: 'pipe',
      timeout: 120_000,
      windowsHide: true,
    });
  } catch (error) {
    const result = error as { stderr?: Buffer | string };
    const detail = result.stderr ? String(result.stderr).trim() : '';
    throw new Error(`Secret scan failed for the generated RepoContext snapshot.${detail ? ` ${detail}` : ''}`);
  }
}

function excludeSecretFindings(outputRoot: string, report: SnapshotReportEntry[]): void {
  const scanReportPath = join(outputRoot, '.repocontext-secret-scan.json');
  try {
    execFileSync(
      'gitleaks',
      [
        'dir',
        '--no-banner',
        '--redact',
        '--exit-code',
        '1',
        '--report-format',
        'json',
        '--report-path',
        scanReportPath,
        outputRoot,
      ],
      {
        cwd: process.cwd(),
        stdio: 'pipe',
        timeout: 120_000,
        windowsHide: true,
      },
    );
  } catch {
    // A nonzero exit is expected when the redacted report contains findings.
  }

  if (!existsSync(scanReportPath)) return;
  const findings = JSON.parse(readFileSync(scanReportPath, 'utf-8')) as Array<{ File?: string }>;
  rmSync(scanReportPath, { force: true });
  const reportByFolder = new Map(report.map((entry) => [safeFolderName(entry.repository), entry]));
  for (const finding of findings) {
    if (!finding.File) continue;
    const findingPath = resolve(process.cwd(), finding.File);
    assertWithinSnapshot(outputRoot, findingPath);
    if (!existsSync(findingPath)) continue;
    const relativePath = relative(outputRoot, findingPath).replace(/\\/g, '/');
    const [folder, ...sourceParts] = relativePath.split('/');
    const excludedBytes = statSync(findingPath).size;
    rmSync(findingPath, { force: true });
    const entry = reportByFolder.get(folder);
    if (entry) {
      entry.files = Math.max(0, entry.files - 1);
      entry.bytes = Math.max(0, entry.bytes - excludedBytes);
      entry.secretScanExcludedFiles.push(sourceParts.join('/'));
    }
  }
}

function gitText(path: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: path,
    encoding: 'utf-8',
    windowsHide: true,
  }).trim();
}

function gitLines(path: string, args: string[]): string[] {
  const output = gitText(path, args);
  return output ? output.split(/\r?\n/) : [];
}

function gitNullSeparated(path: string, args: string[]): string[] {
  const output = execFileSync('git', args, {
    cwd: path,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  return output.split('\0').filter(Boolean);
}

function safeFolderName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '__');
}

function isSensitivePath(path: string): boolean {
  return isAlwaysSensitivePath(path);
}

function assertSafeOutput(workspace: string, outputRoot: string): void {
  const expected = resolve(workspace, '.repocontext-index').toLowerCase();
  if (outputRoot.toLowerCase() !== expected) {
    throw new Error(`Snapshot output must be ${resolve(workspace, '.repocontext-index')}.`);
  }
}
function assertWithinSnapshot(outputRoot: string, target: string): void {
  const root = resolve(outputRoot).toLowerCase();
  const resolvedTarget = resolve(target).toLowerCase();
  if (!resolvedTarget.startsWith(`${root}\\`) && !resolvedTarget.startsWith(`${root}/`)) {
    throw new Error(`Secret scan reported a path outside the snapshot: ${target}`);
  }
}
if (require.main === module) {
  try {
    const report = buildSnapshot();
    console.log(
      JSON.stringify(
        {
          repositories: report.length,
          files: report.reduce((total, item) => total + item.files, 0),
          bytes: report.reduce((total, item) => total + item.bytes, 0),
          dirtyRepositoriesExcluded: report.filter((item) => item.dirtyEntriesExcluded > 0).length,
          report: '.repocontext-index/snapshot-report.json',
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
