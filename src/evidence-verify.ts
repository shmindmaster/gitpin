import { execFileSync } from 'node:child_process';
import { buildCitation } from './evidence-citation';
import { PRODUCT_CONTRACT, PRODUCT_NAME, type ClaimVerdict, type VerifyReport } from './evidence-types';
import { getRepoFile } from './git-content';
import { resolveRepoPath } from './registry';

export async function verifyEvidenceClaim(input: {
  repository: string;
  sourcePath: string;
  line?: number;
  sha: string;
  mustContain?: string;
}): Promise<VerifyReport> {
  const root = resolveRepoPath(input.repository);
  const mustContain = input.mustContain?.trim() ? input.mustContain : null;
  let atSha: string;
  try {
    atSha = execFileSync('git', ['show', `${input.sha}:${input.sourcePath}`], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });
  } catch {
    return baseReport({
      status: 'missing',
      repository: input.repository,
      sourcePath: input.sourcePath,
      commitSha: input.sha,
      line: input.line ?? null,
      lineText: null,
      headCommitSha: null,
      headMatchesClaimedSha: false,
      mustContain,
      claimTextMatch: mustContain ? false : null,
      claimVerdict: mustContain ? 'unproven' : null,
      command: `git show ${input.sha}:${input.sourcePath}`,
      message: 'Path does not exist at the given commit. Check the SHA and path.',
    });
  }

  const fullSha = execFileSync('git', ['rev-parse', input.sha], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
  const lines = atSha.split(/\r?\n/u);
  const head = await getRepoFile(input.repository, input.sourcePath, input.line, input.line);

  if (head.blocked) {
    return baseReport({
      status: 'blocked',
      repository: input.repository,
      sourcePath: input.sourcePath,
      commitSha: fullSha,
      line: input.line ?? null,
      lineText: null,
      headCommitSha: null,
      headMatchesClaimedSha: false,
      mustContain,
      claimTextMatch: null,
      claimVerdict: mustContain ? 'unproven' : null,
      command: `git show ${fullSha}:${input.sourcePath}`,
      message: head.reason ?? 'Path is blocked by sensitive-file policy.',
    });
  }

  const lineBody = input.line === undefined ? null : (lines[input.line - 1] ?? null);
  if (input.line !== undefined && lineBody === null) {
    return baseReport({
      status: 'missing',
      repository: input.repository,
      sourcePath: input.sourcePath,
      commitSha: fullSha,
      line: input.line,
      lineText: null,
      headCommitSha: head.commitSha,
      headMatchesClaimedSha: head.commitSha === fullSha,
      mustContain,
      claimTextMatch: mustContain ? false : null,
      claimVerdict: mustContain ? 'unproven' : null,
      command: `git show ${fullSha}:${input.sourcePath}`,
      message: `Line ${input.line} is outside the file at that commit (${lines.length} lines).`,
    });
  }

  const scopeText = input.line === undefined ? atSha : (lineBody ?? '');
  const claimTextMatch = mustContain === null ? null : scopeText.includes(mustContain);
  if (mustContain !== null && claimTextMatch === false) {
    return baseReport({
      status: 'contradicted',
      repository: input.repository,
      sourcePath: input.sourcePath,
      commitSha: fullSha,
      line: input.line ?? null,
      lineText: lineBody,
      headCommitSha: head.commitSha,
      headMatchesClaimedSha: head.commitSha === fullSha,
      mustContain,
      claimTextMatch: false,
      claimVerdict: 'contradicted',
      command: `git show ${fullSha}:${input.sourcePath}`,
      message: input.line
        ? `Claimed text is not present on line ${input.line} at the given commit.`
        : 'Claimed text is not present in the file at the given commit.',
    });
  }

  const headMatches = head.commitSha === fullSha;
  const claimVerdict: ClaimVerdict = mustContain === null ? null : headMatches ? 'supported' : 'supported';
  return baseReport({
    status: headMatches ? 'ok' : 'mismatch',
    repository: input.repository,
    sourcePath: input.sourcePath,
    commitSha: fullSha,
    line: input.line ?? null,
    lineText: lineBody,
    headCommitSha: head.commitSha,
    headMatchesClaimedSha: headMatches,
    mustContain,
    claimTextMatch,
    claimVerdict: mustContain === null ? null : claimVerdict,
    command: `git show ${fullSha}:${input.sourcePath}`,
    message: messageFor(headMatches, mustContain !== null),
  });
}

function messageFor(headMatches: boolean, checkedText: boolean): string {
  if (headMatches && checkedText) {
    return 'Claimed commit matches HEAD; claimed text is present and independently re-checkable with git show.';
  }
  if (headMatches) {
    return 'Claimed commit matches current HEAD for this path; content is independently re-checkable with git show.';
  }
  if (checkedText) {
    return 'Claimed text is present at the given SHA (verifiable with git show), but HEAD currently differs.';
  }
  return 'Claimed SHA is independently verifiable with git show, but HEAD currently differs (stale citation or moved tip).';
}

function baseReport(
  fields: Omit<VerifyReport, 'kind' | 'product' | 'contract' | 'citation'> & {
    claimVerdict: ClaimVerdict;
  },
): VerifyReport {
  const citation =
    fields.commitSha && fields.status !== 'missing'
      ? buildCitation({
          repository: fields.repository,
          sourcePath: fields.sourcePath,
          line: fields.line,
          commitSha: fields.commitSha,
          provenance: fields.status === 'blocked' ? 'blocked' : 'git-head',
        })
      : fields.commitSha
        ? buildCitation({
            repository: fields.repository,
            sourcePath: fields.sourcePath,
            line: fields.line,
            commitSha: fields.commitSha,
          })
        : null;
  return {
    kind: 'verification-report',
    product: PRODUCT_NAME,
    contract: PRODUCT_CONTRACT,
    ...fields,
    citation,
  };
}
