# GitPin client rules (paste into AGENTS.md / Cursor rules / Claude project)

When answering questions about **our local repositories** registered with GitPin:

1. Call **GitPin** tools before asserting multi-repo or path-level facts.  
2. Never treat `pin.search_*` hits as final claims — they are **candidates**.  
3. Always close the loop: `pin.prove` → `pin.verify` (or `pin.prove_set` → `pin.verify_set`).  
4. Include **path, line, and full commit SHA** (`citation.cite` or `citation.handle`).  
5. Dirty worktrees and editor buffers are **not** evidence; use HEAD only.  
6. If GitPin returns blocked/missing/contradicted, report that instead of inventing content.  
7. For release / review decisions, prefer `pin.analyze` brief (`EvidenceBrief`).  

Install: `npx -y gitpin@0.6.2` and set `GITPIN_REGISTRY`.
