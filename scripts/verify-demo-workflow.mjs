import { runDemoWorkflow } from './demo-workflow.mjs';

const first = await runDemoWorkflow({ presentation: false });
const second = await runDemoWorkflow({ presentation: false });

if (first.brief.evidenceSetId !== second.brief.evidenceSetId) {
  throw new Error('Demo workflow evidence is not deterministic across fixture resets.');
}
if (
  first.catalog.map((repository) => repository.commitSha).join(',') !==
  second.catalog.map((repository) => repository.commitSha).join(',')
) {
  throw new Error('Demo fixture repository commits changed across resets.');
}

console.log(
  JSON.stringify({
    status: 'verified',
    evidenceSetId: first.brief.evidenceSetId,
    repositories: first.brief.scope.examinedRepositories,
    documents: first.brief.scope.totalDocuments,
    staleRepositories: first.brief.scope.staleRepositories,
    tools: first.toolNames.length,
  }),
);
