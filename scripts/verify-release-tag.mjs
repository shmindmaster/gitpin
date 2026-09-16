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
          specifier.imported.name === importedName &&
          specifier.local.name === importedName,
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

function objectHasVersionProperty(node) {
  return (
    node?.type === 'ObjectExpression' &&
    node.properties.some(
      (property) =>
        property.type === 'Property' &&
        ((property.key.type === 'Identifier' && property.key.name === 'version') ||
          (property.key.type === 'Literal' && property.key.value === 'version')) &&
        isIdentifier(property.value, 'PACKAGE_VERSION'),
    )
  );
}

function hasServerVersionMetadata(sourceFile) {
  return sourceContains(
    sourceFile,
    (node) =>
      node.type === 'NewExpression' &&
      isIdentifier(node.callee, 'McpServer') &&
      objectHasVersionProperty(node.arguments[0]),
  );
}

function hasOnboardingVersionMetadata(sourceFile) {
  return sourceContains(sourceFile, (node) => {
    if (!objectHasVersionProperty(node)) return false;
    const values = new Map(
      node.properties
        .filter((property) => property.type === 'Property' && property.key.type === 'Identifier')
        .map((property) => [property.key.name, property.value]),
    );
    return (
      values.get('name')?.type === 'Literal' &&
      values.get('name').value === 'GitPin' &&
      values.get('schema')?.type === 'Literal' &&
      values.get('schema').value === 'v1'
    );
  });
}

function hasVersionedGitPinTemplate(sourceFile) {
  return sourceContains(
    sourceFile,
    (node) =>
      node.type === 'TemplateLiteral' &&
      node.expressions.length === 1 &&
      node.quasis.length === 2 &&
      node.quasis[0].value.raw.endsWith('gitpin@') &&
      isIdentifier(node.expressions[0], 'PACKAGE_VERSION'),
  );
}

const versionSource = parseTypeScript('src/version.ts');
const serverSource = parseTypeScript('src/server.ts');
const onboardingSource = parseTypeScript('src/onboarding.ts');
const registrySource = parseTypeScript('src/registry.ts');
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
if (!hasNamedImport(serverSource, 'PACKAGE_VERSION', './version') || !hasServerVersionMetadata(serverSource)) {
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
  !hasOnboardingVersionMetadata(onboardingSource)
) {
  throw new Error('Onboarding config must use PACKAGE_VERSION for package and client metadata.');
}
if (!hasNamedImport(registrySource, 'PACKAGE_VERSION', './version') || !hasVersionedGitPinTemplate(registrySource)) {
  throw new Error('Registry bootstrap guidance must use PACKAGE_VERSION from src/version.ts.');
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
const stageNeutralSurfaces = [
  {
    relativePath: 'README.md',
    pattern: new RegExp(
      `This source tree and its packed documentation describe GitPin ${escapedVersion} without asserting publication status`,
      'u',
    ),
  },
  {
    relativePath: 'docs/current-state.md',
    pattern: new RegExp(`This tree and the packed documentation describe \`${escapedVersion}\``, 'u'),
  },
  {
    relativePath: 'docs/website.md',
    pattern: new RegExp(
      `This tree and the packed documentation describe GitPin ${escapedVersion} without asserting publication status`,
      'u',
    ),
  },
  {
    relativePath: 'ROADMAP.md',
    pattern: new RegExp(
      `The ${escapedVersion} source tree and packed documentation are versioned without asserting publication status`,
      'u',
    ),
  },
];
for (const { relativePath, pattern } of stageNeutralSurfaces) {
  const content = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
  if (!pattern.test(content)) {
    throw new Error(`${relativePath} must describe ${packageJson.version} without asserting publication status.`);
  }
}
const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
const agentStagePatterns = [
  new RegExp(`This tree is the GitPin ${escapedVersion} release candidate`, 'u'),
  new RegExp(`This tree documents the verified GitPin ${escapedVersion} release`, 'u'),
];
const matchedAgentStages = agentStagePatterns.filter((pattern) => pattern.test(agents));
if (matchedAgentStages.length !== 1) {
  throw new Error(`AGENTS.md must declare exactly one candidate or verified release state for ${packageJson.version}.`);
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
