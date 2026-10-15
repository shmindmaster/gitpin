# Demos

Every film below is a **real recording**. The real `gitpin` CLI runs in a real shell against fixture GP1, a synthetic git repository built by `scripts/build-pr-gate-fail-to-pass-artifact.mjs --persist --verify` (base `43439f8`, failing head `f0137d9`, passing head `57bce1a`, author `demo@gitpin.invalid`). Capture is headless Playwright (WebM) finished with Recast. There is no mock UI and no substitute footage. "Rosa" (release lead) is a fictional persona and is labelled as one on screen.

Videos are kept outside the repository, in the owner's media library. SHA-256 hashes identify each exact file.

## Delivered films

| Film | Length | Recorded at | What it shows | QA on the exact file | SHA-256 |
|---|---|---|---|---|---|
| `Videos\Portfolio\GitPin\01 - The Gate That Wants Evidence.mp4` (+ `.srt`) | 1:35 | captured on the `03c1e69` build; every filmed command re-run byte-identical at main `e4c550e` | An agent PR changes `docs/protocol.md` and its manifest has `"claims": []`. `gitpin gate` returns `uncovered-change` and exit 1. One claim is added (line 5 plus `contentSha256`), and the same gate returns `evidence-verified` and exit 0. `git show … \| sha256sum` reproduces the hash. Shows the gate's coverage code in `src/gate.ts`, the CI signal (exit 1 fails, exit 0 clears), and the stated limit ("committed content, not semantic correctness"). | -16.0 LUFS; WER 0.0 (ElevenLabs scribe_v2 vs script); validate-encoded-picture PASS; story-experience review 90/100 | `d046bd6217fe7800c8d3b65ccc59caa8d0ab6c3ef417ce9870f3ffaa7f980012` |
| `Videos\Portfolio\GitPin\02 - The Gate in 30 Seconds.mp4` (+ `.srt`) | 0:32 | 1x frame-accurate cut of film 01; main still `e4c550e` on 2026-10-14 | Social cut with burned-in captions: zero claims → exit 1; one pinned claim → exit 0; plain-git recheck; the stated limit. | -16.0 LUFS; WER 0.0; no frozen picture ≥ 4 s; story-experience review 86/100 | `aff4b0f14fe89f226890f62e35e247aed53fea788d3fbb572a7209ee7fac8e7b` |
| `Videos\Evergreen\Proof Clips\02 - GitPin Evidence Gate.mp4` (+ `.srt`) | 0:13 | cut from film 01 | Fail, add claim, pass, plain-git recheck. Modular clip. | WER 0.0 | `2fd69c991c8897114fddfff604138965d3fd119f1dca883316889629acf82b75` |

Narration:
- Film 01 uses ElevenLabs Eric.
- Film 02 and the proof clip use ElevenLabs Bella.
- Both run on `eleven_v4`, third person.

Formats:
- Film 01 is format **B**, the functional walkthrough.
- Film 02 is a social teaser cut from it.
- Format **C**, the architecture and integration walkthrough, has not been made yet.

## Traces behind the films
These are in the production workspace `D:\Local-AI\data\artifacts\media-studio\gitpin-hero-reel-20261014\`:
- `evidence/runtime-terminal-log.jsonl`: every command typed on camera, with output and exit code.
- `receipts/rerun-at-e4c550e.json`: the nine filmed commands re-run at `e4c550e` with byte-identical output.
- `receipts/gp1-verify-e4c550e.json`: the fixture verified at `e4c550e`.
- `receipts/claims-trace.json`: each spoken claim mapped to file:line.
- `qa/QA-RECORD.md`: the full gate table.

The social cut's EDL, which records what each segment proves, is in `D:\Local-AI\data\artifacts\media-studio\gitpin-social30-20261014\story\edl.json`.

## In-repo demo assets
- [`docs/demos/pr-gate-fail-to-pass.md`](../demos/pr-gate-fail-to-pass.md), with its `.artifact.json` and `.svg`.
- `pnpm demo:gate`, a live fail-to-pass run on a scratch synthetic repo (`scripts/demo-gate-hero.mjs`, covered by `src/gate-hero.test.ts`).

## Not demonstrated
- An MCP client (Claude Code or another) calling `pin.search → pin.prove → pin.verify`.
- The GitHub Action failing a real agent PR in the Checks UI.
- The HTTP transport with a bearer token.

## Production plan: the next two assets

Both reuse the GP1 footage. Heavy work (capture, TTS, render) waits for an assigned slot.

**C. Technical deep dive, "Inside the gate's trust boundary" (about 6 min, developer education).** Planned, not made.
- **Hook (0:00–0:15).** A PR tries to weaken its own gate by editing `.gitpin/gate.yml` in head. The gate reads policy from base, reports `policy-change-blocked`, and exits 1.
- **Axes (0:15–0:45).** Base versus head trust. Coverage from the merge-base diff, not from the PR description. A hash-pinned line versus a semantic check.
- **Behaviour, then diagram (0:45–3:15).** Reuse the GP1 fail and pass takes. Walk the 17-hop trace in [TECHNICAL.md](TECHNICAL.md) on the code stage: `gate.ts` policy block (55–67), line-slice hash (108–115), coverage (169–173). Show the Mermaid diagram after the behaviour.
- **MCP (3:15–4:15).** A real MCP client over stdio calling `pin.search` → `pin.prove` → `pin.verify`, ending with the evidence pack's full SHA and hash.
- **Trade-off (4:15–4:45).** "Committed content, not semantic correctness." The claim text is not judged, except through optional `mustContain`.
- **Failure and recovery (4:45–5:30).** Edit the cited line after proving: the gate reports `content-hash-mismatch`. Re-prove, and it passes.
- **Payoff (5:30–6:00).** The Action YAML and `npx -y gitpin@0.6.4`. One call to action.
- **New captures needed:** the policy-change block, the hash mismatch and the MCP session.
- **Voice:** the local Qwen3-TTS narrator (no ElevenLabs spend), with WER checked by local ASR.

**Vertical short (≤ 45 s, 1080x1920).** Planned, not made.
- Reframed from film 02's beats: zero claims (exit 1), one pinned claim (exit 0), the plain-git recheck and the limit.
- Cropped from the GP1 Recast takes, not by letterboxing the 16:9 master.
- Burned-in captions. It reuses film 02's Bella lines, so there is no new TTS.

**ElevenLabs usage to date:**
- Film 02 used 7 `eleven_v4` lines, 411 characters. The API's `character-cost` headers total 180.
- Its music bed was reused from film 01.
- Film 01's usage is recorded in its own job workspace.
