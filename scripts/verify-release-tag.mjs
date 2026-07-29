import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const expected = `v${packageJson.version}`;
const githubTag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined;
const tag = process.argv[2] ?? githubTag ?? expected;
if (tag !== expected)
  throw new Error(`Release tag ${tag} does not match package version ${packageJson.version}; expected ${expected}.`);

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const escapedVersion = packageJson.version.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const releaseHeading = changelog.match(new RegExp(`^## \\[${escapedVersion}\\] - (\\d{4}-\\d{2}-\\d{2})$`, 'mu'));
if (!releaseHeading) {
  throw new Error(`CHANGELOG.md must contain a dated release heading for ${packageJson.version}.`);
}

console.log(
  JSON.stringify({
    tag,
    version: packageJson.version,
    releaseDate: releaseHeading[1],
    status: 'matched',
  }),
);
