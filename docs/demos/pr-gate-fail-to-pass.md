# Synthetic PR evidence gate demo artifact

## Purpose

Deterministic, synthetic, fail-to-pass artifact for the GitPin v0.6.1 PR evidence gate.

## Accessibility

- Alternate text is provided in `docs/demos/pr-gate-fail-to-pass.artifact.json:accessibility.altText`.
- Caption is provided in `docs/demos/pr-gate-fail-to-pass.artifact.json:accessibility.caption`.
- No animation is required. The artifact is static and text-readable.

## Static visual

<figure>
  <img
    src="./pr-gate-fail-to-pass.svg"
    alt="A static flow diagram showing a PR gate fail for an uncovered material path, then a pass after adding a line-level evidence locator."
    width="1120"
    loading="lazy"
  />
  <figcaption>
    Static deterministic PR evidence gate flow for a synthetic repository. Phase A fails because `docs/protocol.md` is uncovered at commit `f0137d966ec3283719c095b46215adffb08588ce`. Phase B passes after adding a line-level locator for `docs/protocol.md:5-5` on commit `57bce1a312f6153e171b515c41727ff81e77fb3c`.
  </figcaption>
</figure>

## Phase A: fail

```bash
gitpin gate --base 43439f836e8f7ac27e5f41587caba435b758a4cc --head f0137d966ec3283719c095b46215adffb08588ce
```

```text
{
  "kind": "gitpin-gate-report",
  "schemaVersion": 1,
  "status": "failed",
  "reportId": "70ce3c4dd0bcce83",
  "repository": "task-2-synthetic-pr-fixture",
  "baseSha": "43439f836e8f7ac27e5f41587caba435b758a4cc",
  "headSha": "f0137d966ec3283719c095b46215adffb08588ce",
  "mergeBaseSha": "43439f836e8f7ac27e5f41587caba435b758a4cc",
  "policy": {
    "path": ".gitpin/gate.yml",
    "sha256": "672e3e648ae68b3f473fce90147b9f6ba5c1c21fba68b88e199f1d352b21e2ae"
  },
  "manifest": {
    "path": ".gitpin/change-evidence.json",
    "sha256": "3be3fb67811a2ebbf3a3f0078cc78f2b01b96955b3e456a648d10d745e831b4b"
  },
  "changedPaths": {
    "all": [
      "docs/protocol.md"
    ],
    "required": [
      "docs/protocol.md"
    ],
    "uncovered": [
      "docs/protocol.md"
    ]
  },
  "claims": [],
  "violations": [
    {
      "code": "uncovered-change",
      "path": "docs/protocol.md",
      "message": "Changed path has no material claim: docs/protocol.md."
    }
  ],
  "message": "Gate failed with 1 violation(s). Evidence locators verify committed content, not semantic correctness."
}
```

## Phase B: pass

```bash
gitpin gate --base 43439f836e8f7ac27e5f41587caba435b758a4cc --head 57bce1a312f6153e171b515c41727ff81e77fb3c
```

```json
{
  "repository": "task-2-synthetic-pr-fixture",
  "path": "docs/protocol.md",
  "lineStart": 5,
  "lineEnd": 5,
  "sha": "57bce1a312f6153e171b515c41727ff81e77fb3c",
  "contentSha256": "2ad449fd22a840f9bb138b299ba4ac247379a14a4dce6825eb84ed692d80938a",
  "citation": "task-2-synthetic-pr-fixture/docs/protocol.md:5 @ 57bce1a312f6153e171b515c41727ff81e77fb3c",
  "handle": "gitpin:task-2-synthetic-pr-fixture@57bce1a312f6153e171b515c41727ff81e77fb3c:docs/protocol.md:5"
}
```

```text
{
  "kind": "gitpin-gate-report",
  "schemaVersion": 1,
  "status": "ok",
  "reportId": "0b110adc6f090039",
  "repository": "task-2-synthetic-pr-fixture",
  "baseSha": "43439f836e8f7ac27e5f41587caba435b758a4cc",
  "headSha": "57bce1a312f6153e171b515c41727ff81e77fb3c",
  "mergeBaseSha": "43439f836e8f7ac27e5f41587caba435b758a4cc",
  "policy": {
    "path": ".gitpin/gate.yml",
    "sha256": "672e3e648ae68b3f473fce90147b9f6ba5c1c21fba68b88e199f1d352b21e2ae"
  },
  "manifest": {
    "path": ".gitpin/change-evidence.json",
    "sha256": "225f0498847a42f37b45cc8af2aefd7ca8310ce341c03045c22286c87c52bfa2"
  },
  "changedPaths": {
    "all": [
      ".gitpin/change-evidence.json",
      "docs/protocol.md"
    ],
    "required": [
      "docs/protocol.md"
    ],
    "uncovered": []
  },
  "claims": [
    {
      "id": "TASK-2-PASS",
      "statement": "Synthetic PR gate pass fixture locator for deterministic evidence review.",
      "covers": [
        "docs/protocol.md"
      ],
      "evidence": [
        {
          "ref": "head",
          "path": "docs/protocol.md",
          "lineStart": 5,
          "lineEnd": 5,
          "expectedContentSha256": "2ad449fd22a840f9bb138b299ba4ac247379a14a4dce6825eb84ed692d80938a",
          "actualContentSha256": "2ad449fd22a840f9bb138b299ba4ac247379a14a4dce6825eb84ed692d80938a",
          "status": "verified",
          "citation": "task-2-synthetic-pr-fixture/docs/protocol.md:5 @ 57bce1a312f6153e171b515c41727ff81e77fb3c",
          "handle": "gitpin:task-2-synthetic-pr-fixture@57bce1a312f6153e171b515c41727ff81e77fb3c:docs/protocol.md:5"
        }
      ],
      "status": "evidence-verified"
    }
  ],
  "violations": [],
  "message": "Checked 1 claim manifest entry and verified their evidence locators for 1 changed path(s) at 57bce1a312f6153e171b515c41727ff81e77fb3c."
}
```

## Reduced-motion / static fallback

- For reduced-motion readers: read the two command/output blocks directly above.
- For tooling checks: consume `pr-gate-fail-to-pass.artifact.json` and validate fields:
  - `failCase.status === 1`
  - `passCase.status === 0`
  - `passCase.coverage.sha === "57bce1a312f6153e171b515c41727ff81e77fb3c"`
  - `passCase.coverage.lineStart` and `passCase.coverage.lineEnd` are both `5`
  - `passCase.coverage.path === "docs/protocol.md"`
  - `fixture.head` and `fixture.base` are full 40-char SHAs.
