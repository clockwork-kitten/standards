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

### GitHub release protections

The live repository settings are part of the release boundary, not assumptions made by the
workflow file. As verified through the GitHub REST API on 2026-11-23:

- `main` requires pull requests, conversation resolution, linear history, administrator
  enforcement, and strict passing checks named `conform`, `hygiene / required-files`, and
  `reusable-markdown / markdownlint`; force pushes and deletion are disabled.
- `crux-npm` requires reviewer `josephcarey`, deliberately permits that reviewer to approve their
  own deployment, and limits deployments to protected branches. It therefore admits only
  protected `main` for this workflow.

Inspect the current settings rather than relying on this dated snapshot:

```sh
gh api repos/clockwork-kitten/standards/branches/main/protection
gh api repos/clockwork-kitten/standards/environments/crux-npm
```

The environment name is also part of the npm trusted-publisher identity and must match on both
sides. Branch protection is the source-review gate; environment approval is the separate release
gate.

### One-time first-package bootstrap

npm requires the package to exist before its trusted publisher can be configured. The only token
path is therefore a one-time bootstrap, never a fallback for trusted publication:

1. Create a granular npm token with write access limited to the `clockwork-kitten` scope and the
   shortest practical expiry. Add it temporarily as `NPM_BOOTSTRAP_TOKEN` in the protected
   `crux-npm` environment (or as a repository Actions secret if environment-secret administration
   is unavailable). Do not put the value in an issue, pull request, workflow input, log, or chat.
2. From **Actions → publish-crux → Run workflow**, select `main`, enter the first 0.x prerelease,
   and enable **bootstrap**. Approve the `crux-npm` deployment.
3. The bootstrap job rechecks that the package itself returns npm `404` after approval. It refuses
   to run after any version exists, publishes with `--provenance` and `next`, then fails unless the
   exact registry version, tarball integrity, npm attestation URL, signed SLSA provenance subject,
   and transparency-log entry all verify.
4. Immediately revoke the granular token in npm and delete `NPM_BOOTSTRAP_TOKEN` from GitHub.
   Confirm the secret is gone before configuring or testing the permanent path.

The regular `publish` job never reads this secret. There is no token fallback once the package
exists.

### Configure permanent trusted publishing

After the bootstrap package is public, an npm organization owner or package maintainer must open
its **Settings → Trusted Publisher** page, choose **GitHub Actions**, and enter:

- **Organization or user:** `clockwork-kitten`
- **Repository:** `standards`
- **Workflow filename:** `publish-crux.yml`
- **Environment name:** `crux-npm`
- **Allowed actions:** **Allow npm publish**

Leave dist-tag management disabled; this workflow supplies `next` as part of `npm publish` and
does not perform a separate dist-tag operation. The equivalent npm CLI configuration must include
`--allow-publish`.

Where npm marks a new trusted-publisher configuration as pending validation, complete the first
OIDC publication within two days or recreate the expired configuration. Then set
**Settings → Publishing access** to **Require two-factor authentication and disallow tokens**.

The permanent job grants only `contents: read` and `id-token: write`. npm exchanges the short-lived
GitHub OIDC identity directly; no registry credential is present.

### Release procedure

1. Confirm both `distribution / node-24` and `distribution / node-26` pass on protected `main`.
2. Go to **Actions → publish-crux → Run workflow**, select `main`, leave **bootstrap** disabled,
   and enter a new prerelease. Stable versions and versions without a prerelease suffix are
   rejected.
3. Approve the `crux-npm` environment deployment.
4. Confirm the workflow summary records the exact registry metadata URL and fields
   (`version`, `dist.tarball`, `dist.integrity`, `dist.attestations.url`, and
   `dist.attestations.provenance.predicateType`) plus the fetched Sigstore/SLSA attestation
   evidence. A zero exit from `npm publish` alone is not success.
5. Verify the package page at
   `https://www.npmjs.com/package/@clockwork-kitten/crux/v/<version>` and its provenance badge.
   Keep the workflow run URL and the exact 45-file
   `packages/crux/test/distribution/tarball-files.json` manifest as release evidence.

npm versions are immutable: retry a failed publication with the same version only when npm still
returns `404`; after a successful publish, increment the prerelease version. Releases use only the
`next` dist-tag during 0.x prerelease development and never overwrite a published version.

Keep `clockwork-kitten/studio-board#97` open when this repository setup merges. Close it only after
the bootstrap evidence, token revocation and secret deletion, trusted-publisher configuration, and
a subsequent tokenless OIDC release have all been recorded, including the npm URL, public tarball,
and fetched attestation evidence.
