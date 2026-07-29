import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resetDemoFixture } from './demo-fixture.mjs';

export async function runDemoWorkflow({ presentation = true } = {}) {
  const fixture = resetDemoFixture();
  const environment = { ...process.env, REPOCONTEXT_REGISTRY: fixture.registryPath };
  const serverPath = resolve(process.cwd(), 'dist', 'server.js');
  const doctor = execFileSync(process.execPath, [serverPath, 'doctor'], {
    cwd: process.cwd(),
    env: environment,
    encoding: 'utf8',
    windowsHide: true,
  });
  const client = new Client({ name: 'repocontext-demo-workflow', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: process.cwd(),
    env: Object.fromEntries(Object.entries(environment).filter((entry) => typeof entry[1] === 'string')),
    stderr: 'pipe',
  });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const catalog = toolJson(await client.callTool({ name: 'wiki.catalog', arguments: { view: 'repositories' } }));
    const search = toolJson(
      await client.callTool({ name: 'wiki.search', arguments: { query: 'release gate', repository: 'atlas-api' } }),
    );
    const comparison = toolJson(
      await client.callTool({
        name: 'repo.compare',
        arguments: {
          repository: fixture.expected.changedRepository,
          base: fixture.repositories['atlas-api'].initialCommit,
          head: fixture.repositories['atlas-api'].headCommit,
        },
      }),
    );
    const brief = toolJson(
      await client.callTool({
        name: 'wiki.analyze',
        arguments: { operation: 'brief', audience: 'leadership' },
      }),
    );
    const repeatedBrief = toolJson(
      await client.callTool({
        name: 'wiki.analyze',
        arguments: { operation: 'brief', audience: 'technical' },
      }),
    );
    const result = verifyWorkflow({ fixture, tools, catalog, search, comparison, brief, repeatedBrief, doctor });
    if (presentation) printPresentation(result);
    return result;
  } finally {
    await client.close();
  }
}

function verifyWorkflow({ fixture, tools, catalog, search, comparison, brief, repeatedBrief, doctor }) {
  const toolNames = tools.tools.map((tool) => tool.name).sort();
  const staleRepository = catalog.find((repository) => repository.name === 'merchant-web');
  const staleGap = brief.gaps.find((gap) => gap.id === 'stale:merchant-web');
  if (!doctor.includes('RepoContext readiness: attention'))
    throw new Error('Expected doctor to flag stale demo evidence.');
  if (catalog.length !== fixture.expected.repositories)
    throw new Error('The demo catalog did not include every synthetic repository.');
  if (brief.scope.totalDocuments !== fixture.expected.documents)
    throw new Error('The demo brief document count diverged from fixture truth.');
  if (!staleRepository?.stale || !staleGap) throw new Error('The demo did not surface the stale-evidence guardrail.');
  if (brief.evidenceSetId !== repeatedBrief.evidenceSetId)
    throw new Error('Context Brief evidence changed across presentation audiences.');
  if (toolNames.length !== 8 || !tools.tools.every((tool) => tool.annotations?.readOnlyHint === true)) {
    throw new Error('The demo MCP server did not expose the expected read-only tool surface.');
  }
  if (!Array.isArray(comparison.files) || comparison.files.length !== fixture.expected.changedPaths.length) {
    throw new Error('The demo comparison did not return the expected changed path.');
  }
  if (!Array.isArray(search) || search.length === 0)
    throw new Error('The demo search did not return committed source evidence.');
  return { fixture, toolNames, catalog, search, comparison, brief, doctor };
}

function printPresentation({ fixture, toolNames, catalog, search, comparison, brief }) {
  const searchHit = search[0];
  const sourceTrace = brief.technicalTrace.slice(0, 3);
  line('RepoContext · release evidence in one reviewable brief');
  line(
    `Synthetic fixture: ${fixture.expected.repositories} Git repositories · ${fixture.expected.documents} committed documents`,
  );
  pause();
  line(`MCP contract: ${toolNames.length} tools · all read-only`);
  line('1. Catalog committed documentation');
  for (const repository of catalog) {
    line(
      `   ${repository.name.padEnd(13)} docs=${repository.docCount} stale=${repository.stale} commit=${short(repository.commitSha)}`,
    );
  }
  pause();
  line('2. Find the source before making a release call');
  line(`   ${searchHit.repository} ${searchHit.sourcePath}:${searchHit.line} · ${searchHit.snippet.trim()}`);
  line(`   Compare ${comparison.files.length} changed path · ${comparison.files.map((file) => file.path).join(', ')}`);
  pause();
  line('3. Generate the source-cited Context Brief');
  line(`   ${brief.presentation.summary}`);
  line(`   Evidence set: ${brief.evidenceSetId}`);
  for (const trace of sourceTrace) {
    line(`   Proof: ${trace.repository} ${trace.sourcePath}:${trace.line} @ ${short(trace.commitSha)}`);
  }
  pause();
  line('Guardrail: merchant-web has uncommitted documentation. It is marked stale and excluded from pinned evidence.');
  line('Outcome: a release lead gets the known facts, gaps, and source traces before asking an agent to act.');
}

function toolJson(result) {
  const text = result.content
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n');
  return JSON.parse(text);
}

function line(value) {
  process.stdout.write(`${value}\n`);
}

function pause() {
  const delay = Number.parseInt(process.env.REPOCONTEXT_DEMO_PACE_MS ?? '0', 10);
  if (!Number.isInteger(delay) || delay <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
}

function short(value) {
  return typeof value === 'string' ? value.slice(0, 12) : 'unavailable';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const presentation = !process.argv.includes('--json');
  runDemoWorkflow({ presentation })
    .then((result) => {
      if (!presentation) {
        console.log(
          JSON.stringify({
            status: 'ready',
            evidenceSetId: result.brief.evidenceSetId,
            repositories: result.brief.scope.examinedRepositories,
            documents: result.brief.scope.totalDocuments,
            staleRepositories: result.brief.scope.staleRepositories,
            comparedPaths: result.comparison.files.length,
            tools: result.toolNames.length,
          }),
        );
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
