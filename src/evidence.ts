/**
 * Product contract: GitPin sells verifiable multi-repo evidence, not "repo context."
 * Public barrel for citations, evidence packs, sets, and verification reports.
 */
export {
  asCandidateHits,
  asCodeCandidateHits,
  asPinnedSlice,
  buildCitation,
  extractCitesFromText,
  parseCiteString,
  parseHandle,
} from './evidence-citation';
export { buildEvidencePack } from './evidence-prove';
export { buildEvidenceSet, computeEvidenceSetId, verifyEvidenceSet } from './evidence-set';
export {
  MAX_EVIDENCE_SET_ITEMS,
  PRODUCT_CONTRACT,
  PRODUCT_NAME,
  type Citation,
  type ClaimVerdict,
  type EvidenceCandidate,
  type EvidencePack,
  type EvidenceSet,
  type ProveItemInput,
  type ProvenanceKind,
  type VerifyItemInput,
  type VerifyReport,
  type VerifySetReport,
} from './evidence-types';
export { verifyEvidenceClaim } from './evidence-verify';
