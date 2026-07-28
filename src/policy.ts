import { parse } from 'yaml';

const ALWAYS_DENY = [
  '.env*',
  '**/.env*',
  'credentials',
  'credentials/**',
  '**/credentials',
  '**/credentials/**',
  '**/credentials.*',
  '**/*.secret',
  '**/*.secret.*',
  '**/*.key',
  '**/*.pem',
  '**/*.p12',
  '**/*.pfx',
  'keys',
  'keys/**',
  '**/keys',
  '**/keys/**',
  'secrets',
  'secrets/**',
  '**/secrets',
  '**/secrets/**',
  'tokens',
  'tokens/**',
  '**/tokens',
  '**/tokens/**',
  '**/*token*',
];

export interface ExposurePolicy {
  include: string[];
  deny: string[];
}

export function parseExposurePolicy(raw: string | null): ExposurePolicy {
  if (!raw) return { include: [], deny: ALWAYS_DENY };
  try {
    const value = parse(raw) as {
      expose?: Array<string | { path?: string; glob?: string }>;
      exclude?: Array<string | { path?: string }>;
      collections?: Array<{ include?: string[] }>;
      safety?: { deny?: string[] };
    };
    const expose = (value?.expose ?? []).flatMap((entry) => {
      if (typeof entry === 'string') return [entry];
      if (!entry?.path) return [];
      if (!entry.glob) return [entry.path];
      return [`${entry.path.replace(/\/?$/, '/')}${entry.glob}`];
    });
    const collections = (value?.collections ?? []).flatMap((collection) => collection.include ?? []);
    const exclude = (value?.exclude ?? []).flatMap((entry) =>
      typeof entry === 'string' ? [entry] : entry?.path ? [entry.path] : [],
    );
    return {
      include: [...new Set([...expose, ...collections].map(normalizePattern))],
      deny: [...new Set([...ALWAYS_DENY, ...exclude, ...(value?.safety?.deny ?? [])].map(normalizePattern))],
    };
  } catch {
    // A malformed exposure policy must never widen a repository's exposure.
    return { include: [], deny: ['**'] };
  }
}

export function isDocumentationAllowed(sourcePath: string, policy: ExposurePolicy): boolean {
  const normalized = normalizePath(sourcePath);
  if (policy.deny.some((pattern) => matches(normalized, pattern))) return false;
  if (policy.include.length === 0) return true;
  return policy.include.some((pattern) => matches(normalized, pattern));
}

export function isPathDenied(sourcePath: string, policy: ExposurePolicy): boolean {
  const normalized = normalizePath(sourcePath);
  return policy.deny.some((pattern) => matches(normalized, pattern));
}

export function isAlwaysSensitivePath(sourcePath: string): boolean {
  const normalized = normalizePath(sourcePath);
  return ALWAYS_DENY.some((pattern) => matches(normalized, pattern));
}

function matches(path: string, rawPattern: string): boolean {
  const pattern = normalizePattern(rawPattern);
  if (!pattern) return false;
  if (pattern.endsWith('/')) return path === pattern.slice(0, -1) || path.startsWith(pattern);
  if (!pattern.includes('*') && !pattern.includes('?')) {
    return path === pattern || path.startsWith(`${pattern}/`);
  }
  return globRegex(pattern).test(path);
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
      source += character.replace(/[\\^$.[\]{}()+|]/g, '\\$&');
    }
  }
  return new RegExp(`${source}$`, 'i');
}

function normalizePattern(pattern: string): string {
  return normalizePath(pattern).replace(/^\.\//, '');
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}
