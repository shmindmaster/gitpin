import { readFileSync } from 'node:fs';
import {
  extractCitesFromText,
  parseCiteString,
  parseHandle,
  verifyEvidenceClaim,
  verifyEvidenceSet,
  type VerifyItemInput,
} from './evidence';

export async function runVerifyCommand(options: string[]) {
  const parsed = parseVerifyOptions(options);
  if (parsed.fromPack) {
    return verifyEvidenceSet(loadPack(parsed.fromPack));
  }
  if (!parsed.item) throw new Error('verify requires --repository/--path/--sha, or --from-pack <file>.');
  return verifyEvidenceClaim(parsed.item);
}

export function exitForVerify(report: { status: string; kind?: string }): number {
  return report.status === 'ok' ? 0 : 1;
}

export async function runVerifyCitesCommand(options: string[]) {
  let file: string | undefined;
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    const value = options[index + 1];
    if (option === '--file' || option === '-f') {
      if (!value || value.startsWith('--')) throw new Error('verify-cites requires --file <path>.');
      file = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown verify-cites option: ${option}.`);
  }
  if (!file) throw new Error('verify-cites requires --file <path>.');
  const text = readFileSync(file, 'utf8');
  const cites = extractCitesFromText(text);
  if (cites.length === 0) {
    return {
      kind: 'verification-set-report' as const,
      status: 'failed' as const,
      count: 0,
      okCount: 0,
      items: [],
      message: `No GitPin cite strings found in ${file}.`,
      evidenceSetId: null,
    };
  }
  const items: VerifyItemInput[] = [];
  for (const cite of cites.slice(0, 8)) {
    const parsed = parseCiteString(cite);
    if (!parsed?.commitSha) continue;
    items.push({
      repository: parsed.repository,
      sourcePath: parsed.sourcePath,
      sha: parsed.commitSha,
      ...(parsed.line !== null ? { line: parsed.line } : {}),
    });
  }
  if (items.length === 0) {
    return {
      kind: 'verification-set-report' as const,
      status: 'failed' as const,
      count: 0,
      okCount: 0,
      items: [],
      message: 'Cite strings found but none included a commit SHA.',
      evidenceSetId: null,
    };
  }
  return verifyEvidenceSet({ items });
}

export function parseProveSetOptions(options: string[]) {
  if (options[0] === '--from-json') {
    const path = options[1];
    if (!path) throw new Error('prove-set --from-json requires a file path.');
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { items?: unknown };
    if (!Array.isArray(raw.items)) throw new Error('JSON must contain an items array.');
    return raw.items as Array<{
      repository: string;
      sourcePath: string;
      lineStart?: number;
      lineEnd?: number;
      claim?: string;
    }>;
  }
  throw new Error('prove-set requires --from-json <file> with { "items": [ ... ] }.');
}

function loadPack(path: string): { items: VerifyItemInput[]; evidenceSetId?: string } {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  if (raw.kind === 'evidence-set' && Array.isArray(raw.items)) {
    const items = (raw.items as Array<Record<string, unknown>>)
      .filter((item) => item.status === 'ok' && typeof item.commitSha === 'string')
      .map((item) => {
        const range = item.range as { start?: number } | null | undefined;
        return {
          repository: String(item.repository),
          sourcePath: String(item.sourcePath),
          sha: String(item.commitSha),
          ...(typeof range?.start === 'number' ? { line: range.start } : {}),
          ...(typeof item.claim === 'string' && item.claim ? { mustContain: item.claim } : {}),
        };
      });
    return {
      items,
      ...(typeof raw.evidenceSetId === 'string' ? { evidenceSetId: raw.evidenceSetId } : {}),
    };
  }
  if (raw.kind === 'evidence-pack' && typeof raw.commitSha === 'string') {
    const range = raw.range as { start?: number } | null | undefined;
    return {
      items: [
        {
          repository: String(raw.repository),
          sourcePath: String(raw.sourcePath),
          sha: String(raw.commitSha),
          ...(typeof range?.start === 'number' ? { line: range.start } : {}),
          ...(typeof raw.claim === 'string' && raw.claim ? { mustContain: raw.claim } : {}),
        },
      ],
    };
  }
  if (Array.isArray(raw.items)) {
    return {
      items: raw.items as VerifyItemInput[],
      ...(typeof raw.evidenceSetId === 'string' ? { evidenceSetId: raw.evidenceSetId } : {}),
    };
  }
  throw new Error(`${path} is not a GitPin evidence-set, evidence-pack, or { items: VerifyItem[] } JSON file.`);
}

function parseVerifyOptions(options: string[]): {
  fromPack?: string;
  item?: VerifyItemInput;
} {
  let repository: string | undefined;
  let sourcePath: string | undefined;
  let line: number | undefined;
  let sha: string | undefined;
  let mustContain: string | undefined;
  let fromPack: string | undefined;

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    const value = options[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Option ${option} requires a value.`);
    switch (option) {
      case '--repository':
        repository = value;
        break;
      case '--path':
      case '--source-path':
        sourcePath = value;
        break;
      case '--line':
        line = Number.parseInt(value, 10);
        if (!Number.isInteger(line) || line < 1) throw new Error('--line must be a positive integer.');
        break;
      case '--sha':
      case '--commit':
        sha = revision(value, option);
        break;
      case '--must-contain':
        mustContain = value;
        break;
      case '--from-pack':
        fromPack = value;
        break;
      case '--handle': {
        const handle = parseHandle(value);
        if (!handle?.sourcePath) throw new Error('--handle must be gitpin:repo@sha:path or ...:path:line');
        repository = handle.repository;
        sourcePath = handle.sourcePath;
        sha = handle.commitSha;
        if (handle.line !== null) line = handle.line;
        break;
      }
      default:
        throw new Error(`Unknown verify option: ${option}. Run "gitpin help" for usage.`);
    }
    index += 1;
  }

  if (fromPack) return { fromPack };
  if (!repository || !sourcePath || !sha) {
    throw new Error('verify requires --repository, --path, and --sha (or --handle / --from-pack).');
  }
  return {
    item: {
      repository,
      sourcePath,
      sha,
      ...(line !== undefined ? { line } : {}),
      ...(mustContain !== undefined ? { mustContain } : {}),
    },
  };
}

function revision(value: string, option: string): string {
  if (!/^[0-9a-f]{7,40}$/iu.test(value))
    throw new Error(`${option} must be a 7-40 character hexadecimal Git revision.`);
  return value;
}
