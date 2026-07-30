import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [storyboardPath, outputDirectory] = process.argv.slice(2);
const python = process.env.REPOCONTEXT_QWEN_TTS_PYTHON;
const cli = process.env.REPOCONTEXT_QWEN_TTS_CLI;

if (!storyboardPath || !outputDirectory) {
  throw new Error('Usage: node scripts/generate-demo-narration-qwen.mjs <storyboard-path> <output-directory>');
}
if (!python || !cli) {
  throw new Error(
    'Qwen narration requires REPOCONTEXT_QWEN_TTS_PYTHON and REPOCONTEXT_QWEN_TTS_CLI to reference the local runtime.',
  );
}
if (!existsSync(python) || !existsSync(cli)) {
  throw new Error('The configured local Qwen narration runtime is unavailable.');
}

const output = resolve(outputDirectory);
const storyboard = JSON.parse(readFileSync(storyboardPath, 'utf8'));
const voiceId = 'release-lead-narrator';
const instruction =
  'Warm, confident North American woman, experienced release engineering lead, calm and natural conversational delivery. ' +
  'Speak clearly at a slightly slower than average pace. Emphasize evidence, stale, and source-cited without sounding theatrical. ' +
  'Studio-quality close microphone, no music or background noise.';

if (!Array.isArray(storyboard.segments) || storyboard.segments.length === 0) {
  throw new Error('The demo storyboard has no narration segments.');
}

mkdirSync(output, { recursive: true });
const batchPath = join(output, 'qwen-batch.json');
const manifestPath = join(output, 'qwen-narration-manifest.json');
const jobs = storyboard.segments.map((segment) => {
  const id = String(segment.id);
  return {
    id,
    engine: 'qwen3-tts-voice-design',
    role: 'narrator',
    voice_id: voiceId,
    instruction,
    text: spokenText(segment.narration),
    speed: 0.93,
    out_path: join(output, `${id}.wav`),
    final_path: join(output, `${id}.mp3`),
  };
});

writeFileSync(batchPath, `${JSON.stringify({ jobs }, null, 2)}\n`, 'utf8');
execFileSync(python, [cli, '--batch', batchPath, '--manifest-out', manifestPath], {
  stdio: 'inherit',
  windowsHide: true,
  env: {
    ...process.env,
    HF_HOME: process.env.HF_HOME ?? 'D:\\AI-Platform\\models\\library\\ai\\huggingface',
  },
});

const generated = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (generated.summary?.failed || generated.jobs?.length !== jobs.length) {
  throw new Error('Qwen narration did not produce every requested segment.');
}
for (const job of jobs) {
  if (!existsSync(job.out_path) || !existsSync(job.final_path)) {
    throw new Error(`Qwen narration output is missing for ${job.id}.`);
  }
}

console.log(JSON.stringify({ status: 'generated', batchPath, manifestPath, jobs: jobs.length }));

function spokenText(value) {
  return String(value).replaceAll('RepoContext', 'Repo Context').replaceAll('API', 'A P I');
}
