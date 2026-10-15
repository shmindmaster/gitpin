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
