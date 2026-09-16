import { readFileSync } from 'node:fs';
import { parseSync, visitorKeys } from 'oxc-parser';
import YAML from 'yaml';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const expected = `v${packageJson.version}`;

function parseTypeScript(relativePath) {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
  const result = parseSync(relativePath, source);
  if (result.errors.length > 0) {
    throw new Error(`${relativePath} must parse before release metadata can be verified.`);
  }
  return result.program;
}

function hasDefaultImport(sourceFile, localName, moduleName) {
  return sourceFile.body.some(
    (statement) =>
      statement.type === 'ImportDeclaration' &&
      statement.source.value === moduleName &&
      statement.specifiers.some(
        (specifier) => specifier.type === 'ImportDefaultSpecifier' && specifier.local.name === localName,
      ),
  );
}

function hasNamedImport(sourceFile, importedName, moduleName) {
  return sourceFile.body.some(
    (statement) =>
      statement.type === 'ImportDeclaration' &&
      statement.source.value === moduleName &&
      statement.specifiers.some(
        (specifier) =>
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name === importedName,
      ),
  );
}

function sourceContains(sourceFile, predicate) {
  let found = false;
  function visit(node) {
    if (predicate(node)) {
      found = true;
      return;
    }
    for (const key of visitorKeys[node.type] ?? []) {
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item) visit(item);
        }
      } else if (child) {
        visit(child);
      }
    }
  }
  visit(sourceFile);
  return found;
}

function isIdentifier(node, name) {
  return node?.type === 'Identifier' && node.name === name;
}

function hasVersionProperty(sourceFile) {
  return sourceContains(
    sourceFile,
    (node) =>
      node.type === 'Property' &&
      ((node.key.type === 'Identifier' && node.key.name === 'version') ||
        (node.key.type === 'Literal' && node.key.value === 'version')) &&
      isIdentifier(node.value, 'PACKAGE_VERSION'),
  );
}

const versionSource = parseTypeScript('src/version.ts');
const serverSource = parseTypeScript('src/server.ts');
const onboardingSource = parseTypeScript('src/onboarding.ts');
const packageVersionInitializer = sourceContains(
  versionSource,
  (node) =>
    node.type === 'ExportNamedDeclaration' &&
    node.declaration?.type === 'VariableDeclaration' &&
    node.declaration.kind === 'const' &&
    node.declaration.declarations.some(
      (declaration) =>
        isIdentifier(declaration.id, 'PACKAGE_VERSION') &&
        declaration.init?.type === 'MemberExpression' &&
        declaration.init.computed === false &&
        isIdentifier(declaration.init.object, 'packageManifest') &&
        isIdentifier(declaration.init.property, 'version'),
    ),
);
if (!hasDefaultImport(versionSource, 'packageManifest', '../package.json') || !packageVersionInitializer) {
  throw new Error('src/version.ts must derive PACKAGE_VERSION from package.json.');
}
if (!hasNamedImport(serverSource, 'PACKAGE_VERSION', './version') || !hasVersionProperty(serverSource)) {
  throw new Error('MCP server metadata must use PACKAGE_VERSION from src/version.ts.');
}
const hasPackageSpec = sourceContains(
  onboardingSource,
  (node) =>
    node.type === 'VariableDeclarator' &&
    isIdentifier(node.id, 'packageSpec') &&
    node.init?.type === 'TemplateLiteral' &&
    node.init.expressions.length === 1 &&
    node.init.quasis.length === 2 &&
    node.init.quasis[0].value.raw === 'gitpin@' &&
    isIdentifier(node.init.expressions[0], 'PACKAGE_VERSION') &&
    node.init.quasis[1].value.raw === '',
);
if (
  !hasNamedImport(onboardingSource, 'PACKAGE_VERSION', './version') ||
  !hasPackageSpec ||
  !hasVersionProperty(onboardingSource)
) {
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
  const isCandidate = candidatePattern.test(content);
  const isPublished = publishedPattern.test(content);
  if (isCandidate && isPublished) {
    throw new Error(`${relativePath} must not declare both candidate and verified-release status.`);
  }
  const stage = isCandidate ? 'candidate' : isPublished ? 'published' : undefined;
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
