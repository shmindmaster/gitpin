import { createHash } from 'node:crypto';
import { buildCitation } from './evidence-citation';
import { PRODUCT_CONTRACT, PRODUCT_NAME, type EvidencePack } from './evidence-types';
import { getRepoFile } from './git-content';

const AGENT_INSTRUCTION =
  'Cite citation.cite exactly (path, line, full SHA). Dirty worktrees and editor buffers are not evidence. Call pin.verify before treating a claim as checked.';

export async function buildEvidencePack(input: {
  repository: string;
  sourcePath: string;
  lineStart?: number;
  lineEnd?: number;
  claim?: string;
}): Promise<EvidencePack> {
  try {
    const result = await getRepoFile(input.repository, input.sourcePath, input.lineStart, input.lineEnd);
    if (result.blocked) {
      return blockedPack(input, result.reason ?? 'Blocked path.');
    }

    const range = result.range ?? null;
    const content = result.content ?? null;
    const contentSha256 = content ? sha256(content) : null;
    const provenance =
      result.provenance === 'unversioned-workspace-document'
        ? 'unversioned-workspace-document'
        : result.commitSha
          ? 'git-head'
          : 'unavailable';
    const citation = buildCitation({
      repository: result.repository,
      sourcePath: result.sourcePath,
      line: range?.start ?? null,
      lineEnd: range?.end ?? null,
      commitSha: result.commitSha,
      provenance,
    });

    return {
      kind: 'evidence-pack',
      product: PRODUCT_NAME,
      contract: PRODUCT_CONTRACT,
      status: 'ok',
      claim: input.claim ?? null,
      citation,
      repository: result.repository,
      sourcePath: result.sourcePath,
      commitSha: result.commitSha,
      range,
      totalLines: result.totalLines ?? null,
      content,
      contentSha256,
      agentInstruction: AGENT_INSTRUCTION,
      next: result.commitSha
        ? {
            tool: 'pin.verify',
            arguments: {
              repository: result.repository,
              sourcePath: result.sourcePath,
              sha: result.commitSha,
              ...(range ? { line: range.start } : {}),
            },
          }
        : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return missingPack(input, message);
  }
}

function blockedPack(
  input: { repository: string; sourcePath: string; lineStart?: number; lineEnd?: number; claim?: string },
  reason: string,
): EvidencePack {
  return {
    kind: 'evidence-pack',
    product: PRODUCT_NAME,
    contract: PRODUCT_CONTRACT,
    status: 'blocked',
    claim: input.claim ?? null,
    citation: buildCitation({
      repository: input.repository,
      sourcePath: input.sourcePath,
      line: input.lineStart ?? null,
      lineEnd: input.lineEnd ?? null,
      commitSha: null,
      provenance: 'blocked',
    }),
    repository: input.repository,
    sourcePath: input.sourcePath,
    commitSha: null,
    range: null,
    totalLines: null,
    content: null,
    contentSha256: null,
    agentInstruction: `${reason} Do not invent content for blocked paths.`,
    next: null,
  };
}

function missingPack(
  input: { repository: string; sourcePath: string; lineStart?: number; lineEnd?: number; claim?: string },
  message: string,
): EvidencePack {
  return {
    kind: 'evidence-pack',
    product: PRODUCT_NAME,
    contract: PRODUCT_CONTRACT,
    status: 'missing',
    claim: input.claim ?? null,
    citation: buildCitation({
      repository: input.repository,
      sourcePath: input.sourcePath,
      line: input.lineStart ?? null,
      lineEnd: input.lineEnd ?? null,
      commitSha: null,
      provenance: 'missing',
    }),
    repository: input.repository,
    sourcePath: input.sourcePath,
    commitSha: null,
    range: null,
    totalLines: null,
    content: null,
    contentSha256: null,
    agentInstruction: `${message} Say evidence is missing; do not invent file contents.`,
    next: null,
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
