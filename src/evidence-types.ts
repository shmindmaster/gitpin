/** Shared product contract types for GitPin evidence responses. */

export const PRODUCT_CONTRACT = 'index-free-git-head-evidence' as const;
export const PRODUCT_NAME = 'gitpin' as const;
export const MAX_EVIDENCE_SET_ITEMS = 8;

export type ProvenanceKind =
  | 'git-head'
  | 'snapshot'
  | 'unversioned-workspace-document'
  | 'blocked'
  | 'missing'
  | 'unavailable';

export type ClaimVerdict = 'supported' | 'contradicted' | 'unproven' | null;

export interface Citation {
  repository: string;
  sourcePath: string;
  line: number | null;
  lineEnd: number | null;
  commitSha: string | null;
  provenance: ProvenanceKind;
  /** Human copy-paste: `repo/path:line @ fullSha` */
  cite: string;
  /** Immutable handle: `gitpin:repo@fullSha:path:line` when SHA present */
  handle: string | null;
  /** Short durable repo pin: `repo@fullSha` */
  repoAtSha: string | null;
  verify: {
    gitShow: string | null;
    gitpinCli: string | null;
  };
}

export interface EvidencePack {
  kind: 'evidence-pack';
  product: typeof PRODUCT_NAME;
  contract: typeof PRODUCT_CONTRACT;
  status: 'ok' | 'blocked' | 'missing';
  claim: string | null;
  citation: Citation;
  repository: string;
  sourcePath: string;
  commitSha: string | null;
  range: { start: number; end: number } | null;
  totalLines: number | null;
  content: string | null;
  contentSha256: string | null;
  agentInstruction: string;
  next: { tool: 'pin.verify' | 'pin.verify_set'; arguments: Record<string, unknown> } | null;
}

export interface EvidenceSet {
  kind: 'evidence-set';
  product: typeof PRODUCT_NAME;
  contract: typeof PRODUCT_CONTRACT;
  evidenceSetId: string;
  status: 'ok' | 'partial' | 'failed';
  count: number;
  items: EvidencePack[];
  agentInstruction: string;
  next: { tool: 'pin.verify_set'; arguments: Record<string, unknown> } | null;
}

export interface VerifyReport {
  kind: 'verification-report';
  product: typeof PRODUCT_NAME;
  contract: typeof PRODUCT_CONTRACT;
  status: 'ok' | 'mismatch' | 'missing' | 'blocked' | 'contradicted';
  repository: string;
  sourcePath: string;
  commitSha: string | null;
  line: number | null;
  lineText: string | null;
  headCommitSha: string | null;
  headMatchesClaimedSha: boolean;
  mustContain: string | null;
  claimTextMatch: boolean | null;
  claimVerdict: ClaimVerdict;
  command: string | null;
  message: string;
  citation: Citation | null;
}

export interface VerifySetReport {
  kind: 'verification-set-report';
  product: typeof PRODUCT_NAME;
  contract: typeof PRODUCT_CONTRACT;
  evidenceSetId: string | null;
  status: 'ok' | 'partial' | 'failed';
  count: number;
  okCount: number;
  items: VerifyReport[];
  message: string;
}

export interface EvidenceCandidate {
  repository: string;
  sourcePath: string;
  line: number;
  snippet: string;
  commitSha: string | null;
  citation: Citation;
  next: { tool: 'pin.prove'; arguments: Record<string, unknown> };
}

export interface ProveItemInput {
  repository: string;
  sourcePath: string;
  lineStart?: number;
  lineEnd?: number;
  claim?: string;
}

export interface VerifyItemInput {
  repository: string;
  sourcePath: string;
  sha: string;
  line?: number;
  mustContain?: string;
}
