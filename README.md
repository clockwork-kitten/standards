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
- **A shared lefthook base** (`lefthook/base.yml`) repos pin as a pre-commit backstop that runs
  the conform engine on staged files.
- **Repo-hygiene rules** — required files exist and are non-trivial (`README`, roadmap/ideas
  where relevant, `LICENSE`), plus the expected directory shape.

## How a repo consumes it

Reference a reusable workflow from a consuming repo, pinned to a tag:

```yaml
# .github/workflows/conformance.yml in a consuming repo
name: conformance

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  markdown:
    uses: clockwork-kitten/standards/.github/workflows/markdown-conformance.yml@v0.3.0

  hygiene:
    uses: clockwork-kitten/standards/.github/workflows/repo-hygiene.yml@v0.3.0
```

Both are `workflow_call` reusable workflows with safe defaults you can override via
`with:` — e.g. `markdown-conformance` takes `paths`, `config`, `reference-check`,
`reference-ignore`, and `llms-check`; `repo-hygiene` takes a `required-files` list
(default `README.md LICENSE`). By default `markdown-conformance` runs the conform engine
(`@clockwork-kitten/conform`) against the studio markdownlint baseline shipped in this
repo — markdown lint plus the internal cross-reference check in one pass — so there is no
per-repo config drift; point `config` at a `conform.config.*` to adjust individual rules.
The engine is automatically locked to the exact `standards` commit you pin the workflow at,
so the workflow and the engine it runs can never drift — you never set an engine ref.

Consumers **pin to a tag** and upgrade deliberately (propagation vs stability). Pin to an exact
version (`@v0.3.0`) for maximum stability, or to a moving line alias (`@v0.3`) to pick up patches
automatically. See `docs/RELEASING.md` for the versioning and release policy, and `ROADMAP.md` for
the roadmap.

### Pre-commit backstop (lefthook)

Repos also pin the shared lefthook base so a commit-time hook runs the same conform checks CI
does. `conform` is the brain; lefthook is only the trigger. In your repo's `lefthook.yml`:

```yaml
# lefthook.yml in a consuming repo
remotes:
  - git_url: https://github.com/clockwork-kitten/standards
    ref: v0.4.0
    configs:
      - lefthook/base.yml
```

Add `@clockwork-kitten/conform` (pinned to the same tag) so `bunx conform` resolves locally, then
`bunx lefthook install`. Pre-commit autofixes staged Markdown, re-stages it, and fails on any
residual drift. This is **authoring-time only** — `fix` runs locally and in the hook, never in CI.
The hook is a backstop behind the agent, which is expected to run `conform` in its own loop (see
`AGENTS.md`).

## Status

**v0.2 in progress** — the markdown-conformance track now runs through the conform engine
(`packages/conform`). v0.1 (reusable markdown-conformance + repo-hygiene) is released.
`clockwork-kitten/ops` is the pilot adopter. See `ROADMAP.md`.

## Relationships

- **`clockwork-kitten/bedrock`** (JS/TS semantic normalizer) is a *check the code track invokes*,
  not this home.
- The **galleycat** provisioner (template + per-repo CI) is a *consumer*; client/site repos
  inherit the standard through the template. One CI story, not two.
