import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { changeEvidenceSchema, gatePolicySchema, type ChangeEvidence, type GatePolicy } from './gate-types';

export function resolveCommit(root: string, revision: string, label: string): string {
  if (!/^[0-9a-f]{40}$/iu.test(revision)) throw new Error(`${label} must be a full 40-character Git SHA.`);
  try {
    return gitText(root, ['rev-parse', '--verify', `${revision}^{commit}`], 1024)
      .trim()
      .toLowerCase();
  } catch {
    throw new Error(`${label} commit ${revision} is unavailable.`);
  }
}

export function mergeBase(root: string, baseSha: string, headSha: string): string {
  try {
    return gitText(root, ['merge-base', baseSha, headSha], 1024).trim().toLowerCase();
  } catch {
    throw new Error(`No merge base exists between ${baseSha} and ${headSha}.`);
  }
}

export function readPolicyAtBase(
  root: string,
  baseSha: string,
  policyPath: string,
): { raw: string; policy: GatePolicy } {
  const raw = readGitText(root, baseSha, policyPath, 1024 * 1024);
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (error) {
    throw new Error(`Trusted gate policy ${policyPath} is invalid YAML: ${errorMessage(error)}`);
  }
  const result = gatePolicySchema.safeParse(parsed);
  if (!result.success) throw new Error(`Trusted gate policy ${policyPath} is invalid: ${result.error.message}`);
  return { raw, policy: result.data };
}

export function readManifestAtHead(
  root: string,
  headSha: string,
  manifestPath: string,
  maxBytes: number,
): { raw: string; manifest: ChangeEvidence } {
  const raw = readGitText(root, headSha, manifestPath, maxBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Evidence manifest ${manifestPath} is invalid JSON: ${errorMessage(error)}`);
  }
  const result = changeEvidenceSchema.safeParse(parsed);
  if (!result.success) throw new Error(`Evidence manifest ${manifestPath} is invalid: ${result.error.message}`);
  return { raw, manifest: result.data };
}

export function changedPaths(root: string, fromSha: string, headSha: string, limit: number): string[] {
  const output = gitText(root, ['diff', '--name-only', '--no-renames', '-z', fromSha, headSha, '--'], 10 * 1024 * 1024);
  const paths = output.split('\0').filter(Boolean).sort();
  if (paths.length > limit) throw new Error(`Change has ${paths.length} paths; trusted policy limit is ${limit}.`);
  return paths;
}

export function readGitFile(root: string, sha: string, sourcePath: string, maxBytes: number): string {
  return readGitText(root, sha, sourcePath, maxBytes);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function readGitText(root: string, sha: string, sourcePath: string, maxBytes: number): string {
  try {
    const value = gitText(root, ['show', `${sha}:${sourcePath}`], maxBytes);
    if (Buffer.byteLength(value, 'utf8') > maxBytes) throw new Error('file exceeds byte limit');
    return value;
  } catch (error) {
    throw new Error(`Cannot read ${sourcePath} at ${sha}: ${errorMessage(error)}`);
  }
}

function gitText(root: string, args: string[], maxBuffer: number): string {
  return execFileSync('git', ['--no-replace-objects', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' },
    maxBuffer,
    windowsHide: true,
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
