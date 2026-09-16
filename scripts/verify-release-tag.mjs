import { readFileSync } from 'node:fs';
import YAML from 'yaml';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const expected = `v${packageJson.version}`;
const serverSource = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../src/onboarding.ts', import.meta.url), 'utf8');
const versionSource = readFileSync(new URL('../src/version.ts', import.meta.url), 'utf8');
if (
  !versionSource.includes("import packageManifest from '../package.json'") ||
  !versionSource.includes('packageManifest.version')
) {
  throw new Error('src/version.ts must derive PACKAGE_VERSION from package.json.');
}
if (!serverSource.includes('version: PACKAGE_VERSION') || !serverSource.includes("from './version'")) {
  throw new Error('MCP server metadata must use PACKAGE_VERSION from src/version.ts.');
}
if (!/gitpin@\$\{PACKAGE_VERSION\}/u.test(onboardingSource) || !onboardingSource.includes('version: PACKAGE_VERSION')) {
  throw new Error('Onboarding config must use PACKAGE_VERSION for package and client metadata.');
}

const registryMetadata = JSON.parse(readFileSync(new URL('../server.json', import.meta.url), 'utf8'));
if (
  registryMetadata.version !== packageJson.version ||
  registryMetadata.packages?.[0]?.version !== packageJson.version
) {
  throw new Error('server.json top-level and package versions must match package.json.');
}

const actionSource = readFileSync(new URL('../action.yml', import.meta.url), 'utf8');
const actionMetadata = YAML.parse(actionSource);
const actionDefault = actionMetadata?.inputs?.['gitpin-version']?.default;
if (actionDefault !== packageJson.version) {
  throw new Error(
    `action.yml default ${actionDefault ?? 'missing'} does not match package version ${packageJson.version}.`,
  );
}

const escapedVersion = packageJson.version.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
if (
  !readme.includes(
    `**Versioned distribution:** This source tree and its packed README document GitPin ${packageJson.version}`,
  )
) {
  throw new Error(`README.md must describe ${packageJson.version} with stage-neutral packed-package wording.`);
}

const releaseStageSurfaces = [
  {
    relativePath: 'docs/current-state.md',
    candidatePattern: new RegExp(`\\*\\*Release candidate:\\*\\* This tree targets \`${escapedVersion}\``, 'u'),
    publishedPattern: new RegExp(`\\*\\*Published:\\*\\* \`${escapedVersion}\` is the current verified release`, 'u'),
  },
  {
    relativePath: 'docs/website.md',
    candidatePattern: new RegExp(`This tree is the GitPin ${escapedVersion} release candidate`, 'u'),
    publishedPattern: new RegExp(`GitPin ${escapedVersion} is the current verified release`, 'u'),
  },
  {
    relativePath: 'ROADMAP.md',
    candidatePattern: new RegExp(`${escapedVersion} is the release candidate`, 'u'),
    publishedPattern: new RegExp(`${escapedVersion} is the current verified release`, 'u'),
  },
  {
    relativePath: 'AGENTS.md',
    candidatePattern: new RegExp(`This tree is the GitPin ${escapedVersion} release candidate`, 'u'),
    publishedPattern: new RegExp(`This tree documents the verified GitPin ${escapedVersion} release`, 'u'),
  },
];
const matchedStages = new Set();
for (const { relativePath, candidatePattern, publishedPattern } of releaseStageSurfaces) {
  const content = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
  const stage = candidatePattern.test(content) ? 'candidate' : publishedPattern.test(content) ? 'published' : undefined;
  if (!stage) {
    throw new Error(
      `${relativePath} must name ${packageJson.version} in a stage-accurate candidate or verified-release statement.`,
    );
  }
  matchedStages.add(stage);
}
if (matchedStages.size !== 1) {
  throw new Error(`Release status surfaces disagree: found stages ${[...matchedStages].sort().join(', ')}.`);
}
const githubTag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined;
const tag = process.argv[2] ?? githubTag ?? expected;
if (tag !== expected)
  throw new Error(`Release tag ${tag} does not match package version ${packageJson.version}; expected ${expected}.`);

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const releaseHeading = changelog.match(new RegExp(`^## \\[${escapedVersion}\\] - (\\d{4}-\\d{2}-\\d{2})$`, 'mu'));
if (!releaseHeading) {
  throw new Error(`CHANGELOG.md must contain a dated release heading for ${packageJson.version}.`);
}

console.log(
  JSON.stringify({
    tag,
    version: packageJson.version,
    serverVersion: packageJson.version,
    releaseDate: releaseHeading[1],
    status: 'matched',
  }),
);
