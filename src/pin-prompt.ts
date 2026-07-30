import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const PROVE_PROMPT_TEXT = [
  'You are using GitPin, not a generic repo-context dump.',
  'Product contract: index-free, read-only, Git HEAD only. Dirty worktrees are not evidence.',
  'Workflow: pin.catalog → pin.search_docs or pin.search_code (candidates) → pin.prove or pin.prove_set → pin.verify or pin.verify_set.',
  'Use pin.prove_set when the answer needs multiple citations (max 8). Close multi-cite sets with pin.verify_set.',
  'For multi-repo decisions use pin.analyze operation brief (EvidenceBrief with evidenceSetId).',
  'Every factual claim must include repository, path, line, and full commit SHA (citation.cite or citation.handle from pin.prove).',
  'Optional: pin.verify mustContain to check that claimed text is still present at the SHA.',
  'If evidence is missing, blocked, or contradicted, say so—do not invent content.',
].join(' ');

export function registerProvePrompt(server: McpServer): void {
  server.registerPrompt(
    'prove-with-git-head',
    {
      description:
        'Force GitPin product loop: catalog → candidates → pin.prove/prove_set → pin.verify/verify_set. No invented content.',
    },
    async () => ({
      messages: [{ role: 'user', content: { type: 'text', text: PROVE_PROMPT_TEXT } }],
    }),
  );
}
