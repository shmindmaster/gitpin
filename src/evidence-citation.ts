import type { getRepoFile } from './git-content';
import {
  PRODUCT_CONTRACT,
  PRODUCT_NAME,
  type Citation,
  type EvidenceCandidate,
  type ProvenanceKind,
} from './evidence-types';

export function buildCitation(input: {
  repository: string;
  sourcePath: string;
  line?: number | null;
  lineEnd?: number | null;
  commitSha?: string | null;
  provenance?: ProvenanceKind;
}): Citation {
  const line = input.line ?? null;
  const lineEnd = input.lineEnd ?? line;
  const commitSha = input.commitSha ?? null;
  const provenance = input.provenance ?? (commitSha ? 'git-head' : 'unavailable');
  const linePart = line === null ? '' : lineEnd !== null && lineEnd !== line ? `:${line}-${lineEnd}` : `:${line}`;
  const shaPart = commitSha ? ` @ ${commitSha}` : ' @ (no commit)';
  const gitShow = commitSha ? `git show ${commitSha}:${input.sourcePath}` : null;
  const gitpinCli =
    commitSha && line !== null
      ? `gitpin verify --repository ${input.repository} --path ${input.sourcePath} --line ${line} --sha ${commitSha}`
      : commitSha
        ? `gitpin verify --repository ${input.repository} --path ${input.sourcePath} --sha ${commitSha}`
        : null;
  return {
    repository: input.repository,
    sourcePath: input.sourcePath,
    line,
    lineEnd,
    commitSha,
    provenance,
    cite: `${input.repository}/${input.sourcePath}${linePart}${shaPart}`,
    verify: { gitShow, gitpinCli },
  };
}

export function asCandidateHits(
  hits: Array<{
    repository: string;
    sourcePath: string;
    line: number;
    snippet: string;
    commitSha: string | null;
    confidence?: string;
  }>,
  query: string,
): {
  kind: 'evidence-candidates';
  product: typeof PRODUCT_NAME;
  contract: typeof PRODUCT_CONTRACT;
  query: string;
  count: number;
  hits: EvidenceCandidate[];
  note: string;
} {
  return {
    kind: 'evidence-candidates',
    product: PRODUCT_NAME,
    contract: PRODUCT_CONTRACT,
    query,
    count: hits.length,
    hits: hits.map((hit) => {
      const citation = buildCitation({
        repository: hit.repository,
        sourcePath: hit.sourcePath,
        line: hit.line,
        commitSha: hit.commitSha,
        provenance: hit.commitSha ? 'git-head' : 'unavailable',
      });
      return {
        repository: hit.repository,
        sourcePath: hit.sourcePath,
        line: hit.line,
        snippet: hit.snippet,
        commitSha: hit.commitSha,
        citation,
        next: {
          tool: 'pin.prove' as const,
          arguments: {
            repository: hit.repository,
            sourcePath: hit.sourcePath,
            lineStart: hit.line,
            lineEnd: hit.line,
          },
        },
      };
    }),
    note: 'Search hits are candidates, not claims. Call pin.prove (then pin.verify) before asserting a fact.',
  };
}

export function asCodeCandidateHits(
  repository: string,
  query: string,
  hits: Array<{
    component: string;
    sourcePath: string;
    line: number;
    snippet: string;
    commitSha: string | null;
  }>,
) {
  return asCandidateHits(
    hits.map((hit) => ({
      repository,
      sourcePath: hit.sourcePath,
      line: hit.line,
      snippet: hit.snippet,
      commitSha: hit.commitSha,
    })),
    query,
  );
}

export function asPinnedSlice(result: Awaited<ReturnType<typeof getRepoFile>>): Record<string, unknown> {
  if (result.blocked) {
    return {
      kind: 'evidence-slice',
      product: PRODUCT_NAME,
      contract: PRODUCT_CONTRACT,
      status: 'blocked',
      repository: result.repository,
      sourcePath: result.sourcePath,
      reason: result.reason ?? 'blocked',
      citation: buildCitation({
        repository: result.repository,
        sourcePath: result.sourcePath,
        commitSha: null,
        provenance: 'blocked',
      }),
    };
  }
  const range = result.range ?? null;
  const citation = buildCitation({
    repository: result.repository,
    sourcePath: result.sourcePath,
    line: range?.start ?? null,
    lineEnd: range?.end ?? null,
    commitSha: result.commitSha,
    provenance: result.provenance === 'unversioned-workspace-document' ? 'unversioned-workspace-document' : 'git-head',
  });
  return {
    kind: 'evidence-slice',
    product: PRODUCT_NAME,
    contract: PRODUCT_CONTRACT,
    status: 'ok',
    ...result,
    citation,
    next: {
      tool: 'pin.prove',
      arguments: {
        repository: result.repository,
        sourcePath: result.sourcePath,
        ...(range ? { lineStart: range.start, lineEnd: range.end } : {}),
      },
    },
  };
}
