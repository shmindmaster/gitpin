import { createHash } from 'node:crypto';
import { buildEvidencePack } from './evidence-prove';
import {
  MAX_EVIDENCE_SET_ITEMS,
  PRODUCT_CONTRACT,
  PRODUCT_NAME,
  type EvidenceSet,
  type ProveItemInput,
  type VerifyItemInput,
  type VerifyReport,
  type VerifySetReport,
} from './evidence-types';
import { verifyEvidenceClaim } from './evidence-verify';

export async function buildEvidenceSet(items: ProveItemInput[]): Promise<EvidenceSet> {
  if (items.length === 0) {
    return {
      kind: 'evidence-set',
      product: PRODUCT_NAME,
      contract: PRODUCT_CONTRACT,
      evidenceSetId: 'empty',
      status: 'failed',
      count: 0,
      items: [],
      agentInstruction: 'Provide 1–8 prove items. Empty sets are not evidence.',
      next: null,
    };
  }
  if (items.length > MAX_EVIDENCE_SET_ITEMS) {
    throw new Error(`pin.prove_set accepts at most ${MAX_EVIDENCE_SET_ITEMS} items.`);
  }

  const packs = await Promise.all(items.map((item) => buildEvidencePack(item)));
  const okItems = packs.filter((pack) => pack.status === 'ok' && pack.commitSha);
  const status = okItems.length === packs.length ? 'ok' : okItems.length === 0 ? 'failed' : 'partial';
  const evidenceSetId = computeEvidenceSetId(
    packs.map((pack) => ({
      repository: pack.repository,
      sourcePath: pack.sourcePath,
      commitSha: pack.commitSha,
      line: pack.range?.start ?? null,
    })),
  );

  const verifyItems = packs
    .filter((pack) => pack.status === 'ok' && pack.commitSha)
    .map((pack) => ({
      repository: pack.repository,
      sourcePath: pack.sourcePath,
      sha: pack.commitSha as string,
      ...(pack.range ? { line: pack.range.start } : {}),
      ...(pack.claim ? { mustContain: pack.claim } : {}),
    }));

  return {
    kind: 'evidence-set',
    product: PRODUCT_NAME,
    contract: PRODUCT_CONTRACT,
    evidenceSetId,
    status,
    count: packs.length,
    items: packs,
    agentInstruction:
      'Multi-repo answer: cite each item.citation.cite (or handle). Call pin.verify_set before treating the set as checked. Do not invent missing items.',
    next:
      verifyItems.length > 0
        ? {
            tool: 'pin.verify_set',
            arguments: { evidenceSetId, items: verifyItems },
          }
        : null,
  };
}

export async function verifyEvidenceSet(input: {
  items: VerifyItemInput[];
  evidenceSetId?: string;
}): Promise<VerifySetReport> {
  if (input.items.length === 0) {
    return {
      kind: 'verification-set-report',
      product: PRODUCT_NAME,
      contract: PRODUCT_CONTRACT,
      evidenceSetId: input.evidenceSetId ?? null,
      status: 'failed',
      count: 0,
      okCount: 0,
      items: [],
      message: 'No verify items provided.',
    };
  }
  if (input.items.length > MAX_EVIDENCE_SET_ITEMS) {
    throw new Error(`pin.verify_set accepts at most ${MAX_EVIDENCE_SET_ITEMS} items.`);
  }

  const reports: VerifyReport[] = [];
  for (const item of input.items) {
    reports.push(await verifyEvidenceClaim(item));
  }
  const okCount = reports.filter((report) => report.status === 'ok').length;
  const status = okCount === reports.length ? 'ok' : okCount === 0 ? 'failed' : 'partial';
  const evidenceSetId =
    input.evidenceSetId ??
    computeEvidenceSetId(
      reports.map((report) => ({
        repository: report.repository,
        sourcePath: report.sourcePath,
        commitSha: report.commitSha,
        line: report.line,
      })),
    );

  return {
    kind: 'verification-set-report',
    product: PRODUCT_NAME,
    contract: PRODUCT_CONTRACT,
    evidenceSetId,
    status,
    count: reports.length,
    okCount,
    items: reports,
    message:
      status === 'ok'
        ? 'All items verified at claimed SHAs and match current HEAD where checked.'
        : status === 'partial'
          ? 'Some items failed verification (mismatch, missing, blocked, or contradicted text).'
          : 'No items passed verification.',
  };
}

export function computeEvidenceSetId(
  items: Array<{
    repository: string;
    sourcePath: string;
    commitSha: string | null;
    line: number | null;
  }>,
): string {
  const material = items
    .map((item) => `${item.repository}\0${item.sourcePath}\0${item.commitSha ?? ''}\0${item.line ?? ''}`)
    .sort()
    .join('\n');
  return createHash('sha256').update(material, 'utf8').digest('hex').slice(0, 16);
}
