import { z } from 'zod';

const relativePath = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => isSafeRelativePath(value), 'Must be a normalized repository-relative path.');

const evidenceLocatorSchema = z
  .object({
    ref: z.enum(['base', 'head']),
    path: relativePath,
    lineStart: z.number().int().positive(),
    lineEnd: z.number().int().positive(),
    contentSha256: z.string().regex(/^[0-9a-f]{64}$/u),
  })
  .strict()
  .refine((value) => value.lineEnd >= value.lineStart, 'lineEnd must be greater than or equal to lineStart.');

const claimSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u),
    statement: z.string().min(1).max(1000),
    covers: z.array(relativePath).min(1).max(100),
    evidence: z.array(evidenceLocatorSchema).min(1).max(16),
  })
  .strict();

export const changeEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    summary: z.string().min(1).max(2000),
    claims: z.array(claimSchema).max(100),
  })
  .strict();

export const gatePolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    manifestPath: relativePath.default('.gitpin/change-evidence.json'),
    coverage: z
      .object({
        include: z.array(z.string().min(1).max(500)).min(1).default(['**']),
        exclude: z.array(z.string().min(1).max(500)).default([]),
      })
      .strict()
      .default({ include: ['**'], exclude: [] }),
    policyChanges: z.enum(['block', 'allow']).default('block'),
    limits: z
      .object({
        changedPaths: z.number().int().min(1).max(1000).default(100),
        claims: z.number().int().min(1).max(100).default(50),
        evidencePerClaim: z.number().int().min(1).max(16).default(8),
        fileBytes: z
          .number()
          .int()
          .min(1024)
          .max(10 * 1024 * 1024)
          .default(2 * 1024 * 1024),
      })
      .strict()
      .default({ changedPaths: 100, claims: 50, evidencePerClaim: 8, fileBytes: 2 * 1024 * 1024 }),
  })
  .strict();

export type ChangeEvidence = z.infer<typeof changeEvidenceSchema>;
export type GatePolicy = z.infer<typeof gatePolicySchema>;
export type EvidenceLocator = z.infer<typeof evidenceLocatorSchema>;

export interface GateViolation {
  code: string;
  message: string;
  path?: string;
  claimId?: string;
}

export interface VerifiedLocator {
  ref: 'base' | 'head';
  path: string;
  lineStart: number;
  lineEnd: number;
  expectedContentSha256: string;
  actualContentSha256: string | null;
  status: 'verified' | 'failed';
  citation: string | null;
  handle: string | null;
}

export interface GateClaimReport {
  id: string;
  statement: string;
  status: 'evidence-verified' | 'failed';
  covers: string[];
  evidence: VerifiedLocator[];
}

export interface GateReport {
  kind: 'gitpin-gate-report';
  schemaVersion: 1;
  status: 'ok' | 'failed';
  reportId: string;
  repository: string;
  baseSha: string;
  headSha: string;
  mergeBaseSha: string;
  policy: { path: string; sha256: string };
  manifest: { path: string; sha256: string };
  changedPaths: { all: string[]; required: string[]; uncovered: string[] };
  claims: GateClaimReport[];
  violations: GateViolation[];
  message: string;
}

export function isSafeRelativePath(value: string): boolean {
  if (!value || value.includes('\0') || value.includes('\\') || value.startsWith('/') || /^[A-Za-z]:/u.test(value)) {
    return false;
  }
  const segments = value.split('/');
  return !segments.some((segment) => segment === '' || segment === '.' || segment === '..');
}
