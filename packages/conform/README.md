# @clockwork-kitten/conform

The studio conformance engine — one CLI that comes in and checks a repo against the
`clockwork-kitten` standards. It lints Markdown, validates internal cross-references, and generates
an `llms.txt` doc index; code checks land in later slices (see the repo `ROADMAP.md`).

TS/Bun on `mdast` — the reference checker and the `llms.txt` generator walk a shared GFM parse, so
structural checks agree on document structure. Lives in the `standards` repo for now and is
structured for later extraction into its own branded repo.

## Install (within this workspace)

This package is a Bun workspace member. From the repo root:

```sh
bun install
```

## Usage

```sh
# Lint markdown and check internal cross-references in one pass.
conform check

# Restrict to specific globs.
conform check "docs/**/*.md" "README.md"

# Point at an explicit config file.
conform check --config ./conform.config.ts

# Skip the reference check, or add cross-repo ignore substrings.
conform check --no-references
conform check --reference-ignore "ops/docs/"

# Generate the llms.txt doc index (writes the file)...
conform llms
# ...or verify the committed index is up to date (CI drift gate).
conform llms --check
```

`conform check` exits non-zero when any file is non-conformant or a reference is broken, and
`conform llms --check` exits non-zero on drift, so both drop straight into CI.

## Configuration

Config is resolved in this order, and the first match wins:

1. an explicit `--config <path>`
2. `conform.config.ts` (preferred) or `conform.config.jsonc` in the repo root
3. the bundled studio baseline

A repo config **deep-merges** its `markdownlint` block over the studio baseline, so you can adjust
one rule without re-declaring the whole thing. Set `extends: false` to ignore the baseline entirely.
`references` and `llms` are per-repo settings the engine reads from the same resolved config.

```ts
// conform.config.ts
import { defineConfig } from "@clockwork-kitten/conform";

export default defineConfig({
  markdownlint: {
    MD013: { line_length: 120 },
  },
  references: {
    // Backtick paths containing any of these are treated as external (another repo).
    ignore: ["ops/docs/"],
  },
  llms: {
    project: "My Project",
    summary: "One-line summary rendered as the blockquote.",
    // A doc joins the first section whose path prefix it matches.
    sections: [
      { title: "Top level", prefix: "", shallow: true },
      { title: "Docs", prefix: "docs/" },
    ],
  },
});
```

The linter, the reference checker, and the `llms.txt` generator read the **same** resolved config
object and the same pinned parser, so a precondition can never drift from its postcondition.

## Scripts

```sh
bun run test       # vitest with coverage (80% gate)
bun run typecheck  # tsc --noEmit
```
