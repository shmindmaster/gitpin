# Governance

GitPin is an MIT-licensed public project maintained by Sarosh Hussain. Technical direction is currently maintainer-led because the contributor base is small. Pendoah is the operating context, not a separate authority over repository decisions.

## Decision process

- Bugs and feature proposals start in a public GitHub issue unless they contain an undisclosed vulnerability.
- Decisions are evaluated against the read-only, Git-only, commit-pinned architecture and the public roadmap.
- Changes to tool names, evidence schemas, exposure policy, transports, or release behavior require a focused pull request, tests, and updated documentation.
- The maintainer records material decisions in the issue or pull request that implements them. A merged change is the decision record; an unmerged proposal is not policy.

## Contributions and review

Contributors follow [CONTRIBUTING.md](CONTRIBUTING.md) and the Code of Conduct. Pull requests must explain the user problem, provenance and security impact, validation performed, and whether behavior or only documentation changes.

The maintainer may decline work that introduces repository writes, hidden network retrieval, databases or embeddings, weakens sensitive-path controls, exposes dirty worktrees, or turns evidence locators into claims of semantic correctness. Those constraints can change only through an explicit public proposal with migration and security analysis.

## Security decisions

Undisclosed vulnerabilities use the private process in [SECURITY.md](SECURITY.md). The maintainer coordinates remediation and disclosure. Security fixes may be released before a full public discussion when early disclosure would put users at risk.

## Releases and funding

Releases are cut from `main` through the documented validation and trusted-publishing workflow. Historical artifacts remain immutable.

Funding may support roadmap work, maintenance, independent review, or public validation, but does not buy a favorable technical conclusion or private control of the project. Material grants, restricted uses, and overlapping funded work will be disclosed in the relevant public issue or project update. Awarded, received, and spent funds are separate states.

## Evolution

If sustained independent contribution develops, governance can expand to named reviewers or a maintainer group through a public proposal. Until then, this document states the current single-maintainer reality rather than implying a community structure that does not exist.
