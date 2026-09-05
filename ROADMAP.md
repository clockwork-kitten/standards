# Roadmap — standards

The sequenced plan for the studio standards home. Status: ☐ todo · ◐ in progress · ☑ done ·
⏸ deferred. Order is about **dependencies**, not urgency.

Rationale: **CK-004** in the `ops` repo's `docs/DECISIONS.md`. Ideas not yet scheduled live in
`IDEAS.md`.

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
| 7 | Pilot adoption in `ops`: replace local `docs.yml` with `uses:` this repo | ☐ | Proves the end-to-end consume path |

## v0.2 — Conform engine (markdown-lint slice)

The v0.1 tracks are shell/Python jobs wired straight into reusable workflows. v0.2 begins folding
them into a single distributable **conform engine** — one CLI that comes in and tests everything —
so markdown lint, structural document operations, hygiene, and (later) code checks share one parser
and one config instead of drifting apart. TS/Bun on `mdast`. It lives at `packages/conform/` in this
repo now, structured for later extraction into its own branded repo (see `IDEAS.md`).

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

Promoted from `IDEAS.md`; prior-art scan in `docs/research/markdown-structural-tooling-prior-art.md`.
Typed, schema-aware entry operations agents call instead of splicing prose — the engine's original
contribution, gated behind the v0.2 lint that guarantees the invariants.

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| 1 | Per-document schemas in `conform.config` (`ideas`, `decisions`, `roadmap`) | ☐ | The same config the linter consumes; shape = `## I-NNN`, monotonic IDs, one separator |
| 2 | `entry delete` / `add` / `move` / `renumber` positional splices | ☐ | Re-lint against the same schema as postcondition |
| 3 | Surface decision: a CLI and/or an MCP tool for agents | ☐ | Answers the idea's open question |

## v0.4 — Code conformance track

Code checks join the same engine rather than a parallel toolchain: `conform check` invokes the studio
linters and `clockwork-kitten/bedrock` the way it runs the markdown checks.

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| 1 | Studio Biome + TypeScript base configs (pinned, referenceable) | ☐ | No per-repo drift |
| 2 | Engine runs the lint + format + typecheck baseline | ☐ | Supersedes a standalone `code-conformance.yml` |
| 3 | Invoke `clockwork-kitten/bedrock` as a check | ☐ | Bedrock is a tool the engine runs, not the home |
| 4 | Opinionated Astro ruleset for site/client repos | ☐ | Coordinate with the galleycat template/provisioner |

## Release & versioning

- Consuming repos reference reusable workflows and configs **pinned to a tag** (`@v0.1.0`) and
  upgrade deliberately.
- Semantic-ish tags; breaking changes to a workflow's inputs, a config's rules, or the engine's CLI
  bump the major.
- **`v0.1.0` is cut** (tag + GitHub Release). Releases are automated by the `release` workflow
  (`workflow_dispatch`): it validates the version, verifies `ci` is green, tags, publishes the
  Release, and force-moves a major-line alias (`v0.1` → `v0.1.0`) so consumers can pin to a line and
  still get patches. Full policy and consume paths in `docs/RELEASING.md`.

## Open items

- **License choice at extraction.** Currently `LICENSE` is MIT for simplicity while private.
  Reconsider **Apache-2.0** (patent grant) if the conformance engine is extracted/commercialized —
  see `IDEAS.md` and the `ops` `docs/oss-policy.md`.
- **Public vs private.** Private now; revisit at product extraction.
- **Record the engine architecture as a decision.** The consolidation to one TS/Bun/`mdast` engine
  with `standards` as thin orchestration is a notable direction worth a `CK-NNN` entry in the `ops`
  repo's `docs/DECISIONS.md`, alongside CK-004.
