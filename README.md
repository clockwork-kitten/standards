# Clockwork Kitten — standards

The studio's machine-checkable engineering standards and reusable CI. This repo is the single
source of truth for **how every `clockwork-kitten` repo is kept consistent** — the enforcement
backbone of the studio invariant: **AI proposes freely, a machine-checkable standard constrains
*how*, a human still merges.**

Rationale and the full decision live in the `ops` repo: **CK-004** in `docs/DECISIONS.md`.

## What this repo publishes

- **Reusable CI workflows** that repos call from their own CI via `uses:` — e.g.
  `markdown-conformance`, `repo-hygiene`, and (later) `code-conformance`.
- **Versioned shared configs** — the studio markdownlint, Biome/TypeScript, and (later) Astro
  rulesets — pinned and referenced so there is no per-repo drift.
- **Repo-hygiene rules** — required files exist and are non-trivial (`README`, roadmap/ideas
  where relevant, `LICENSE`), plus the expected directory shape.

## How a repo consumes it

Reference a reusable workflow from a consuming repo, pinned to a tag:

```yaml
# .github/workflows/conformance.yml in a consuming repo
jobs:
  markdown:
    uses: clockwork-kitten/standards/.github/workflows/markdown-conformance.yml@v0.1.0
```

Consumers **pin to a tag** and upgrade deliberately (propagation vs stability). See `ROADMAP.md`
for the release/versioning story.

## Status

**v0.1 in progress** — Markdown-conformance track + repo-hygiene core. `clockwork-kitten/ops`
is the pilot adopter. See `ROADMAP.md`.

## Relationships

- **`clockwork-kitten/bedrock`** (JS/TS semantic normalizer) is a *check the code track invokes*,
  not this home.
- The **galleycat** provisioner (template + per-repo CI) is a *consumer*; client/site repos
  inherit the standard through the template. One CI story, not two.
