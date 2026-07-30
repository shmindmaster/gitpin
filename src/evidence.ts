/**
 * Product contract: GitPin sells verifiable multi-repo evidence, not "repo context."
 * Public barrel for citations, evidence packs, and verification reports.
 */
export { asCandidateHits, asCodeCandidateHits, asPinnedSlice, buildCitation } from './evidence-citation';
export { buildEvidencePack } from './evidence-prove';
export {
  PRODUCT_CONTRACT,
  PRODUCT_NAME,
  type Citation,
  type EvidenceCandidate,
  type EvidencePack,
  type ProvenanceKind,
  type VerifyReport,
} from './evidence-types';
export { verifyEvidenceClaim } from './evidence-verify';
