# @clockwork-kitten/conform

The studio conformance engine — one CLI that comes in and checks a repo against the
`clockwork-kitten` standards. This slice ships markdown linting; structural document operations and
code checks land in later slices (see the repo `ROADMAP.md`).

TS/Bun on `mdast` (mdast arrives with the structural operations). Lives in the `standards` repo for
now and is structured for later extraction into its own branded repo.

## Install (within this workspace)

This package is a Bun workspace member. From the repo root:

```sh
bun install
```

## Usage

```sh
# Lint every markdown file in the repo against the resolved config.
conform check

# Restrict to specific globs.
conform check "docs/**/*.md" "README.md"

# Point at an explicit config file.
conform check --config ./conform.config.ts
```

`conform check` exits non-zero when any file is non-conformant, so it drops straight into CI.

## Configuration

Config is resolved in this order, and the first match wins:

1. an explicit `--config <path>`
2. `conform.config.ts` (preferred) or `conform.config.jsonc` in the repo root
3. the bundled studio baseline

A repo config **deep-merges** over the studio baseline, so you can adjust one rule without
re-declaring the whole thing. Set `extends: false` to ignore the baseline entirely.

```ts
// conform.config.ts
import { defineConfig } from "@clockwork-kitten/conform";

export default defineConfig({
  markdownlint: {
    MD013: { line_length: 120 },
  },
});
```

The linter and the (future) structural operations read the **same** resolved config object and the
same pinned parser, so a precondition can never drift from its postcondition.

## Scripts

```sh
bun run test       # vitest with coverage (80% gate)
bun run typecheck  # tsc --noEmit
```
