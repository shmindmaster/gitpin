import { compareRepoCommits } from './git';
import { sha256 } from './git-shared';
import { EXPECTED_DOCUMENTS, getDocumentationRows, type DocumentationRow } from './documentation-analysis';

export const BRIEF_AUDIENCES = ['technical', 'product', 'design', 'support', 'operations', 'leadership'] as const;
export type BriefAudience = (typeof BRIEF_AUDIENCES)[number];

export interface BriefChangeRange {
  repository: string;
  base: string;
  head: string;
}

export interface ContextBriefInput {
  audience?: BriefAudience;
  repositories?: string[];
  changeRange?: BriefChangeRange;
}

export interface EvidenceTrace {
  repository: string;
  sourcePath: string | null;
  line: number | null;
  commitSha: string | null;
  confidence: DocumentationRow['confidence'];
  originatingOperation: 'wiki.analyze:brief';
}

export interface BriefEvidence {
  id: string;
  label: 'known' | 'gap';
  statement: string;
  trace: EvidenceTrace;
}

const MAX_CHANGED_PATHS = 100;

export async function getContextBrief(input: ContextBriefInput = {}) {
  const audience = input.audience ?? 'technical';
  const rows = getDocumentationRows(input.repositories);
  const knownFacts = rows.flatMap(knownDocumentFacts);
  const gaps = rows.flatMap(documentGaps);
  const changeSummary = input.changeRange ? await buildChangeEvidence(input.changeRange, rows, knownFacts, gaps) : null;
  const totalDocuments = rows.reduce((total, row) => total + row.docCount, 0);
  const staleRepositories = rows.filter((row) => row.stale).length;
  const unavailableRepositories = rows.filter((row) => row.confidence === 'unavailable').length;
  const evidenceSetId = sha256(JSON.stringify({ knownFacts, gaps, changeSummary }));

  return {
    type: 'ContextBrief',
    schemaVersion: 1,
    evidenceSetId,
    audience,
    presentation: {
      focus: audienceFocus(audience),
      summary: `Examined ${rows.length} repositories at pinned revisions: ${totalDocuments} exposed documents, ${staleRepositories} stale repositories, and ${unavailableRepositories} unavailable repositories.`,
    },
    scope: {
      examinedRepositories: rows.length,
      totalDocuments,
      staleRepositories,
      unavailableRepositories,
      repositories: rows.map(({ repository, docCount, commitSha, confidence, stale, coverage, message }) => ({
        repository,
        docCount,
        commitSha,
        confidence,
        stale,
        coverage,
        ...(message ? { message } : {}),
      })),
      ...(changeSummary ? { changeRange: changeSummary } : {}),
    },
    knownFacts,
    inferences: [],
    gaps,
    nextSafeAction: {
      label: 'inference' as const,
      kind: 'recommendation' as const,
      statement: nextSafeAction(rows, gaps),
    },
    technicalTrace: knownFacts.map(({ id, trace }) => ({ evidenceId: id, ...trace })),
  };
}

function knownDocumentFacts(row: DocumentationRow): BriefEvidence[] {
  if (!row.commitSha || row.confidence === 'unavailable') return [];
  return EXPECTED_DOCUMENTS.flatMap((expected) =>
    row.sourcePaths.includes(expected.path)
      ? [
          {
            id: `document:${row.repository}:${expected.path}`,
            label: 'known' as const,
            statement: `${row.repository} exposes ${expected.label} at ${expected.path}.`,
            trace: trace(row, expected.path, row.emptySourcePaths.includes(expected.path) ? null : 1),
          },
        ]
      : [],
  );
}

function documentGaps(row: DocumentationRow): BriefEvidence[] {
  const gaps: BriefEvidence[] = [];
  if (row.confidence === 'unavailable') {
    gaps.push({
      id: `unavailable:${row.repository}`,
      label: 'gap',
      statement: `${row.repository} is unavailable, so no repository evidence was treated as known.`,
      trace: trace(row, null, null),
    });
    return gaps;
  }
  for (const expected of EXPECTED_DOCUMENTS) {
    if (row.sourcePaths.includes(expected.path)) continue;
    gaps.push({
      id: `document-gap:${row.repository}:${expected.path}`,
      label: 'gap',
      statement: `${row.repository} does not expose ${expected.label} at ${expected.path}; it may be absent or policy-denied.`,
      trace: trace(row, expected.path, null),
    });
  }
  if (row.stale) {
    gaps.push({
      id: `stale:${row.repository}`,
      label: 'gap',
      statement: `${row.repository} has local documentation or policy changes that are excluded from the pinned evidence.`,
      trace: trace(row, null, null),
    });
  }
  return gaps;
}

async function buildChangeEvidence(
  range: BriefChangeRange,
  rows: DocumentationRow[],
  knownFacts: BriefEvidence[],
  gaps: BriefEvidence[],
) {
  const row = rows.find((candidate) => candidate.repository === range.repository);
  if (!row || row.confidence === 'unavailable') {
    gaps.push({
      id: `change-range-unavailable:${range.repository}`,
      label: 'gap',
      statement:
        row?.message ?? `The requested change range repository ${range.repository} is outside the selected scope.`,
      trace: {
        repository: range.repository,
        sourcePath: null,
        line: null,
        commitSha: null,
        confidence: 'unavailable',
        originatingOperation: 'wiki.analyze:brief',
      },
    });
    return { repository: range.repository, base: range.base, head: range.head, status: 'unavailable' as const };
  }

  const comparison = await compareRepoCommits(range.repository, range.base, range.head);
  if ('error' in comparison && typeof comparison.error === 'string') {
    gaps.push({
      id: `change-range-error:${range.repository}`,
      label: 'gap',
      statement: comparison.error,
      trace: trace(row, null, null),
    });
    return { repository: range.repository, base: range.base, head: range.head, status: 'unavailable' as const };
  }

  for (const file of comparison.files.slice(0, MAX_CHANGED_PATHS)) {
    knownFacts.push({
      id: `change:${range.repository}:${file.status}:${file.path}`,
      label: 'known',
      statement: `${range.repository} changed ${file.path} with Git status ${file.status}.`,
      trace: {
        repository: range.repository,
        sourcePath: file.path,
        line: null,
        commitSha: comparison.head,
        confidence: row.confidence,
        originatingOperation: 'wiki.analyze:brief',
      },
    });
  }
  if (comparison.files.length > MAX_CHANGED_PATHS) {
    gaps.push({
      id: `change-range-truncated:${range.repository}`,
      label: 'gap',
      statement: `${comparison.files.length - MAX_CHANGED_PATHS} changed paths were omitted by the ${MAX_CHANGED_PATHS}-path brief bound.`,
      trace: {
        repository: range.repository,
        sourcePath: null,
        line: null,
        commitSha: comparison.head,
        confidence: row.confidence,
        originatingOperation: 'wiki.analyze:brief',
      },
    });
  }
  return {
    repository: range.repository,
    base: comparison.base,
    head: comparison.head,
    commitsBetween: comparison.commitsBetween,
    changedPaths: comparison.files.length,
    status: 'compared' as const,
  };
}

function trace(row: DocumentationRow, sourcePath: string | null, line: number | null): EvidenceTrace {
  return {
    repository: row.repository,
    sourcePath,
    line,
    commitSha: row.commitSha,
    confidence: row.confidence,
    originatingOperation: 'wiki.analyze:brief',
  };
}

function audienceFocus(audience: BriefAudience): string {
  const focus: Record<BriefAudience, string> = {
    technical: 'Prioritize exact source traces, revisions, and unresolved documentation gaps.',
    product: 'Prioritize supported capabilities, ownership evidence, and decision-blocking gaps.',
    design: 'Prioritize documented workflows, interaction constraints, and missing experience evidence.',
    support: 'Prioritize operational guidance, known documentation, and unresolved support evidence.',
    operations: 'Prioritize freshness, availability, deployment evidence, and next safe checks.',
    leadership: 'Prioritize bounded knowns, material gaps, and the next reversible decision.',
  };
  return focus[audience];
}

function nextSafeAction(rows: DocumentationRow[], gaps: BriefEvidence[]): string {
  if (rows.length === 0) return 'Select at least one registered repository and regenerate the brief.';
  if (rows.some((row) => row.confidence === 'unavailable'))
    return 'Restore or remove unavailable registry entries before relying on the brief.';
  if (rows.some((row) => row.stale))
    return 'Review and commit or discard local documentation changes, then regenerate the pinned brief.';
  if (gaps.length > 0) return 'Inspect the first cited gap and add or intentionally deny the missing documentation.';
  return 'Use the cited evidence set as input to the next review step; do not treat it as proof of correctness.';
}
