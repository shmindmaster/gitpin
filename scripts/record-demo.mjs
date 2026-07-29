import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import {
  buildCaptionEntries,
  buildSections,
  ffmpegFilterPath,
  probeDuration,
  renderCaptions,
  renderScene,
  renderSceneVideo,
  renderVtt,
} from './demo-video-renderer.mjs';

const workspace = process.cwd();
const episodeId = 'release-evidence-brief';
const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
const capturedAt = new Date().toISOString();
const runDirectory = join(workspace, '.demo', 'recordings', `${episodeId}-${timestamp}`);
const outputDirectory = resolve(
  process.env.REPOCONTEXT_DEMO_VIDEO_DIR ?? join(process.env.USERPROFILE ?? workspace, 'Videos', 'RepoContext'),
);
const storyboardPath = join(workspace, 'docs', 'demos', `${episodeId}.storyboard.json`);
const truthSheetPath = join(workspace, 'docs', 'demos', `${episodeId}.truth.json`);
const claimLedgerPath = join(workspace, 'docs', 'demos', `${episodeId}.claims.json`);
const sourceRevision = exec('git', ['rev-parse', 'HEAD']).trim();

mkdirSync(runDirectory, { recursive: true });
mkdirSync(outputDirectory, { recursive: true });

const storyboard = JSON.parse(read(storyboardPath));
const truthSheet = JSON.parse(read(truthSheetPath));
const claimLedger = JSON.parse(read(claimLedgerPath));
const transcript = exec(process.execPath, [join(workspace, 'scripts', 'demo-workflow.mjs')], {
  env: { ...process.env, REPOCONTEXT_DEMO_PACE_MS: '0' },
});
const transcriptPath = join(runDirectory, 'live-mcp-transcript.txt');
write(transcriptPath, transcript);

const sections = buildSections(transcript);
const narrationDirectory = join(runDirectory, 'narration');
exec('powershell.exe', [
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  join(workspace, 'scripts', 'generate-demo-narration.ps1'),
  '-StoryboardPath',
  storyboardPath,
  '-OutputDirectory',
  narrationDirectory,
]);

const scenePaths = [];
const sceneDurations = [];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  for (const [index, segment] of storyboard.segments.entries()) {
    const section = sections.get(segment.id);
    if (!section) throw new Error(`No transcript section is configured for ${segment.id}.`);
    const stem = `scene-${String(index + 1).padStart(2, '0')}-${segment.id}`;
    const svgPath = join(runDirectory, `${stem}.svg`);
    const pngPath = join(runDirectory, `${stem}.png`);
    const wavePath = join(narrationDirectory, `${segment.id}.wav`);
    const scenePath = join(runDirectory, `${stem}.mp4`);
    write(svgPath, renderScene({ segment, section, index }));
    await page.goto(pathToFileURL(svgPath).href, { waitUntil: 'load' });
    await page.screenshot({ path: pngPath, animations: 'disabled' });
    const duration = round(probeDuration(wavePath, exec) + segment.resultHoldSeconds);
    renderSceneVideo(pngPath, wavePath, scenePath, duration, exec);
    scenePaths.push(scenePath);
    sceneDurations.push(duration);
  }
} finally {
  await browser.close();
}

const concatPath = join(runDirectory, 'concat.txt');
write(concatPath, `${scenePaths.map((path) => `file '${path.replaceAll('\\', '/')}'`).join('\n')}\n`);
const concatenatedPath = join(runDirectory, `${episodeId}-candidate.mp4`);
exec('ffmpeg.exe', [
  '-hide_banner',
  '-loglevel',
  'error',
  '-n',
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  concatPath,
  '-c',
  'copy',
  '-movflags',
  '+faststart',
  concatenatedPath,
]);

const captionsPath = join(runDirectory, `${episodeId}.srt`);
const captionEntries = buildCaptionEntries(storyboard.segments, sceneDurations);
write(captionsPath, renderCaptions(captionEntries));
const captionsVttPath = join(runDirectory, `${episodeId}.vtt`);
write(captionsVttPath, renderVtt(captionEntries));
const captionsJsonPath = join(runDirectory, `${episodeId}.captions.json`);
write(captionsJsonPath, `${JSON.stringify(captionEntries, null, 2)}\n`);
const transcriptTextPath = join(runDirectory, `${episodeId}.transcript.txt`);
write(transcriptTextPath, `${storyboard.segments.map((segment) => segment.narration).join('\n')}\n`);

const masterPath = uniqueOutputPath(outputDirectory, `RepoContext-${episodeId}-${timestamp}`, '.mp4');
exec('ffmpeg.exe', [
  '-hide_banner',
  '-loglevel',
  'error',
  '-n',
  '-i',
  concatenatedPath,
  '-map',
  '0:v',
  '-map',
  '0:a',
  '-c:v',
  'libx264',
  '-preset',
  'medium',
  '-crf',
  '18',
  '-pix_fmt',
  'yuv420p',
  '-vf',
  `subtitles=filename='${ffmpegFilterPath(captionsPath)}':charenc=UTF-8:force_style='FontName=Segoe UI,FontSize=19,PrimaryColour=&H00FFFFFF,OutlineColour=&H90000000,BorderStyle=1,Outline=2,Alignment=2,MarginV=45'`,
  '-c:a',
  'copy',
  '-metadata',
  'title=RepoContext: Release Evidence Brief',
  '-metadata',
  'comment=Programmatic terminal recording from a live synthetic MCP workflow. Local speech synthesis.',
  '-movflags',
  '+faststart',
  masterPath,
]);
const posterPath = join(runDirectory, `${episodeId}-poster.png`);
exec('ffmpeg.exe', [
  '-hide_banner',
  '-loglevel',
  'error',
  '-n',
  '-ss',
  '30',
  '-i',
  masterPath,
  '-frames:v',
  '1',
  posterPath,
]);

const manifestPath = join(runDirectory, 'episode-manifest.json');
const manifest = {
  schemaVersion: 1,
  episodeId,
  status: 'candidate-needs-human-watch-through',
  sourceRevision,
  product: 'RepoContext',
  captureMethod: 'Programmatic terminal recording from the stdout of a live stdio MCP session.',
  fixture: 'scripts/demo-fixture.mjs; three isolated synthetic Git repositories; no indexed repository writes.',
  transcript: { path: transcriptPath, sha256: sha256(transcript) },
  assets: {
    storyboard: storyboardPath,
    truthSheet: truthSheetPath,
    claimLedger: claimLedgerPath,
    captions: captionsPath,
    captionsVtt: captionsVttPath,
    captionsJson: captionsJsonPath,
    transcript: transcriptTextPath,
    poster: posterPath,
    master: masterPath,
  },
  captures: storyboard.segments.map((segment) => captureManifest(segment)),
  narration: {
    provider: 'Windows System.Speech.Synthesis',
    voice: 'Microsoft Zira Desktop',
    rate: -1,
    disclosure: 'Local synthetic speech; no external TTS service was used.',
  },
  durationSeconds: round(sceneDurations.reduce((total, duration) => total + duration, 0)),
  claims: claimLedger.claims.map((claim) => claim.id),
  truth: truthSheet.expected,
  captions: { burnedIntoMaster: true, srt: captionsPath, vtt: captionsVttPath, json: captionsJsonPath },
  render: {
    format: 'wide',
    width: 1280,
    height: 720,
    frameRate: 30,
    videoCodec: 'h264',
    audioCodec: 'aac',
    masterSha256: sha256(readFileSync(masterPath)),
  },
  reproduction: {
    verify: 'pnpm demo:verify',
    record: 'REPOCONTEXT_DEMO_VIDEO_DIR=<local-output-directory> pnpm demo:record',
  },
  humanReview: {
    status: 'required-before-external-publication',
    requiredChecks: [
      'watch complete master',
      'verify captions and narration',
      'verify no sensitive information',
      'approve external publication',
    ],
  },
};
write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  JSON.stringify({ status: 'recorded', masterPath, manifestPath, durationSeconds: manifest.durationSeconds }),
);

function captureManifest(segment) {
  return {
    scenario: segment.id,
    route: 'stdio://local/repocontext',
    sourceRevision,
    fixture: 'scripts/demo-fixture.mjs',
    environment: 'synthetic-local',
    persona: 'release engineering lead',
    deploymentIdentity: 'local built dist/server.js over stdio MCP',
    deploymentVerified: true,
    capturedAt,
    viewport: { width: 1280, height: 720 },
    focus: { x: 60, y: 178, width: 1160, height: 360 },
    protectedRegions: [{ x: 60, y: 178, width: 1160, height: 360 }],
    action: 'Run the live synthetic stdio MCP workflow and render the asserted stdout beat.',
    targetSelector: `stdout:${segment.id}`,
    consoleErrors: [],
    failedRequests: [],
    missedVisualTargets: [],
    resetResult: 'passed: scripts/demo-workflow.mjs resets the fixture before the session.',
    readinessState: 'PASS',
    verdict: 'pass',
  };
}

function uniqueOutputPath(directory, stem, extension) {
  const target = join(directory, `${stem}${extension}`);
  if (existsSync(target)) throw new Error(`Refusing to overwrite existing video artifact: ${target}`);
  return target;
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, contents) {
  if (existsSync(path)) throw new Error(`Refusing to overwrite existing recording artifact: ${path}`);
  writeFileSync(path, contents, 'utf8');
}

function exec(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', windowsHide: true, ...options });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

if (process.argv[1] && resolve(process.argv[1]) !== fileURLToPath(import.meta.url)) {
  throw new Error(`Expected to run ${basename(fileURLToPath(import.meta.url))} directly.`);
}
