# Roadmap — standards

The sequenced plan for the studio standards home. Status: ☐ todo · ◐ in progress · ☑ done ·
⏸ deferred. Order is about **dependencies**, not urgency.

Rationale: **CK-004** in the `ops` repo's `docs/DECISIONS.md`. Ideas not yet scheduled live in
`IDEAS.md`.

## Two conformance surfaces, one orchestrator

`conform` is the studio's conformance **orchestrator**: one CLI + one config that runs every
conformance tool in a single pass, the way it already runs ESLint, Prettier, knip, `tsc`, and
`bedrock`. It spans two surfaces:

- **Documentation-repo conformance & operations** — markdown lint (v0.1–v0.2), structural document
  operations (v0.3: reference integrity + `llms.txt`), authoring ergonomics (v0.4), and schema-aware
  entry operations + cross-repo intake (v0.7, built in `canon`). The differentiated value is the
  structural operations over one shared parse, not the linting. **This surface is being extracted
  into its own repo, `canon` (v0.6)** — a standalone, independently-consumable doc-conformance tool
  with its own pinned parser, config, CLI, and release line, so any documentation repo can adopt it
  without the code track. `conform` then invokes `canon` as just another tool.
- **Code conformance** — the studio lint/format/typecheck/dead-code baseline and `bedrock` (v0.5),
  which `conform` runs as external tools.

Naming: **`conform`** (orchestrator) runs **`canon`** (docs) and **`bedrock`** (code semantics) as
sibling tools. `conform` stays in this repo for now; `standards` is expected to narrow to *being* the
`conform` repo over time. Record the extraction + naming as a **CK-0NN** decision in the `ops` repo's
`docs/DECISIONS.md`.

## v0.1 — Markdown conformance + repo-hygiene core

The Markdown track is a lift-and-generalize of the `ops` repo's already-working
`.github/workflows/docs.yml` + `scripts/check_links.py` + `scripts/gen_llms_txt.py`. `ops` is the
pilot adopter.

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| 1 | Repo skeleton: `README`, `ROADMAP`, `IDEAS`, `LICENSE`, markdownlint config | ☑ | Dogfoods the hygiene rules it will enforce |
| 2 | `markdown-conformance.yml` reusable workflow (`workflow_call`) | ☑ | markdownlint + internal-reference check; inputs for config/paths |
| 3 | Generalize the reference checker so any repo can call it | ☑ | `scripts/check_references.py`; roots/globs configurable |
| 4 | `repo-hygiene.yml` reusable workflow | ☑ | Assert required files exist and are non-trivial; configurable required-file list |
| 5 | Shared, versioned markdownlint config consumers can reference | ☑ | Pinnable; mirrors the studio standard (CK-003) |
| 6 | Tag `v0.1.0`; document the `uses: …@v0.1.0` consume path | ☑ | Tag + GitHub Release cut from green `main`; consume path in `README.md` |
| 7 | Pilot adoption in `ops`: replace local `docs.yml` with `uses:` this repo | ☑ | Proves the end-to-end consume path (ops PR #4) |

## v0.2 — Conform engine (markdown-lint slice)

The v0.1 tracks are shell/Python jobs wired straight into reusable workflows. v0.2 begins folding
them into a single distributable **conform engine** — one CLI that comes in and tests everything —
so markdown lint, structural document operations, hygiene, and (later) code checks share one parser
and one config instead of drifting apart. TS/Bun on `mdast`. It lives at `packages/conform/` in this
repo now; the documentation surface is extracted into its own repo (`canon`) at v0.6.

**Design (locked):**

- **One engine, invoked many ways.** `conform check` auto-detects files and runs the checks; each
  check is also individually runnable so CI can still parallelize jobs. The reusable workflows become
  thin wrappers that invoke the engine.
- **One config, shared by lint and ops.** Resolution order: `--config` flag → `conform.config.ts`
  (preferred) or `conform.config.jsonc` in the repo root → the bundled studio baseline. Repo config
  **deep-merges** over the baseline; `extends: false` opts out entirely. The linter and the
  structural operations read the *same* config object and the *same* pinned `mdast`/GFM parser, so a
  precondition can't drift from its postcondition.
- **Guardrails.** Positional byte-range splices (never a whole-file `parse → stringify` that
  reformats everything); idempotency tested (apply twice, diff must be empty); document IDs
  immutable, monotonic, and never reused.

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| 1 | Engine skeleton at `packages/conform/` (`@clockwork-kitten/conform`, `bin: conform`) | ☑ | TS/Bun; config discovery + deep-merge; markdownlint runner (mdast structural ops land in v0.3) |
| 2 | `conform check` runs markdown lint against the studio baseline | ☑ | Replaced the shell `markdown` job in `ci.yml`; `standards` dogfoods it |
| 3 | `markdown-conformance.yml` invokes the engine | ☑ | Reusable workflow checks out the engine at `standards-ref` and runs `conform check`; consume path unchanged for callers |

## v0.3 — Structural document operations

The engine folds the studio's remaining bespoke doc scripts into one TS/Bun/`mdast`
implementation, retiring per-repo Python. Two capabilities, both structural document
operations over a shared parse: **reference integrity** (unifying `standards`'
`check_references.py` and `ops`' `check_links.py`) and **generated doc indexes**
(`llms.txt`) with typed per-repo config and drift checking. Prior-art scan in
`docs/research/markdown-structural-tooling-prior-art.md`.

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| 1 | `conform check` validates cross-references on `mdast` | ☑ | Clickable `](x.md)` links + backtick root-relative `.md` paths; `ignore` substrings in config; walks real `link`/`inlineCode` nodes instead of regex |
| 2 | Retire both Python reference checkers | ☑ | `standards/scripts/check_references.py` removed and `markdown-conformance.yml` runs the engine check; `ops/scripts/check_links.py` retired in ops PR #5 |
| 3 | `conform llms` generates the `llms.txt` index; `--check` fails on drift | ☑ | First engine op that *writes*; idempotent (apply-twice = empty diff); `standards` dogfoods its own index |
| 4 | Typed `llms` config in `conform.config.ts` (project, summary, sections) | ☑ | Proves the config carries non-markdownlint, per-repo settings — one config, shared by lint and ops; sections match by path prefix |
| 5 | Adopt `llms` generation in `ops`; retire `gen_llms_txt.py` | ☑ | `ops` is now Python-free (ops PRs #5/#6); `llms-check` enabled, riding the `@v0.3` alias |

## v0.4 — Authoring ergonomics

The AI-native analog of "lint/format on save": a deterministic autofix the author (usually an agent)
runs *while proposing*, plus a commit-time backstop — not editor/LSP integration, which is
deliberately out of scope while authoring is AI-primary. `fix` is authoring-time only; CI still only
ever runs `check` and fails on drift (auto-committing fixes would fight the human-merge gate).

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| 1 | `conform fix` autofixes fixable markdown rules | ☑ | Write-side sibling of `check`; uses markdownlint `applyFixes` via `fixInfo`, same resolved config + shared parser; re-lints the fixed content to report the unfixable residue; exits 0 (`check` stays the failing gate) |
| 2 | `conform fix` also regenerates `llms.txt` | ☑ | One command self-heals the tree; reuses the injectable `generateLlms`; `--no-llms` opts out |
| 3 | lefthook shared base consumers extend/pin | ☑ | `lefthook/base.yml` pinned via lefthook `remotes:` (propagates like the reusable workflows); pre-commit runs `conform fix --no-llms` on staged markdown (re-staged) then `conform check`; `conform` is the brain, lefthook the trigger; also serves the code track |
| 4 | `AGENTS.md` guidance: run `conform` in-loop | ☑ | Agents run `conform fix`/`check` while proposing; the hook is a backstop an agent may bypass (`--no-verify`, the API); records the CI-never-fixes boundary |

## v0.5 — Code conformance track

Code checks join the same engine rather than a parallel toolchain: `conform check` invokes the
studio linter/formatter and `clockwork-kitten/bedrock` the way it runs the markdown checks, and
`conform fix` drives their autofixers (`eslint --fix`, `prettier --write`, `bedrock --fix`) the way
it drives markdownlint's.

The studio toolchain is **ESLint (thin, flat config) + Prettier + knip + `tsc`** — the stack the
`code-standards` skill already mandates. It is deliberately **thin** because `bedrock` normalizes the
semantic core (`var`→`const`, `==`→`===`, arrow→function, `.push`→spread, …); the residual lint
surface is framework-aware rules (Svelte a11y/reactivity, Astro), import ordering (`perfectionist`),
security, and dead code (`knip`). **Not Biome:** it cannot parse `.svelte`/`.astro` to the needed
depth, and `conform` already provides the single-command UX Biome is bought for, so its one win is
redundant here while its cost (dropping the UI/site repos) is fatal. Revisit only if the studio drops
Svelte/Astro or Biome ships first-class Svelte support — a trigger to record as a `CK-0NN` decision in
the `ops` repo's `docs/DECISIONS.md`.

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| 1 | Studio ESLint (flat) + Prettier + knip + `tsconfig` base configs (pinned, referenceable) | ☑ | Shipped from `@clockwork-kitten/conform/configs/*` (imported/extended, pinned by the same tag consumers already use); thin because `bedrock` covers the semantic core; dogfooded on the engine itself |
| 2 | Engine runs the lint + format + typecheck + dead-code baseline | ☑ | `conform check` runs `eslint` + `prettier --check` + `knip` + `tsc --noEmit`; `conform fix` runs the `eslint`/`prettier` autofixers (knip/tsc are check-only gates). Opt in with a `code` block in `conform.config.*`; the pinned toolchain ships as `@clockwork-kitten/conform` deps. `fix` stays authoring-time — CI only runs `check` |
| 3 | Invoke `clockwork-kitten/bedrock` as a check | ◐ | Engine wiring landed: bedrock is a code-track tool (`conform check` → `bedrock --report`, `conform fix` → `bedrock --fix`), opt in with `code.bedrock` (`true` scopes to `src`, or pass globs). **Off by default** and not yet dogfooded because bedrock isn't installable — not on npm (the npm `bedrock` is unrelated), no release tag, `dist/` gitignored with no `prepare` script. **Activation** (bundle the dep, default on, and remove the interim ESLint rules `no-var`/`prefer-const`/`eqeqeq`/`prefer-arrow-callback`) follows once bedrock ships a consumable artifact |
| 4 | Opinionated Astro ruleset for site/client repos | ☑ | Shipped as `@clockwork-kitten/conform/configs/eslint.astro` (`eslint-plugin-astro` `recommended` + `jsx-a11y`, self-scoped to `*.astro`, layered after the base) + `configs/prettier.astro.json` (`prettier-plugin-astro`). Reuse baseline — house-policy structural rules are a follow-up. Dogfooded via `.astro` fixtures + an ESLint-API test (no Astro sources here). `astro check` stays a consumer-CI type gate |

## v0.6 — Extract `canon` (doc-conformance tool)

The documentation surface is complete enough to stand on its own, and its signature features (entry
operations, cross-repo intake) are exactly what make it an independent product — so it moves into its
own repo now rather than being built inside this governance/orchestration container. `canon` owns the
pinned mdast/GFM parser and every doc-structural operation in-process (keeping the v0.2 one-parser,
one-config guarantee *inside* canon); `conform` invokes it as one opaque tool, like ESLint or
`bedrock`. Any pure-documentation repo (e.g. `ops`) can adopt `canon` alone. Prior art for the
schema-driven-docs model: Astro Content Collections / Contentlayer (schema-validated frontmatter),
Vale and remark-lint (prose/structural linting); the opinionated default-schema posture is the "paved
road" / convention-over-configuration pattern.

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| 1 | Create `clockwork-kitten/canon`; move the doc surface | ☐ | `lint/{markdown,references,parse}`, `ops/llms`, the markdownlint base config, the doc config types (`markdownlint`/`references`/`llms`), and the doc skills; preserve history where feasible |
| 2 | Give `canon` its own config, CLI, CI, and release line | ☐ | `canon.config.*`; `canon check`/`fix`/`llms`; dogfood on itself; cut `canon@v0.1.0`. Ships opinionated studio-default schemas but accepts custom ones |
| 3 | Slim `conform` to orchestrate `canon` | ☐ | Drop the in-process doc surface; add a `canon` tool runner (bundled like eslint/bedrock); `conform check`/`fix` runs canon + code tools; reusable `markdown-conformance.yml` runs canon; major bump for the CLI-surface change |
| 4 | Re-pin `ops` to consume `canon` directly | ☐ | ops only ever needed docs — proves the independent-adoption model end to end |

## v0.7 — Schema-aware entry operations + cross-repo intake (in `canon`)

Built in the new `canon` repo, not here (listed for continuity; tracked on `canon`'s own roadmap once
it exists). Typed, schema-aware entry operations agents call instead of splicing prose — the doc
tool's original structural contribution — plus a standardized way to propose a schema-valid entry
into *another* repo, gated behind the checks that guarantee the invariants.

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| 1 | Per-document schemas in `canon.config` (`ideas`, `decisions`, `roadmap`) | ☐ | The same config the linter consumes; shape = `## I-NNN`, monotonic IDs, one separator |
| 2 | `entry delete` / `add` / `move` / `renumber` positional splices | ☐ | Re-lint against the same schema as postcondition |
| 3 | Cross-repo intake: producer (`entry add --repo`) + receiver (`entry-intake.yml`) | ☐ | Opens a PR, never direct-commits — preserves the human-merge gate |
| 4 | Surface decision: a CLI and/or an MCP tool for agents | ☐ | Answers the idea's open question |

## Release & versioning

- Consuming repos reference reusable workflows and configs **pinned to a tag** (`@v0.1.0`) and
  upgrade deliberately.
- Semantic-ish tags; breaking changes to a workflow's inputs, a config's rules, or the engine's CLI
  bump the major.
- **`v0.1.0` through `v0.5.0` are cut** (tag + GitHub Release). Releases are automated by the `release`
  workflow (`workflow_dispatch`): it validates the version, verifies `ci` is green, tags, publishes
  the Release, and force-moves a major-line alias (`v0.5` → `v0.5.0`) so consumers can pin to a line
  and still get patches. The reusable workflow locks the engine to the exact commit it's pinned at
  (`github.job_workflow_sha`), so the engine and workflow never drift. Full policy in `docs/RELEASING.md`.

## Open items

- **License choice at extraction.** Currently `LICENSE` is MIT. Reconsider **Apache-2.0** (patent
  grant) for `canon` (and later `conform`) when extracted/commercialized — see the `ops` repo's
  `docs/oss-policy.md`. Set this at the point each repo is spun out.
- **Public vs private.** **Now public** — private consumers (e.g. `ops`) must be able to fetch the
  reusable workflows and the engine, which a private home blocked. Revisit only if a future home
  needs to hold non-public material.
- **Record the engine architecture as a decision.** The consolidation to one TS/Bun/`mdast` engine
  with `standards` as thin orchestration is a notable direction worth a `CK-NNN` entry in the `ops`
  repo's `docs/DECISIONS.md`, alongside CK-004.
