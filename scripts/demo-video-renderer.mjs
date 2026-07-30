import { resolve } from 'node:path';

export function buildSections(transcriptValue, narrationDisclosure = 'Local speech synthesis') {
  const lines = transcriptValue.trim().split(/\r?\n/);
  const line = (value) => {
    const found = lines.find((candidate) => candidate.includes(value));
    if (!found) throw new Error(`Live transcript is missing expected output: ${value}`);
    return found;
  };
  return new Map([
    ['cold-open', [line('RepoContext ·'), line('Synthetic fixture:'), line('MCP contract:')]],
    ['catalog', [line('1. Catalog'), line('atlas-api'), line('merchant-web'), line('support-ops')]],
    ['source-trace', [line('2. Find'), line('atlas-api docs/architecture.md'), line('Compare 1 changed path')]],
    [
      'brief',
      [
        line('3. Generate'),
        line('Examined'),
        line('Evidence set:'),
        ...lines.filter((candidate) => candidate.includes('Proof:')).slice(0, 1),
      ],
    ],
    ['guardrail', [line('Guardrail:'), line('Outcome:')]],
    ['payoff', [line('Outcome:'), `Synthetic fixture · actual local MCP session · ${narrationDisclosure}`]],
  ]);
}

export function renderScene({ segment, section, index }) {
  const output = section.flatMap((value) => wrap(value, 92));
  const headingLines = wrap(segment.primaryIdea, 55);
  const lineHeight = 27;
  const terminalHeight = Math.max(245, 102 + output.length * lineHeight + 30);
  const headingY = 108;
  const subheadingY = 140 + (headingLines.length - 1) * 48;
  const startY = 178 + (headingLines.length - 1) * 48;
  const chromeY = startY + 32;
  const outputY = startY + 74;
  const heading = headingLines
    .map(
      (value, lineIndex) => `<text x="64" y="${headingY + lineIndex * 48}" class="heading">${escapeXml(value)}</text>`,
    )
    .join('');
  const terminalLines = output
    .map((value, lineIndex) => {
      const color = /Guardrail|stale=true|Evidence set|Outcome:|Examined/.test(value) ? '#86efac' : '#d1d5db';
      return `<text x="86" y="${outputY + lineIndex * lineHeight}" class="terminal" fill="${color}">${escapeXml(value)}</text>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <style>
    .eyebrow { font: 600 18px 'Segoe UI', sans-serif; letter-spacing: 2px; fill: #86efac; }
    .heading { font: 700 40px 'Segoe UI', sans-serif; fill: #f9fafb; }
    .subheading { font: 400 21px 'Segoe UI', sans-serif; fill: #cbd5e1; }
    .terminal { font: 20px Consolas, 'Cascadia Mono', monospace; }
    .command { font: 600 20px Consolas, 'Cascadia Mono', monospace; fill: #93c5fd; }
    .footer { font: 400 16px 'Segoe UI', sans-serif; fill: #94a3b8; }
  </style>
  <rect width="1280" height="720" fill="#080d18"/>
  <rect x="0" y="0" width="1280" height="8" fill="#34d399"/>
  <text x="64" y="58" class="eyebrow">ACTUAL MCP SESSION · SYNTHETIC GIT FIXTURE</text>
  ${heading}
  <text x="64" y="${subheadingY}" class="subheading">${escapeXml(segment.wiifm)}</text>
  <rect x="60" y="${startY}" width="1160" height="${terminalHeight}" rx="18" fill="#111827" stroke="#334155" stroke-width="2"/>
  <circle cx="92" cy="${chromeY}" r="7" fill="#fb7185"/><circle cx="116" cy="${chromeY}" r="7" fill="#fbbf24"/><circle cx="140" cy="${chromeY}" r="7" fill="#4ade80"/>
  <text x="174" y="${chromeY + 6}" class="command">&gt; pnpm demo:workflow</text>
  ${terminalLines}
  <text x="64" y="680" class="footer">Beat ${index + 1} of 6 · ${escapeXml(segment.emphasis)}</text>
</svg>`;
}

export function renderSceneVideo(imagePath, wavePath, scenePath, duration, exec) {
  const audioFadeOut = Math.max(0, duration - 0.18).toFixed(3);
  exec('ffmpeg.exe', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-n',
    '-loop',
    '1',
    '-framerate',
    '30',
    '-i',
    imagePath,
    '-i',
    wavePath,
    '-filter_complex',
    `[0:v]zoompan=z='min(max(zoom,pzoom)+0.00012,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1280x720:fps=30,format=yuv420p[v];[1:a]apad=pad_dur=5,atrim=duration=${duration},afade=t=in:st=0:d=0.08,afade=t=out:st=${audioFadeOut}:d=0.18[a]`,
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-t',
    String(duration),
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    scenePath,
  ]);
}

export function buildCaptionEntries(segments, durations) {
  let cursor = 0;
  return segments.map((segment, index) => {
    const entry = {
      id: index + 1,
      startSeconds: round(cursor),
      endSeconds: round(cursor + durations[index] - segment.resultHoldSeconds),
      text: segment.narration,
    };
    cursor += durations[index];
    return entry;
  });
}

export function renderCaptions(entries) {
  return entries
    .map(
      (entry) =>
        `${entry.id}\n${timestampForSrt(entry.startSeconds)} --> ${timestampForSrt(entry.endSeconds)}\n${entry.text}\n`,
    )
    .join('\n');
}

export function renderVtt(entries) {
  return `WEBVTT\n\n${entries
    .map((entry) => `${timestampForVtt(entry.startSeconds)} --> ${timestampForVtt(entry.endSeconds)}\n${entry.text}\n`)
    .join('\n')}`;
}

export function ffmpegFilterPath(path) {
  return resolve(path).replaceAll('\\', '/').replace(':', '\\:').replaceAll("'", "\\\\'");
}

export function probeDuration(path, exec) {
  return Number.parseFloat(
    exec('ffprobe.exe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path]),
  );
}

function timestampForSrt(seconds) {
  const totalMilliseconds = Math.round(seconds * 1000);
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const secondsPart = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

function timestampForVtt(seconds) {
  return timestampForSrt(seconds).replace(',', '.');
}

function wrap(value, width) {
  const words = value.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (`${current} ${word}`.trim().length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
