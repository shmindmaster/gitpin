/** Shared product contract types for GitPin evidence responses. */

export const PRODUCT_CONTRACT = 'index-free-git-head-evidence' as const;
export const PRODUCT_NAME = 'gitpin' as const;

export type ProvenanceKind =
  | 'git-head'
  | 'snapshot'
  | 'unversioned-workspace-document'
  | 'blocked'
  | 'missing'
  | 'unavailable';

export interface Citation {
  repository: string;
  sourcePath: string;
  line: number | null;
  lineEnd: number | null;
  commitSha: string | null;
  provenance: ProvenanceKind;
  cite: string;
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
  next: { tool: 'pin.verify'; arguments: Record<string, unknown> } | null;
}

export interface VerifyReport {
  kind: 'verification-report';
  product: typeof PRODUCT_NAME;
  contract: typeof PRODUCT_CONTRACT;
  status: 'ok' | 'mismatch' | 'missing' | 'blocked';
  repository: string;
  sourcePath: string;
  commitSha: string | null;
  line: number | null;
  lineText: string | null;
  headCommitSha: string | null;
  headMatchesClaimedSha: boolean;
  command: string | null;
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
