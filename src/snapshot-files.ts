import { basename, extname } from 'node:path';
import { isAlwaysSensitivePath, isDocumentationAllowed, isPathDenied, type parseExposurePolicy } from './policy';

const DOCUMENT_EXTENSIONS = new Set(['.md', '.mdx', '.rst', '.adoc', '.txt']);
export const SNAPSHOT_ROOT_MANIFESTS = new Set([
  'AGENTS.md',
  'ARCHITECTURE.md',
  'CHANGELOG.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'Cargo.toml',
  'Dockerfile',
  'GEMINI.md',
  'LICENSE',
  'Makefile',
  'PROJECT_AUDIT.md',
  'README.md',
  'bun.lockb',
  'composer.json',
  'deno.json',
  'flake.nix',
  'go.mod',
  'package.json',
  'pnpm-workspace.yaml',
  'pom.xml',
  'pyproject.toml',
  'requirements.txt',
]);

export function isSnapshotFile(path: string, policy: ReturnType<typeof parseExposurePolicy>): boolean {
  const normalized = path.replace(/\\/g, '/');
  const fileName = basename(normalized);
  if (isPathDenied(normalized, policy)) return false;
  if (DOCUMENT_EXTENSIONS.has(extname(fileName).toLowerCase())) {
    return isDocumentationAllowed(normalized, policy);
  }
  if (!normalized.includes('/') && SNAPSHOT_ROOT_MANIFESTS.has(fileName)) return true;
  if (/^\.github\/workflows\/[^/]+\.(ya?ml)$/i.test(normalized)) return true;
  return false;
}

export function isSensitiveSnapshotPath(path: string): boolean {
  return isAlwaysSensitivePath(path);
}
