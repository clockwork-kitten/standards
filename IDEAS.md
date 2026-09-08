# Ideas — standards

A parking lot for not-yet-scheduled ideas specific to the standards home. Candidates, not
commitments. When one is ready, promote it to `ROADMAP.md` and/or a decision in the `ops` repo's
`docs/DECISIONS.md`, then remove it here.

## Custom Astro house-policy rules

The v0.5 Astro ruleset ships the *reuse baseline* (`eslint-plugin-astro` recommended + a11y +
`prettier-plugin-astro`). The follow-up is the studio-specific structural rules no upstream plugin
covers — authored as ESLint rules over `astro-eslint-parser`'s AST (or the engine's own runner for
uniformity with the mdast rules). Candidates: `client:*` hydration-directive policy, `set:html`
sanitizer allowlist, required `Props` export / layout wrapper, banned inline `<style>` in favor of
design-token components, frontmatter import ordering beyond `perfectionist`. Scope narrowly — only
house policy; everything generic (a11y, unsafe html, TS correctness) is already covered.

## Accessibility gates in the code track

Contrast-ratio / WCAG checks as part of the code-conformance track, feeding the studio design
standards. Ties to the `ops` `IDEAS.md` design-tooling idea.

## Studio-wide venue for release / standards announcements

We need a way to tell the *broader studio* about release and distribution decisions — e.g. the
canon extraction and its GitHub Packages distribution model, how to consume it (`.npmrc` scope
mapping + `packages: read`), the pin-to-tag policy, and future breaking bumps. There is currently
no venue for this kind of cross-repo announcement. Candidates: a `CHANGELOG`/announcements doc in
`ops`, a pinned discussion, or a studio-level release-notes feed the tools publish to. Decide the
venue, then backfill an announcement covering the canon release + distribution plan.

## Migrate conform's canon consumption to GitHub Packages

Phase C wires `conform` to `canon` via **checkout-from-source** (the reusable workflow checks out
canon at its release alias and runs its CLI, mirroring how the conform engine is consumed today) to
avoid the `read:packages` auth gate. Once the org grants the `@clockwork-kitten/canon` package read
access to consumer repos (or it goes org-internal) and a `packages: read` token is wired into CI,
switch conform to consume canon as a real GitHub Packages **dependency** (`@clockwork-kitten/canon`
pinned) instead of a source checkout — dropping the bespoke checkout/link steps. This is the
on-model end state; checkout-from-source is the interim.
