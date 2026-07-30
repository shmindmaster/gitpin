---
name: gitpin
description: >-
  Verify multi-repo agent claims at Git HEAD with GitPin (index-free evidence).
  Use for catalog, search candidates, pin.prove / pin.prove_set, pin.verify / pin.verify_set,
  EvidenceBrief, and citation checks. Never treat dirty worktrees or search hits as claims.
---

# GitPin skill

## Product contract

- **Index-free**, **read-only**, **Git HEAD only**
- Dirty / untracked files are **not** evidence
- Job: prove and verify claims with **path + line + full SHA**

## Required loop

1. `pin.catalog` — discover registry roots and HEAD SHAs  
2. `pin.search_docs` / `pin.search_code` — **candidates only**  
3. `pin.prove` (one path) or `pin.prove_set` (1–8 multi-cite)  
4. `pin.verify` or `pin.verify_set` — close the loop  
5. Multi-repo decisions → `pin.analyze` with `operation: "brief"`

## Citation rules

- Copy `citation.cite` or `citation.handle` exactly into answers  
- Prefer `mustContain` on verify when asserting a quote or keyword  
- If status is `missing`, `blocked`, or `contradicted`, say so — do not invent content  

## CLI (same contract)

```bash
gitpin doctor
gitpin verify --repository <n> --path <p> --sha <hex> [--line <n>] [--must-contain <text>]
gitpin verify --from-pack pack.json
gitpin verify-cites --file notes.md
```

See `docs/cite-spec.md` and `docs/tools.md`.
