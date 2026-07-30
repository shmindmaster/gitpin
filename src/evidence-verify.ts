import { execFileSync } from 'node:child_process';
import { PRODUCT_CONTRACT, PRODUCT_NAME, type VerifyReport } from './evidence-types';
import { getRepoFile } from './git-content';
import { resolveRepoPath } from './registry';

export async function verifyEvidenceClaim(input: {
  repository: string;
  sourcePath: string;
  line?: number;
  sha: string;
}): Promise<VerifyReport> {
  const root = resolveRepoPath(input.repository);
  let atSha: string;
  try {
    atSha = execFileSync('git', ['show', `${input.sha}:${input.sourcePath}`], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });
  } catch {
    return {
      kind: 'verification-report',
      product: PRODUCT_NAME,
      contract: PRODUCT_CONTRACT,
      status: 'missing',
      repository: input.repository,
      sourcePath: input.sourcePath,
      commitSha: input.sha,
      line: input.line ?? null,
      lineText: null,
      headCommitSha: null,
      headMatchesClaimedSha: false,
      command: `git show ${input.sha}:${input.sourcePath}`,
      message: 'Path does not exist at the given commit. Check the SHA and path.',
    };
  }

  const fullSha = execFileSync('git', ['rev-parse', input.sha], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
  const lines = atSha.split(/\r?\n/u);
  const head = await getRepoFile(input.repository, input.sourcePath, input.line, input.line);

  if (head.blocked) {
    return {
      kind: 'verification-report',
      product: PRODUCT_NAME,
      contract: PRODUCT_CONTRACT,
      status: 'blocked',
      repository: input.repository,
      sourcePath: input.sourcePath,
      commitSha: fullSha,
      line: input.line ?? null,
      lineText: null,
      headCommitSha: null,
      headMatchesClaimedSha: false,
      command: `git show ${fullSha}:${input.sourcePath}`,
      message: head.reason ?? 'Path is blocked by sensitive-file policy.',
    };
  }

  const lineBody = input.line === undefined ? null : (lines[input.line - 1] ?? null);
  if (input.line !== undefined && lineBody === null) {
    return {
      kind: 'verification-report',
      product: PRODUCT_NAME,
      contract: PRODUCT_CONTRACT,
      status: 'missing',
      repository: input.repository,
      sourcePath: input.sourcePath,
      commitSha: fullSha,
      line: input.line,
      lineText: null,
      headCommitSha: head.commitSha,
      headMatchesClaimedSha: head.commitSha === fullSha,
      command: `git show ${fullSha}:${input.sourcePath}`,
      message: `Line ${input.line} is outside the file at that commit (${lines.length} lines).`,
    };
  }

  const headMatches = head.commitSha === fullSha;
  return {
    kind: 'verification-report',
    product: PRODUCT_NAME,
    contract: PRODUCT_CONTRACT,
    status: headMatches ? 'ok' : 'mismatch',
    repository: input.repository,
    sourcePath: input.sourcePath,
    commitSha: fullSha,
    line: input.line ?? null,
    lineText: lineBody,
    headCommitSha: head.commitSha,
    headMatchesClaimedSha: headMatches,
    command: `git show ${fullSha}:${input.sourcePath}`,
    message: headMatches
      ? 'Claimed commit matches current HEAD for this path; content is independently re-checkable with git show.'
      : 'Claimed SHA is independently verifiable with git show, but HEAD currently differs (stale citation or moved tip).',
  };
}
