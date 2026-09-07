# Clockwork Kitten — standards

The studio's machine-checkable engineering standards and reusable CI. This repo is the single
source of truth for **how every `clockwork-kitten` repo is kept consistent** — the enforcement
backbone of the studio invariant: **AI proposes freely, a machine-checkable standard constrains
*how*, a human still merges.**

Rationale and the full decision live in the `ops` repo: **CK-004** in `docs/DECISIONS.md`.

## What this repo publishes

- **Reusable CI workflows** that repos call from their own CI via `uses:` — e.g.
  `markdown-conformance`, `repo-hygiene`, and (later) `code-conformance`.
- **Versioned shared configs** — the studio markdownlint, ESLint + Prettier + knip + TypeScript,
  and (later) Astro rulesets — pinned and referenced so there is no per-repo drift.
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

### Shared code configs

The studio's ESLint, Prettier, knip, and TypeScript bases ship inside `@clockwork-kitten/conform`
and are referenced by the same pinned package consumers already install — so the toolchain
propagates like the workflows do, with no per-repo drift. They are deliberately **thin**: Prettier
owns formatting and `clockwork-kitten/bedrock` owns semantic normalization, so this layer only adds
framework-agnostic correctness, deterministic ordering (imports, exports, object keys, types), the
"one canonical way" rules (`undefined` over `null`, `is`/`has` boolean names, `.toSorted()` over
`.sort()`), security, dependency hygiene, and dead-code detection. Markdown stays owned by `conform`
— keep Prettier off it (see `.prettierignore`).

```js
// eslint.config.js
import base from "@clockwork-kitten/conform/configs/eslint.base";
export default [...base, { rules: { /* repo overrides */ } }];
```

Site/client repos add the **Astro overlay** on top of the base — `eslint-plugin-astro` plus the
accessibility rules, self-scoped to `*.astro`. Formatting is owned by `prettier-plugin-astro`
(`configs/prettier.astro.json`) and `.astro` type-checking is `astro check`'s job in CI:

```js
// eslint.config.js (an Astro site/client repo)
import base from "@clockwork-kitten/conform/configs/eslint.base";
import astro from "@clockwork-kitten/conform/configs/eslint.astro";
export default [...base, ...astro];
```

```jsonc
// package.json — the Astro-aware Prettier config swaps in for the base
{ "prettier": "@clockwork-kitten/conform/configs/prettier.astro.json" }
```

```jsonc
// tsconfig.json
{ "extends": "@clockwork-kitten/conform/configs/tsconfig.base.json" }
```

```jsonc
// package.json — Prettier resolves a shared config by module specifier
{ "prettier": "@clockwork-kitten/conform/configs/prettier.base.json" }
```

```ts
// knip.ts — knip has no `extends`, so import and spread the base
import base from "@clockwork-kitten/conform/configs/knip.base.json" with { type: "json" };
export default { ...base, workspaces: { /* ... */ } };
```

`conform check` and `conform fix` drive these tools directly: add a `code` block to your
`conform.config.*` to opt in, and one `conform check` runs ESLint, Prettier (`--check`), knip, and
`tsc --noEmit` alongside the markdown track — while `conform fix` runs the ESLint/Prettier
autofixers (knip and `tsc` are check-only gates). The pinned toolchain ships as engine
dependencies, so pinning `@clockwork-kitten/conform` gets the whole code stack — no separate
installs. `fix` is authoring-time only (local, agent loop, pre-commit); CI runs `check` and fails on
drift, never auto-fixing.

```ts
// conform.config.ts — every tool defaults on; set a flag false to skip it
import { defineConfig } from "@clockwork-kitten/conform";
export default defineConfig({
  code: {
    // tsconfig: "tsconfig.json",  // point at your typecheck project
    // knip: false,                // e.g. skip a tool
  },
});
```

## Status

**v0.2 in progress** — the markdown-conformance track now runs through the conform engine
(`packages/conform`). v0.1 (reusable markdown-conformance + repo-hygiene) is released.
`clockwork-kitten/ops` is the pilot adopter. See `ROADMAP.md`.

## Relationships

- **`clockwork-kitten/bedrock`** (JS/TS semantic normalizer) is a *check the code track invokes*,
  not this home.
- The **galleycat** provisioner (template + per-repo CI) is a *consumer*; client/site repos
  inherit the standard through the template. One CI story, not two.
