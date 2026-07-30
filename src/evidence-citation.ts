import type { getRepoFile } from './git-content';
import {
  PRODUCT_CONTRACT,
  PRODUCT_NAME,
  type Citation,
  type EvidenceCandidate,
  type ProvenanceKind,
} from './evidence-types';

/** Parse human `repo/path:line @ sha` or range form `repo/path:1-3 @ sha`. */
export function parseCiteString(cite: string): {
  repository: string;
  sourcePath: string;
  line: number | null;
  lineEnd: number | null;
  commitSha: string | null;
} | null {
  const match = cite
    .trim()
    .match(
      /^(?<repository>[^/\s]+)\/(?<sourcePath>.+?)(?::(?<lineStart>\d+)(?:-(?<lineEnd>\d+))?)?(?:\s+@\s+(?<sha>[0-9a-f]{7,40}|\(no commit\)))?$/iu,
    );
  if (!match?.groups) return null;
  const { repository, sourcePath, lineStart, lineEnd, sha } = match.groups;
  if (!repository || !sourcePath) return null;
  const line = lineStart ? Number.parseInt(lineStart, 10) : null;
  const end = lineEnd ? Number.parseInt(lineEnd, 10) : line;
  const commitSha = !sha || sha === '(no commit)' ? null : sha;
  return { repository, sourcePath, line, lineEnd: end, commitSha };
}

/** Parse durable `gitpin:repo@sha:path` or `gitpin:repo@sha:path:line`. */
export function parseHandle(handle: string): {
  repository: string;
  sourcePath: string | null;
  line: number | null;
  commitSha: string;
} | null {
  const match = handle.trim().match(/^gitpin:(?<repository>[^@\s]+)@(?<sha>[0-9a-f]{7,40})(?::(?<rest>.+))?$/iu);
  if (!match?.groups?.repository || !match.groups.sha) return null;
  const rest = match.groups.rest;
  if (!rest) {
    return { repository: match.groups.repository, sourcePath: null, line: null, commitSha: match.groups.sha };
  }
  const lineMatch = rest.match(/^(?<sourcePath>.+):(?<line>\d+)$/u);
  if (lineMatch?.groups?.sourcePath && lineMatch.groups.line) {
    return {
      repository: match.groups.repository,
      sourcePath: lineMatch.groups.sourcePath,
      line: Number.parseInt(lineMatch.groups.line, 10),
      commitSha: match.groups.sha,
    };
  }
  return {
    repository: match.groups.repository,
    sourcePath: rest,
    line: null,
    commitSha: match.groups.sha,
  };
}

export function extractCitesFromText(text: string): string[] {
  const pattern = /[A-Za-z0-9._-]+\/[^\s@]+(?::\d+(?:-\d+)?)?\s+@\s+[0-9a-f]{7,40}/giu;
  const found = text.match(pattern) ?? [];
  return [...new Set(found.map((item) => item.trim()))];
}

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
  const repoAtSha = commitSha ? `${input.repository}@${commitSha}` : null;
  const handle = commitSha
    ? line !== null
      ? `gitpin:${input.repository}@${commitSha}:${input.sourcePath}:${line}`
      : `gitpin:${input.repository}@${commitSha}:${input.sourcePath}`
    : null;
  return {
    repository: input.repository,
    sourcePath: input.sourcePath,
    line,
    lineEnd,
    commitSha,
    provenance,
    cite: `${input.repository}/${input.sourcePath}${linePart}${shaPart}`,
    handle,
    repoAtSha,
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
    note: 'Search hits are candidates, not claims. Call pin.prove (then pin.verify) before asserting a fact. Prefer pin.prove_set for multi-repo answers.',
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
