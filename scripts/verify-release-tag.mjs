import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!tag) throw new Error('Pass the release tag or set GITHUB_REF_NAME.');

const expected = `v${packageJson.version}`;
if (tag !== expected)
  throw new Error(`Release tag ${tag} does not match package version ${packageJson.version}; expected ${expected}.`);

console.log(JSON.stringify({ tag, version: packageJson.version, status: 'matched' }));
