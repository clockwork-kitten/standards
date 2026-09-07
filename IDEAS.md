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
