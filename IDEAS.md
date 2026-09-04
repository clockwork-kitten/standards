# Ideas — standards

A parking lot for not-yet-scheduled ideas specific to the standards home. Candidates, not
commitments. When one is ready, promote it to `ROADMAP.md` and/or a decision in the `ops` repo's
`docs/DECISIONS.md`, then remove it here.

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
