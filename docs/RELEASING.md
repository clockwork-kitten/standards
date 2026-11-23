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

## Publish a Crux prerelease

Crux has an independent package workflow at `.github/workflows/publish-crux.yml`. Changes under
`packages/crux/` run its exact tarball and Node.js 24/26 consumer matrix. Publication itself is a
manual `workflow_dispatch` from `main`; pull requests and ordinary pushes cannot enter the publish
job.

### One-time npm trusted-publisher setup

An npm organization owner or package maintainer must configure the publisher in npm's website.
Do not create an npm access token or add `NPM_TOKEN` to GitHub.

1. Ensure the public package `@clockwork-kitten/crux` exists under the `clockwork-kitten` npm
   organization and that the operator can manage its publishing access. npm currently exposes
   trusted-publisher configuration from an existing package's settings. If the package record is
   absent, an npm organization owner must create or reserve it through npm's account-side process
   (or npm support) first; do not bootstrap it from this workflow with a repository token.
2. Open the package's **Settings → Trusted Publisher** page and choose **GitHub Actions**.
3. Enter these values exactly:
   - **Organization or user:** `clockwork-kitten`
   - **Repository:** `standards`
   - **Workflow filename:** `publish-crux.yml`
   - **Environment name:** `crux-npm`
4. Save the publisher, then complete the first workflow publication within npm's two-day
   configuration-validation window.
5. After trusted publication succeeds, set **Settings → Publishing access** to **Require two-factor
   authentication and disallow tokens**.

The workflow grants only `contents: read` and `id-token: write` to the publish job. npm exchanges
the short-lived GitHub OIDC identity directly; no long-lived registry credential is present.

### One-time GitHub environment setup

A repository administrator must create **Settings → Environments → `crux-npm`** and configure:

1. Required reviewers from the package-owner team, with self-review prevention enabled when the
   repository plan exposes it.
2. Deployment branches restricted to the protected `main` branch.
3. No environment secrets. Trusted publication uses OIDC and does not read an npm token.

The environment name is part of the npm trusted-publisher identity and must match on both sides.
Branch protection on `main` remains the source-review gate; environment approval is the separate
release gate.

### Release procedure

1. Merge the publication change and confirm both `distribution / node-24` and
   `distribution / node-26` pass on `main`.
2. Go to **Actions → publish-crux → Run workflow**, select `main`, and enter a new prerelease such
   as `0.1.0-alpha.1`. Stable versions and versions without a prerelease suffix are rejected.
3. Approve the `crux-npm` environment deployment.
4. Confirm the workflow summary records the public npm version, tarball integrity, and provenance
   attestation metadata.
5. Verify the package page at
   `https://www.npmjs.com/package/@clockwork-kitten/crux/v/<version>` and its provenance badge.
   Keep the workflow run URL and the exact 45-file
   `packages/crux/test/distribution/tarball-files.json` manifest as release evidence.

npm versions are immutable: retry a failed publication with the same version only when npm still
returns `404`; after a successful publish, increment the prerelease version. Releases use only the
`next` dist-tag during 0.x prerelease development and never overwrite a published version.
