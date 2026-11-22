# @clockwork-kitten/conform

The studio conformance orchestrator — one CLI that coordinates the documentation track owned by
`@clockwork-kitten/canon` with the code track bundled here (ESLint, Prettier, knip, TypeScript, and
optional bedrock).

Canon owns Markdown linting, internal cross-references, and `llms.txt` generation with its own
pinned parser and `canon.config.*`. Conform keeps the repo-facing `check` / `fix` entrypoint thin:
run canon first, then run the code tools when `conform.config.*` declares a `code` block.

## Install (within this workspace)

This package is a Bun workspace member. From the repo root:

```sh
bun install
```

During Phase C, canon is consumed from a source checkout rather than a registry package. Make the
specifier resolvable before running conform:

```sh
mkdir -p node_modules/@clockwork-kitten
ln -sfn /path/to/canon node_modules/@clockwork-kitten/canon
```

## Usage

```sh
# Run canon docs checks, then the code track when configured.
conform check

# Restrict the docs track to specific globs (passed through to canon).
conform check "docs/**/*.md" "README.md"

# Point at an explicit conform config for the code track.
# Canon discovers canon.config.* separately.
conform check --config ./conform.config.ts

# Forward reference options to canon.
conform check --no-references
conform check --reference-ignore "ops/docs/"

# Run canon docs fixes, then code autofixers when configured.
conform fix
conform fix --no-llms
```

`conform check` exits non-zero when canon or any code gate fails. `conform fix` is authoring-time and
returns non-zero only for argument/config errors; canon reports any doc residue.

Canon owns the `llms` subcommand directly:

```sh
bun run canon llms
bun run canon llms --check
```

## Configuration

Config is resolved in this order, and the first match wins:

1. an explicit `--config <path>`
2. `conform.config.ts` (preferred) or `conform.config.jsonc` in the repo root
3. no conform config, which means docs-only orchestration (canon still auto-discovers
   `canon.config.*`)

A conform config now contains only the optional code track:

```ts
// conform.config.ts
import { defineConfig } from "@clockwork-kitten/conform";

export default defineConfig({
  code: {
    tsconfig: "packages/conform/tsconfig.json",
    // knip: false,
    // bedrock: true,
  },
});
```

Put documentation settings in canon:

```ts
// canon.config.ts
import { defineConfig } from "@clockwork-kitten/canon";

export default defineConfig({
  references: { ignore: ["ops/docs/"] },
  llms: {
    project: "My Project",
    summary: "One-line summary rendered as the blockquote.",
    sections: [{ title: "Docs", prefix: "docs/" }],
  },
});
```

## Scripts

```sh
bun run test       # vitest with coverage (80% gate)
bun run typecheck  # tsc --noEmit
```

## Legacy pre-split inventory (T0 diagnostic artifact)

This package now ships a machine-readable inventory of the pre-split Conform surface in
`packages/conform/inventory/`:

- `legacy-conform.json` — commands, flags, exports, defaults, adapters, configs, workflows,
  consumers, and open/stale adoption PR evidence.
- `legacy-conform.schema.json` — schema for the inventory format.
- `completeness.json` — reproducible evidence manifest (tree/CLI/export/fixture/search/version probes).

The inventory is **diagnostic only** for migration planning. It is not a compatibility layer and does
not introduce command aliases, rule-ID aliases, suppression aliases, or any compatibility window.

## Pre-split behavior characterization (T0 evidence)

Reproducible normalized goldens for the P01 inventory live in
`packages/conform/characterization/goldens/`. They cover the shipped ESLint, Prettier, TypeScript,
and Knip configurations; configuration resolution; docs/code and code-tool ordering; command exits;
and candidate static/executing classifications.

Each golden cites the applicable record IDs and source revision from
`inventory/legacy-conform.json`. Intentional differences cite their P01 records without copying the
migration disposition, so the goldens are drift evidence rather than a duplicate authority.
Static/executing labels are candidates for extraction planning, not a stable profile contract.
`characterization/denominator.json` declares the exact P02 golden filenames and P01 citation
coverage. It also pins the legacy source hashes and dependency versions that generation verifies
before producing artifacts, so current-checkout behavior cannot be relabeled as legacy evidence.

Regenerate the artifacts after an intentional pre-split behavior change:

```sh
bun run --cwd packages/conform characterize:update
```

The characterization test rebuilds every golden in memory and fails on normalized drift. This
evidence remains diagnostic only: it adds no git/path dependency, command or rule alias,
suppression alias, compatibility mode, or cross-repository implementation.
