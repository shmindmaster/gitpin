import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { buildCitation } from './evidence-citation';
import { isAlwaysSensitivePath } from './policy';
import {
  changedPaths,
  mergeBase,
  readGitFile,
  readManifestAtHead,
  readPolicyAtBase,
  resolveCommit,
  sha256,
} from './gate-policy';
import {
  isSafeRelativePath,
  type GateClaimReport,
  type GateReport,
  type GateViolation,
  type VerifiedLocator,
} from './gate-types';

const DEFAULT_POLICY_PATH = '.gitpin/gate.yml';

export async function runGitPinGate(input: {
  root?: string;
  repository?: string;
  base: string;
  head: string;
  policyPath?: string;
}): Promise<GateReport> {
  const root = resolve(input.root ?? process.cwd());
  const repository = input.repository ?? basename(root);
  const policyPath = input.policyPath ?? DEFAULT_POLICY_PATH;
  if (!isSafeRelativePath(policyPath)) throw new Error('--policy must be a normalized repository-relative path.');
  const baseSha = resolveCommit(root, input.base, '--base');
  const headSha = resolveCommit(root, input.head, '--head');
  const mergeBaseSha = mergeBase(root, baseSha, headSha);
  const policyResult = readPolicyAtBase(root, baseSha, policyPath);
  const { policy } = policyResult;
  const manifestResult = readManifestAtHead(root, headSha, policy.manifestPath, policy.limits.fileBytes);

  if (manifestResult.manifest.claims.length > policy.limits.claims) {
    throw new Error(
      `Evidence manifest has ${manifestResult.manifest.claims.length} claims; trusted policy limit is ${policy.limits.claims}.`,
    );
  }

  const allChangedPaths = changedPaths(root, mergeBaseSha, headSha, policy.limits.changedPaths);
  const violations: GateViolation[] = [];
  const duplicateClaimIds = duplicates(manifestResult.manifest.claims.map((claim) => claim.id));
  for (const id of duplicateClaimIds) {
    violations.push({ code: 'duplicate-claim-id', claimId: id, message: `Claim ID ${id} is duplicated.` });
  }

  const requiredPaths = allChangedPaths.filter(
    (path) =>
      path !== policy.manifestPath &&
      matchesAny(path, policy.coverage.include) &&
      !matchesAny(path, policy.coverage.exclude),
  );
  if (policy.policyChanges === 'block' && allChangedPaths.includes(policyPath)) {
    violations.push({
      code: 'policy-change-blocked',
      path: policyPath,
      message: `Trusted gate policy changes must be merged separately: ${policyPath}.`,
    });
  }

  const claims: GateClaimReport[] = [];
  for (const claim of manifestResult.manifest.claims) {
    const claimViolationsBefore = violations.length;
    if (claim.evidence.length > policy.limits.evidencePerClaim) {
      violations.push({
        code: 'evidence-limit',
        claimId: claim.id,
        message: `Claim ${claim.id} has ${claim.evidence.length} evidence locators; limit is ${policy.limits.evidencePerClaim}.`,
      });
    }
    for (const path of duplicates(claim.covers)) {
      violations.push({
        code: 'duplicate-cover',
        claimId: claim.id,
        path,
        message: `Claim ${claim.id} covers ${path} twice.`,
      });
    }

    const evidence: VerifiedLocator[] = [];
    for (const locator of claim.evidence.slice(0, policy.limits.evidencePerClaim)) {
      const targetSha = locator.ref === 'base' ? baseSha : headSha;
      let actualContentSha256: string | null = null;
      let citation: string | null = null;
      let handle: string | null = null;
      let status: 'verified' | 'failed' = 'verified';
      if (locator.path === policy.manifestPath || isAlwaysSensitivePath(locator.path)) {
        status = 'failed';
        violations.push({
          code: locator.path === policy.manifestPath ? 'manifest-self-citation' : 'sensitive-evidence-path',
          claimId: claim.id,
          path: locator.path,
          message:
            locator.path === policy.manifestPath
              ? `Claim ${claim.id} cannot cite the evidence manifest itself.`
              : `Claim ${claim.id} cannot expose sensitive evidence path ${locator.path}.`,
        });
      } else {
        try {
          const content = readGitFile(root, targetSha, locator.path, policy.limits.fileBytes);
          const lines = content.split(/\r?\n/u);
          if (locator.lineEnd > lines.length || locator.lineEnd - locator.lineStart + 1 > 200) {
            throw new Error(`range ${locator.lineStart}-${locator.lineEnd} is outside the file or exceeds 200 lines`);
          }
          const slice = lines.slice(locator.lineStart - 1, locator.lineEnd).join('\n');
          actualContentSha256 = sha256(slice);
          if (actualContentSha256 !== locator.contentSha256) {
            status = 'failed';
            violations.push({
              code: 'content-hash-mismatch',
              claimId: claim.id,
              path: locator.path,
              message: `Claim ${claim.id} evidence hash does not match ${locator.ref}:${locator.path}:${locator.lineStart}-${locator.lineEnd}.`,
            });
          } else {
            const built = buildCitation({
              repository,
              sourcePath: locator.path,
              line: locator.lineStart,
              lineEnd: locator.lineEnd,
              commitSha: targetSha,
              provenance: 'git-head',
            });
            citation = built.cite;
            handle = built.handle;
          }
        } catch (error) {
          status = 'failed';
          violations.push({
            code: 'evidence-unavailable',
            claimId: claim.id,
            path: locator.path,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
      evidence.push({
        ref: locator.ref,
        path: locator.path,
        lineStart: locator.lineStart,
        lineEnd: locator.lineEnd,
        expectedContentSha256: locator.contentSha256,
        actualContentSha256,
        status,
        citation,
        handle,
      });
    }
    claims.push({
      id: claim.id,
      statement: claim.statement,
      covers: [...new Set(claim.covers)].sort(),
      evidence,
      status:
        violations.length === claimViolationsBefore && evidence.every((item) => item.status === 'verified')
          ? 'evidence-verified'
          : 'failed',
    });
  }

  const coveredPaths = new Set(manifestResult.manifest.claims.flatMap((claim) => claim.covers));
  const uncovered = requiredPaths.filter((path) => !coveredPaths.has(path));
  for (const path of uncovered) {
    violations.push({ code: 'uncovered-change', path, message: `Changed path has no material claim: ${path}.` });
  }

  const reportMaterial = {
    repository,
    baseSha,
    headSha,
    mergeBaseSha,
    policySha256: sha256(policyResult.raw),
    manifestSha256: sha256(manifestResult.raw),
    allChangedPaths,
    requiredPaths,
    claims,
    violations,
  };
  const status = violations.length === 0 ? 'ok' : 'failed';
  return {
    kind: 'gitpin-gate-report',
    schemaVersion: 1,
    status,
    reportId: createHash('sha256').update(JSON.stringify(reportMaterial), 'utf8').digest('hex').slice(0, 16),
    repository,
    baseSha,
    headSha,
    mergeBaseSha,
    policy: { path: policyPath, sha256: reportMaterial.policySha256 },
    manifest: { path: policy.manifestPath, sha256: reportMaterial.manifestSha256 },
    changedPaths: { all: allChangedPaths, required: requiredPaths, uncovered },
    claims,
    violations,
    message:
      status === 'ok'
        ? `Checked ${claims.length} claim manifest entr${claims.length === 1 ? 'y' : 'ies'} and verified their evidence locators for ${requiredPaths.length} changed path(s) at ${headSha}.`
        : `Gate failed with ${violations.length} violation(s). Evidence locators verify committed content, not semantic correctness.`,
  };
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
}

function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globRegex(pattern).test(path));
}

function globRegex(pattern: string): RegExp {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*' && pattern[index + 1] === '*') {
      if (pattern[index + 2] === '/') {
        source += '(?:.*/)?';
        index += 2;
      } else {
        source += '.*';
        index += 1;
      }
    } else if (character === '*') {
      source += '[^/]*';
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += character.replace(/[\\^$.[\]{}()+|]/gu, '\\$&');
    }
  }
  return new RegExp(`${source}$`, 'u');
}
