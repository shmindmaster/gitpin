import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const DEFAULT_ARTIFACT_PATH = resolve(process.cwd(), 'docs/demos/pr-gate-fail-to-pass.artifact.json');
const DEFAULT_MARKDOWN_PATH = resolve(process.cwd(), 'docs/demos/pr-gate-fail-to-pass.md');
const DEFAULT_SVG_PATH = resolve(process.cwd(), 'docs/demos/pr-gate-fail-to-pass.svg');
const DEFAULT_SERVER_PATH = resolve(process.cwd(), 'dist', 'server.js');

const REPOSITORY_NAME = 'task-2-synthetic-pr-fixture';
const GATE_PATH = '.gitpin/gate.yml';
const MANIFEST_PATH = '.gitpin/change-evidence.json';
const PROTOCOL_PATH = 'docs/protocol.md';
const CLAIM_PATH = PROTOCOL_PATH;
const CLAIM_LINE_INDEX = 5;
const CLAIM_LINE_TEXT = 'Launch-gate proof requires this exact, deterministic proof line.';
const CLAIM_CONTENT_SHA = createHash('sha256').update(CLAIM_LINE_TEXT, 'utf8').digest('hex');

const FIXTURE_AUTHOR = {
  name: 'GitPin Demo',
  email: 'demo@gitpin.invalid',
};

const COMMIT_DATES = {
  base: '2026-01-01T10:00:00Z',
  fail: '2026-01-01T10:01:00Z',
  pass: '2026-01-01T10:02:00Z',
};

const args = new Map();

for (let index = 0; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith('--')) continue;
  const next = process.argv[index + 1];
  if (arg === '--artifact' || arg === '--markdown' || arg === '--svg') {
    if (!next || next.startsWith('--')) throw new Error(`Option ${arg} requires a value.`);
    args.set(arg, next);
    index += 1;
    continue;
  }

  if (arg === '--write' || arg === '--verify' || arg === '--check' || arg === '--persist' || arg === '--help') {
    args.set(arg, 'true');
  }
}

if (args.has('--help')) {
  console.log(`Usage:
node ${resolve(process.argv[1])} [options]

Options:
  --write             Generate artifact + markdown + SVG from synthetic fixture.
  --verify, --check   Verify generated values match existing checked-in artifact markdown and SVG.
  --persist           Keep generated fixture directory (for local inspection).
  --artifact <path>   Artifact JSON output path.
  --markdown <path>   Markdown output path.
  --svg <path>        SVG output path.
`);
  process.exit(0);
}

const artifactPath = resolve(args.get('--artifact') ?? DEFAULT_ARTIFACT_PATH);
const markdownPath = resolve(args.get('--markdown') ?? DEFAULT_MARKDOWN_PATH);
const svgPath = resolve(args.get('--svg') ?? DEFAULT_SVG_PATH);
const shouldWrite = args.has('--write');
const shouldVerify = args.has('--verify') || args.has('--check');
const persistFixture = args.has('--persist');

if (!existsSync(DEFAULT_SERVER_PATH)) {
  throw new Error('Expected built GitPin CLI at dist/server.js. Run pnpm build first.');
}

let fixtureRoot = '';
let generated;
try {
  fixtureRoot = mkdtempSync(join(tmpdir(), 'gitpin-pr-gate-fixture-'));
  generated = createFixtureArtifact(fixtureRoot);
} finally {
  if (!persistFixture && fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
}

const markdown = generateMarkdown(generated.artifact);
const svg = generateSvg(generated.artifact);

if (shouldWrite) {
  writeFileSync(artifactPath, `${JSON.stringify(generated.artifact, null, 2)}\n`, 'utf8');
  writeFileSync(markdownPath, `${markdown.trimEnd()}\n`, 'utf8');
  writeFileSync(svgPath, `${svg.trimEnd()}\n`, 'utf8');
}

if (shouldVerify) {
  const existingArtifact = readArtifactJson(artifactPath);
  assertDeepEqual(generated.artifact, existingArtifact, `fixture ${artifactPath}`);

  const expectedMarkdown = readFileUtf8(markdownPath);
  assertValue(markdown, expectedMarkdown, 'fixture markdown');
  const expectedSvg = readFileUtf8(svgPath);
  assertValue(svg, expectedSvg, 'fixture SVG');
}

console.log(
  JSON.stringify(
    {
      status: shouldVerify ? 'verified' : 'generated',
      artifactPath,
      markdownPath,
      svgPath,
      ...(persistFixture ? { fixtureRoot } : {}),
      ...generated.summary,
      artifactSha256: generated.artifact.reproducibility.artifactSha256,
    },
    null,
    2,
  ),
);

export function createFixtureArtifact(workspaceRoot) {
  return buildFixture(resolve(workspaceRoot));
}

function buildFixture(workspaceRoot) {
  const repositoryPath = resolve(workspaceRoot, REPOSITORY_NAME);
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: FIXTURE_AUTHOR.name,
    GIT_AUTHOR_EMAIL: FIXTURE_AUTHOR.email,
    GIT_COMMITTER_NAME: FIXTURE_AUTHOR.name,
    GIT_COMMITTER_EMAIL: FIXTURE_AUTHOR.email,
  };

  mkdirSync(repositoryPath, { recursive: true });
  run('git', ['init', '--quiet', '--initial-branch=main'], repositoryPath, gitEnv);
  run('git', ['config', 'user.name', FIXTURE_AUTHOR.name], repositoryPath, gitEnv);
  run('git', ['config', 'user.email', FIXTURE_AUTHOR.email], repositoryPath, gitEnv);
  run('git', ['config', 'core.autocrlf', 'false'], repositoryPath, gitEnv);

  writeBasePolicyFiles(repositoryPath);
  const baseSha = commit(repositoryPath, 'synthetic fixture base', COMMIT_DATES.base, gitEnv);
  appendProofLine(repositoryPath);
  const failHeadSha = commit(repositoryPath, 'synthetic fail path change', COMMIT_DATES.fail, gitEnv);
  updateManifestForPass(repositoryPath, CLAIM_CONTENT_SHA);
  const passHeadSha = commit(repositoryPath, 'add synthetic evidence locator', COMMIT_DATES.pass, gitEnv);

  const failRun = runGate(repositoryPath, baseSha, failHeadSha);
  const passRun = runGate(repositoryPath, baseSha, passHeadSha);
  const passCoverage = extractCoverage(passRun.report, CLAIM_PATH, CLAIM_LINE_INDEX);
  if (!passCoverage) {
    if (process.env.GATE_FAILURE_DEBUG === 'true') {
      console.error(JSON.stringify(passRun, null, 2));
    }
    throw new Error('Pass gate result did not produce verified evidence for CLAIM_PATH.');
  }

  const artifact = {
    artifactId: 'pr-gate-fail-to-pass',
    name: 'GitPin PR evidence gate fail-to-pass sample',
    version: '0.6.0',
    scenario: 'Deterministic synthetic PR gate fail-to-pass validation.',
    reducedMotionSafe: true,
    accessibility: {
      altText:
        'A synthetic fail-to-pass PR evidence gate flow: one failed run for an uncovered material path, then one passing run after adding a line-level locator.',
      caption:
        'Fail-to-pass summary: one required path fails at status 1 when material coverage is absent, then passes at status 0 once a full-SHA line locator is added at the exact line.',
      staticOnly: true,
    },
    links: {
      npm: 'https://www.npmjs.com/package/gitpin',
      github_release: 'https://github.com/shmindmaster/gitpin/releases/tag/v0.6.0',
      github_action: 'https://github.com/shmindmaster/gitpin/actions/workflows/evidence-gate.yml',
      github_action_snippet: 'uses: shmindmaster/gitpin@v0.6.0',
      mcp_registry:
        'https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.shmindmaster/gitpin&limit=20',
      pages: 'https://shmindmaster.github.io/gitpin/',
    },
    fixture: {
      repository: REPOSITORY_NAME,
      base: baseSha,
      failHead: failHeadSha,
      head: passHeadSha,
      changedPath: CLAIM_PATH,
      lineAdded: CLAIM_LINE_INDEX,
      claimContentLine: CLAIM_LINE_TEXT,
      claimContentSha256: CLAIM_CONTENT_SHA,
    },
    failCase: {
      command: failRun.command,
      status: failRun.exitCode,
      message: failRun.report.message,
      output: failRun.output,
      outputSha256: failRun.outputSha256,
    },
    passCase: {
      command: passRun.command,
      status: passRun.exitCode,
      message: passRun.report.message,
      output: passRun.output,
      outputSha256: passRun.outputSha256,
      coverage: passCoverage,
    },
    reproducibility: {
      artifactGenerator: 'scripts/build-pr-gate-fail-to-pass-artifact.mjs',
      commandRuns: [
        { command: failRun.command, status: failRun.exitCode, outputSha256: failRun.outputSha256 },
        { command: passRun.command, status: passRun.exitCode, outputSha256: passRun.outputSha256 },
      ],
      checks: {
        command: 'pnpm build && node scripts/build-pr-gate-fail-to-pass-artifact.mjs --verify',
        rawStdoutHash: createHash('sha256').update(`${failRun.output}\n${passRun.output}`, 'utf8').digest('hex'),
      },
      artifactPayload: {
        base: baseSha,
        failHead: failHeadSha,
        passHead: passHeadSha,
        claimPath: CLAIM_PATH,
        claimLine: CLAIM_LINE_INDEX,
        claimContentSha256: CLAIM_CONTENT_SHA,
      },
    },
  };

  artifact.reproducibility.artifactSha256 = createHash('sha256')
    .update(JSON.stringify(reproduciblePayload(artifact), null, 2), 'utf8')
    .digest('hex');

  return {
    artifact,
    summary: {
      repository: artifact.fixture.repository,
      baseSha: artifact.fixture.base,
      failHeadSha: artifact.fixture.failHead,
      passHeadSha: artifact.fixture.head,
      failStatus: artifact.failCase.status,
      passStatus: artifact.passCase.status,
    },
  };
}

function writeBasePolicyFiles(repositoryPath) {
  mkdirSync(resolve(repositoryPath, '.gitpin'), { recursive: true });
  mkdirSync(resolve(repositoryPath, 'docs'), { recursive: true });

  writeFileSync(
    resolve(repositoryPath, 'README.md'),
    '# Synthetic PR gate fixture repository\n\nThis repository is synthetic and deterministic.\n',
    'utf8',
  );

  writeFileSync(
    resolve(repositoryPath, GATE_PATH),
    [
      'schemaVersion: 1',
      'manifestPath: .gitpin/change-evidence.json',
      '',
      'coverage:',
      '  include:',
      '    - "docs/**"',
      '  exclude:',
      '    - "docs/generated/**"',
      '',
      'policyChanges: block',
      '',
    ].join('\n'),
    'utf8',
  );

  writeFileSync(
    resolve(repositoryPath, PROTOCOL_PATH),
    `${['# Synthetic protocol', '', 'Policy is fixed for deterministic gate demonstration.'].join('\n')}\n`,
    'utf8',
  );

  writeFileSync(
    resolve(repositoryPath, MANIFEST_PATH),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        summary: 'Synthetic PR gate launch fixture.',
        claims: [],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

function appendProofLine(repositoryPath) {
  writeFileSync(
    resolve(repositoryPath, PROTOCOL_PATH),
    `${['# Synthetic protocol', '', 'Policy is fixed for deterministic gate demonstration.', '', CLAIM_LINE_TEXT].join('\n')}\n`,
    'utf8',
  );
}

function updateManifestForPass(repositoryPath, claimContentSha256) {
  writeFileSync(
    resolve(repositoryPath, MANIFEST_PATH),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        summary: 'Synthetic PR gate launch fixture.',
        claims: [
          {
            id: 'TASK-2-PASS',
            statement: 'Synthetic PR gate pass fixture locator for deterministic evidence review.',
            covers: [CLAIM_PATH],
            evidence: [
              {
                ref: 'head',
                path: CLAIM_PATH,
                lineStart: CLAIM_LINE_INDEX,
                lineEnd: CLAIM_LINE_INDEX,
                contentSha256: claimContentSha256,
              },
            ],
          },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

function runGate(repositoryPath, baseSha, headSha) {
  const command = `gitpin gate --base ${baseSha} --head ${headSha}`;
  try {
    const rawOutput = execFileSync(
      process.execPath,
      [DEFAULT_SERVER_PATH, 'gate', '--base', baseSha, '--head', headSha],
      {
        cwd: repositoryPath,
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    const output = rawOutput.trim();
    return {
      command,
      exitCode: 0,
      output,
      outputSha256: createHash('sha256').update(output, 'utf8').digest('hex'),
      report: parseReportOutput(output, command),
    };
  } catch (error) {
    if (typeof error !== 'object' || error === null || !(error instanceof Error)) throw error;
    const status = typeof error.status === 'number' ? error.status : 1;
    const output = extractText(error).trim();
    return {
      command,
      exitCode: status,
      output,
      outputSha256: createHash('sha256').update(output, 'utf8').digest('hex'),
      report: parseReportOutput(output, command),
    };
  }
}

function parseReportOutput(output, command) {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(
      `gitpin gate did not emit parseable JSON for "${command}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function extractCoverage(report, path, lineNumber) {
  for (const claim of report.claims ?? []) {
    for (const item of claim.evidence ?? []) {
      if (
        item.status === 'verified' &&
        item.path === path &&
        item.lineStart === lineNumber &&
        item.lineEnd === lineNumber
      ) {
        return {
          repository: report.repository,
          path,
          lineStart: item.lineStart,
          lineEnd: item.lineEnd,
          sha: report.headSha,
          contentSha256: item.expectedContentSha256,
          citation: item.citation,
          handle: item.handle,
        };
      }
    }
  }
  return null;
}

function reproduciblePayload(artifact) {
  const copy = JSON.parse(JSON.stringify(artifact));
  delete copy.reproducibility.artifactSha256;
  return copy;
}

function commit(repositoryPath, message, date, env) {
  run('git', ['add', '--all'], repositoryPath, env);
  run('git', ['commit', '-qm', message], repositoryPath, {
    ...env,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  });
  return runOutput('git', ['rev-parse', 'HEAD'], repositoryPath, env).trim();
}

function run(command, args, cwd, env = process.env) {
  execFileSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'pipe',
    windowsHide: true,
  });
}

function runOutput(command, args, cwd, env = process.env) {
  return execFileSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    windowsHide: true,
  });
}

function extractText(error) {
  if (typeof error.stdout === 'string') return error.stdout;
  if (error.stdout instanceof Buffer) return error.stdout.toString('utf8');
  if (typeof error.stderr === 'string') return error.stderr;
  if (error.stderr instanceof Buffer) return error.stderr.toString('utf8');
  if (typeof error.message === 'string') return error.message;
  return '';
}

function readArtifactJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readFileUtf8(path) {
  return readFileSync(path, 'utf8');
}

function assertValue(actual, expected, label) {
  const normalizedActual = String(actual).replace(/\r\n/g, '\n').trim();
  const normalizedExpected = String(expected).replace(/\r\n/g, '\n').trim();
  if (normalizedActual !== normalizedExpected) {
    throw new Error(`Generated ${label} does not match checked-in source.`);
  }
}

function assertDeepEqual(actual, expected, label) {
  const left = JSON.stringify(reproduciblePayload(actual), null, 2);
  const right = JSON.stringify(reproduciblePayload(expected), null, 2);
  if (left !== right) {
    throw new Error(`Generated ${label} does not match checked-in source.`);
  }
}

function generateMarkdown(artifact) {
  return `# Synthetic PR evidence gate demo artifact

## Purpose

Deterministic, synthetic, fail-to-pass artifact for the GitPin v0.6.0 PR evidence gate.

## Accessibility

- Alternate text is provided in \`docs/demos/pr-gate-fail-to-pass.artifact.json:accessibility.altText\`.
- Caption is provided in \`docs/demos/pr-gate-fail-to-pass.artifact.json:accessibility.caption\`.
- No animation is required. The artifact is static and text-readable.

## Static visual

<figure>
  <img
    src="./pr-gate-fail-to-pass.svg"
    alt="A static flow diagram showing a PR gate fail for an uncovered material path, then a pass after adding a line-level evidence locator."
    width="1120"
    loading="lazy"
  />
  <figcaption>
    Static deterministic PR evidence gate flow for a synthetic repository. Phase A fails because \`docs/protocol.md\` is uncovered at commit \`${artifact.fixture.failHead}\`. Phase B passes after adding a line-level locator for \`docs/protocol.md:${artifact.fixture.lineAdded}-${artifact.fixture.lineAdded}\` on commit \`${artifact.fixture.head}\`.
  </figcaption>
</figure>

## Phase A: fail

\`\`\`bash
${artifact.failCase.command}
\`\`\`

\`\`\`text
${artifact.failCase.output}
\`\`\`

## Phase B: pass

\`\`\`bash
${artifact.passCase.command}
\`\`\`

\`\`\`json
${JSON.stringify(
  {
    repository: artifact.fixture.repository,
    path: artifact.passCase.coverage.path,
    lineStart: artifact.passCase.coverage.lineStart,
    lineEnd: artifact.passCase.coverage.lineEnd,
    sha: artifact.passCase.coverage.sha,
    contentSha256: artifact.passCase.coverage.contentSha256,
    citation: artifact.passCase.coverage.citation,
    handle: artifact.passCase.coverage.handle,
  },
  null,
  2,
)}
\`\`\`

\`\`\`text
${artifact.passCase.output}
\`\`\`

## Reduced-motion / static fallback

- For reduced-motion readers: read the two command/output blocks directly above.
- For tooling checks: consume \`pr-gate-fail-to-pass.artifact.json\` and validate fields:
  - \`failCase.status === 1\`
  - \`passCase.status === 0\`
  - \`passCase.coverage.sha === "${artifact.fixture.head}"\`
  - \`passCase.coverage.lineStart\` and \`passCase.coverage.lineEnd\` are both \`${artifact.fixture.lineAdded}\`
  - \`passCase.coverage.path === "docs/protocol.md"\`
  - \`fixture.head\` and \`fixture.base\` are full 40-char SHAs.
`;
}

function generateSvg(artifact) {
  const passCoverageText = `${artifact.passCase.coverage.path}:${artifact.passCase.coverage.lineStart}-${artifact.passCase.coverage.lineEnd}`;
  const wrapText = (value, maxChars = 56) => {
    const words = value.split(/\\s+/u);
    const lines = [];
    let current = '';
    for (const word of words) {
      if (word.length > maxChars) {
        if (current) {
          lines.push(current);
          current = '';
        }
        const chunks = word.match(new RegExp(`.{1,${maxChars}}`, 'gu'));
        if (chunks?.length) {
          lines.push(...chunks);
        }
        continue;
      }
      if (!current) {
        current = word;
        continue;
      }
      if (current.length + 1 + word.length <= maxChars) {
        current = `${current} ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  };
  const wrappedTextLines = (value, x, y, className, maxChars = 52) =>
    wrapText(value, maxChars).map(
      (line, index) => `    <text x="${x}" y="${y + index * 18}" class="${className}">${line}</text>`,
    );
  const failLocatorText = `${artifact.fixture.changedPath}:${artifact.fixture.lineAdded}`;
  const passLocatorText = `${passCoverageText}@${artifact.fixture.head}`;
  const output = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="560" viewBox="0 0 1120 560" role="img" aria-labelledby="title desc">',
    '  <title>GitPin PR gate synthetic fail-to-pass flow</title>',
    '  <desc>Synthetic PR evidence gate fail-to-pass flow with full SHA fixtures.</desc>',
    '  <defs>',
    '    <style><![CDATA[',
    '      .bg { fill: #f6f8fb; }',
    '      .box { fill: #ffffff; stroke: #2b3b53; stroke-width: 2; }',
    '      .title { fill: #0f172a; font: 700 26px Arial, sans-serif; }',
    '      .label { fill: #0f172a; font: 600 20px Arial, sans-serif; }',
    '      .body { fill: #1f2937; font: 500 16px Arial, sans-serif; }',
    '      .statusFail { fill: #991b1b; font: 700 20px Arial, sans-serif; }',
    '      .statusPass { fill: #065f46; font: 700 20px Arial, sans-serif; }',
    '      .arrow { fill: none; stroke: #334155; stroke-width: 3; marker-end: url(#arrowhead); }',
    '    ]]></style>',
    '  </defs>',
    '  <defs>',
    '    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto" markerUnits="strokeWidth">',
    '      <polygon points="0 0, 10 3.5, 0 7" fill="#334155" />',
    '    </marker>',
    '  </defs>',
    '  <rect width="1120" height="560" class="bg"/>',
    ...wrappedTextLines('GitPin 0.6.0: synthetic fail-to-pass PR evidence gate artifact', 36, 48, 'title', 36),
    '',
    '  <g transform="translate(36,84)">',
    '    <rect x="0" y="0" width="360" height="190" rx="10" class="box"/>',
    '    <text x="24" y="36" class="label">Phase A (fail)</text>',
    `    <text x="24" y="64" class="body">Base: ${artifact.fixture.base}</text>`,
    `    <text x="24" y="90" class="body">Head: ${artifact.fixture.failHead}</text>`,
    ...wrappedTextLines(`Fail path: ${failLocatorText}`, 24, 116, 'body', 58),
    '    <text x="24" y="146" class="statusFail">Output: FAIL (uncovered path)</text>',
    '  </g>',
    '',
    '  <path class="arrow" d="M 416 179 L 526 179"/>',
    '  <polygon points="526 179 511 173 511 185" fill="#334155"/>',
    '',
    '  <g transform="translate(552,84)">',
    '    <rect x="0" y="0" width="532" height="190" rx="10" class="box"/>',
    '    <text x="24" y="36" class="label">Phase B (pass)</text>',
    `    <text x="24" y="64" class="body">Head: ${artifact.fixture.head}</text>`,
    ...wrappedTextLines(`Locator: ${passLocatorText}`, 24, 90, 'body', 58),
    `    <text x="24" y="144" class="body">contentSha256: ${artifact.passCase.coverage.contentSha256.slice(0, 18)}</text>`,
    '    <text x="24" y="168" class="statusPass">Output: PASS (coverage complete)</text>',
    '  </g>',
    '',
    '  <line x1="36" y1="310" x2="1084" y2="310" stroke="#cbd5e1" stroke-width="2"/>',
    ...wrappedTextLines(`Synthetic SHA locus (full): ${artifact.fixture.base}`, 36, 338, 'body', 52),
    ...wrappedTextLines(`Synthetic SHA locus (fail): ${artifact.fixture.failHead}`, 36, 364, 'body', 52),
    ...wrappedTextLines(`Synthetic SHA locus (pass): ${artifact.fixture.head}`, 36, 390, 'body', 52),
    ...wrappedTextLines(`Repository: ${artifact.fixture.repository}`, 36, 416, 'body', 52),
    '',
    ...wrappedTextLines('Reduced-motion-safe static artifact: no animation, no moving text.', 36, 468, 'label', 52),
    ...wrappedTextLines(
      'Caption: one required path fails, then passes after adding a deterministic line-level locator.',
      36,
      494,
      'body',
      64,
    ),
    '</svg>',
  ];
  return output.join('\n');
}
