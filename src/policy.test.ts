import { describe, expect, it } from 'vitest';
import { isDocumentationAllowed, isPathDenied, parseExposurePolicy } from './policy';

describe('wiki exposure policy', () => {
  it('supports canonical collections includes and safety deny patterns', () => {
    const policy = parseExposurePolicy(`
collections:
  - id: architecture
    state: documented
    include:
      - docs/**/*.md
safety:
  deny:
    - docs/internal/**
    - "**/*token*"
`);
    expect(isDocumentationAllowed('docs/architecture/system.md', policy)).toBe(true);
    expect(isDocumentationAllowed('docs/internal/operating-notes.md', policy)).toBe(false);
    expect(isDocumentationAllowed('README.md', policy)).toBe(false);
    expect(isPathDenied('docs/access-token-rotation.md', policy)).toBe(true);
  });

  it('supports the legacy expose and exclude schema during migration', () => {
    const policy = parseExposurePolicy(`
expose:
  - path: README.md
  - path: docs/
    glob: "**/*.md"
exclude:
  - path: docs/drafts/
`);
    expect(isDocumentationAllowed('README.md', policy)).toBe(true);
    expect(isDocumentationAllowed('docs/product/overview.md', policy)).toBe(true);
    expect(isDocumentationAllowed('docs/drafts/unapproved.md', policy)).toBe(false);
    expect(isDocumentationAllowed('AGENTS.md', policy)).toBe(false);
  });

  it('defaults to all documentation while retaining hard sensitive-file blocks', () => {
    const policy = parseExposurePolicy(null);
    expect(isDocumentationAllowed('AGENTS.md', policy)).toBe(true);
    expect(isDocumentationAllowed('packages/app/README.md', policy)).toBe(true);
    expect(isDocumentationAllowed('docs/password-reset.md', policy)).toBe(true);
    expect(isDocumentationAllowed('config/credentials/service.json', policy)).toBe(false);
    expect(isDocumentationAllowed('tokens/production.md', policy)).toBe(false);
    expect(isDocumentationAllowed('secrets/runbook.md', policy)).toBe(false);
  });

  it('fails closed when an exposure policy cannot be parsed', () => {
    const policy = parseExposurePolicy('expose: [');
    expect(isDocumentationAllowed('README.md', policy)).toBe(false);
    expect(isPathDenied('README.md', policy)).toBe(true);
  });
});
