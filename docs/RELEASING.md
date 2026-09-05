# Releasing — standards

How the studio standards home cuts releases. Consuming repos pin to tags published here, so
releases are deliberate and versioned. The `release` workflow (`.github/workflows/release.yml`)
automates the mechanics; a human still decides when and what to release.

## Cut a release

1. Make sure `main` is green — the `ci` workflow must pass on the commit you intend to release.
2. Go to **Actions → release → Run workflow**.
3. Fill in the inputs:
   - **version** — the new version, `vMAJOR.MINOR.PATCH` (e.g. `v0.2.0`). Must not already exist.
   - **ref** — the ref to release from (default `main`).
   - **skip-ci-check** — leave unchecked; only set it to release without a green `ci` run.
4. Run it. The workflow validates the inputs, verifies `ci` is green on the target commit, creates
   and pushes the annotated tag, publishes a GitHub Release with generated notes, and force-moves
   the major-line alias tag.

## Versioning policy

- Semantic-ish. Breaking changes to a reusable workflow's inputs, a shared config's rules, or the
  `conform` engine's CLI bump the **major**. During `0.x`, each **minor** may break — treat
  `v0.1` and `v0.2` as incompatible lines.
- Version tags are **immutable** — never re-point a `vX.Y.Z` tag once published.

## Alias tags (pin-to-a-line)

Alongside each immutable version tag, the workflow maintains one **moving** alias so consumers can
follow a line and pick up patches automatically:

- During `0.x`: the alias is `v0.MINOR` (e.g. releasing `v0.1.3` moves `v0.1` → `v0.1.3`).
- From `1.0` on: the alias is `vMAJOR` (e.g. releasing `v1.4.0` moves `v1` → `v1.4.0`).

The alias is derived from the released version, so releasing a patch on an older line moves only
that line's alias — it never drags a newer line backward.

## Consume paths

Pin to an exact version for maximum stability, or to the line alias for automatic patches:

```yaml
jobs:
  # Exact version — never changes until you bump it.
  markdown:
    uses: clockwork-kitten/standards/.github/workflows/markdown-conformance.yml@v0.1.0

  # Line alias — receives patch releases within the v0.1 line.
  hygiene:
    uses: clockwork-kitten/standards/.github/workflows/repo-hygiene.yml@v0.1
```

Upgrade across lines (`@v0.1` → `@v0.2`) deliberately, since a new minor may be breaking during
`0.x`.
