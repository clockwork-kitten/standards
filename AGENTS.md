# Agent guide — standards

How agents work in this repo. The studio invariant: **AI proposes freely, a
machine-checkable standard constrains _how_, a human still merges.** `conform` orchestrates
that machine-checkable standard: canon for docs plus the code track; you are the AI that proposes.

## Run `conform` in your own loop

The AI-native analog of "format/lint on save" is not an editor — it is you
running the engine while you propose. Don't wait for CI or the commit hook:

- After editing any Markdown, run `bun run fix:md` to autofix what is fixable and
  regenerate `llms.txt`, then `bun run check:md` to confirm no drift remains.
- `conform fix` reports the residue it can't autofix (e.g. a missing top-level
  heading) — resolve those by hand before committing.
- Before opening a PR, run the full gate: `bun run typecheck` and `bun run test`
  (Vitest, 80% coverage gate), plus `bun run check:md` and `bun run check:llms`.

Command reference:

- `bun run check:md` — markdown lint + internal cross-reference check.
- `bun run fix:md` — autofix fixable markdown rules and regenerate `llms.txt`.
- `bun run check:llms` — verify `llms.txt` is up to date.
- `bun run typecheck` / `bun run test` — engine typecheck and tests.

`bun --filter` is broken here (Bun 1.3.x); use `bun run --cwd packages/conform
<script>` when you need to target the package directly.

## The commit hook is a backstop, not your primary loop

`lefthook.yml` runs `conform fix` (then `conform check`) on staged Markdown at
commit time. Treat it as a safety net: an agent may commit through tooling that
bypasses git hooks (`--no-verify`, the GitHub API), so the hook is not
guaranteed to run. Running `conform` in your loop is what actually upholds the
invariant — the hook only catches what slipped through.

Enable the hook locally with `bunx lefthook install`.

## `fix` is authoring-time only

`conform fix` runs locally, in your loop, and in the pre-commit hook — never in
CI. CI runs `conform check` plus `bun run check:llms` (canon `llms --check`) and fails on
drift. Auto-fixing or auto-committing in CI would fight the human-merge gate and
produce surprising diffs, so never wire `fix` into a workflow.

## Reusable workflows pin their engine by explicit ref, never `job_workflow_sha`

A reusable workflow that checks out its own engine must pin that checkout to an
explicit input ref (a tag or alias) — never `github.job_workflow_sha`. Despite
the name, `job_workflow_sha` resolves to the caller-side ref that started the
run, which for a consumer on `main` is standards `main`, not the tag the
consumer pinned. So a workflow that used it did **not** isolate consumers: it
always ran `main`'s engine, and merging a breaking change to `main` broke every
`@v0.x` consumer at once (this is what happened when canon landed — pinned
consumers hit `Cannot locate package "@clockwork-kitten/canon"`).

The v0.6 `markdown-conformance.yml` does it right: it checks out
`clockwork-kitten/canon` at an explicit `canon-ref` input (default the `v0.1`
alias), a real ref that a caller cannot accidentally slide onto `main`. Keep
new reusable workflows on this pattern.

## Conventions

- **Conventional Commits.** Include the trailer
  `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.
- Ship work as small slices, one PR each, dogfooded on this repo.
- Consuming repos pin to a tag; releases are a deliberate, human-approved
  `workflow_dispatch`. See `docs/RELEASING.md` and `ROADMAP.md`.
