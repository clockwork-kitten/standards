# Ideas — standards

A parking lot for not-yet-scheduled ideas specific to the standards home. Candidates, not
commitments. When one is ready, promote it to `ROADMAP.md` and/or a decision in the `ops` repo's
`docs/DECISIONS.md`, then remove it here.

## Deterministic structural tools for conformant Markdown

A tight, machine-checkable standard turns a Markdown file into a **typed document** — and typed
documents support deterministic structural operations instead of fuzzy string edits.

**Idea.** For files with a guaranteed shape (e.g. `IDEAS.md` = a list of `## I-NNN` entries;
`DECISIONS.md` = dated sections of `### CK-NNN` / `### D-NNN` entries; roadmap tables), ship small
CLI operations agents call instead of hand-splicing prose:

- `entry delete <file> <id>` — remove one entry and its trailing separator cleanly.
- `entry add <file>` / `entry move <file> <id>` — insert/reorder at the right position.
- `entry renumber` / reflow — keep IDs monotonic and separators normalized.

Each operation performs a **schema-aware splice** and then **re-lints** the result, so it can only
produce still-conformant output (or fail loudly). Motivation: real friction was observed cutting
three solved entries out of `ops/docs/IDEAS.md` by string-matching a ~40-line block — a structural
`delete entry` would have been one deterministic call.

**Why it belongs here.** The conformance suite is the *precondition* that makes this safe: the
aggressive lint guarantees the invariants (fixed entry shape, one separator, monotonic IDs) the
tools rely on. Tightness → determinism → agent-safe editing. Sequence after v0.1 (the lint that
enforces the shape) so the operations have guarantees to stand on.

**Open questions.**

- Per-file schemas: encode the shape as config the linter and the tools share, so they can't drift?
- Scope: studio-generic entry model, or a few named document types (`ideas`, `decisions`, `roadmap`)?
- Surface: a CLI, an MCP tool for agents, or both?

## Product extraction — a releasable conformance tool

If the conformance engine becomes genuinely worth shipping, extract it into its **own branded
repo** rather than branding this governance container (the `bedrock` precedent: a named tool in
its own repo). Parked brand-name candidates: **`mimic`**, **`conform`**. Revisit visibility
(public) and license (**Apache-2.0** for the patent grant) at that point — see the `ops` repo's
`docs/oss-policy.md`.

## Accessibility gates in the code track

Contrast-ratio / WCAG checks as part of the code-conformance track, feeding the studio design
standards. Ties to the `ops` `IDEAS.md` design-tooling idea.

## Shared hygiene core

Factor the repo-hygiene assertions into a single reusable unit shared by both the Markdown and
code tracks, so "required files exist and are non-trivial" is defined once.
