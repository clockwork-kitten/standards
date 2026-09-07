# Ideas — standards

A parking lot for not-yet-scheduled ideas specific to the standards home. Candidates, not
commitments. When one is ready, promote it to `ROADMAP.md` and/or a decision in the `ops` repo's
`docs/DECISIONS.md`, then remove it here.

## Product extraction — a releasable conformance tool

If the conformance engine becomes genuinely worth shipping, extract **the whole engine** into its
**own branded repo** rather than branding this governance container (the `bedrock` precedent: a named
tool in its own repo). Parked brand-name candidates: **`mimic`**, **`conform`**.

The engine's **documentation-repo conformance & operations** surface — markdown lint + reference
integrity + `llms.txt` + schema-aware entry operations (v0.6) + cross-repo entry intake — is its
first complete, differentiated product surface (code conformance is the second). The natural
extraction milestone is once that surface is complete and the CLI/config API has stopped churning,
not mid-flux. Revisit visibility (public) and license (**Apache-2.0** for the patent grant) at that
point — see the `ops` repo's `docs/oss-policy.md`.

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

## Cross-repo entry intake

A standardized way for an agent (or repo) to propose a structured markdown entry into **another**
repo — filing a `CK-NNN` decision in `ops`, adding an idea to a sibling's `IDEAS.md`, appending a
roadmap row — instead of spinning up a session in the target repo and hand-splicing prose. Extends
v0.6's schema-aware entry operations across a repo boundary:

- **Producer:** `conform entry add --repo <target> --doc <schema> …` emits a typed, schema-valid
  entry against the target's document schema.
- **Receiver:** a reusable `entry-intake.yml` workflow (triggered via `repository_dispatch`, or fed
  by a PR opened with a GitHub App installation token) that applies the entry and runs `conform
  check` on the result, so it lands well-formed.

Intake **opens a PR, never direct-commits** — the human-merge gate is preserved. Depends on v0.6
existing first; promote to the roadmap (likely a v0.7 "cross-repo entry intake") once entry
operations land.
