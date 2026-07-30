import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const PROVE_PROMPT_TEXT = [
  'You are using GitPin, not a generic repo-context dump.',
  'Product contract: index-free, read-only, Git HEAD only. Dirty worktrees are not evidence.',
  'Workflow: pin.catalog → pin.search_docs or pin.search_code (candidates) → pin.prove (evidence pack) → pin.verify (close the loop).',
  'For multi-repo decisions use pin.analyze operation brief (EvidenceBrief with evidenceSetId).',
  'Every factual claim must include repository, path, line, and full commit SHA (use citation.cite from pin.prove).',
  'If evidence is missing or blocked, say so—do not invent content.',
].join(' ');

export function registerProvePrompt(server: McpServer): void {
  server.registerPrompt(
    'prove-with-git-head',
    {
      description:
        'Force the agent into GitPin’s product loop: catalog → search candidates → pin.prove → pin.verify. No invented content.',
    },
    async () => ({
      messages: [{ role: 'user', content: { type: 'text', text: PROVE_PROMPT_TEXT } }],
    }),
  );
}
