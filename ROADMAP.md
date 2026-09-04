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
| 1 | Repo skeleton: `README`, `ROADMAP`, `IDEAS`, `LICENSE`, markdownlint config | ◐ | Dogfoods the hygiene rules it will enforce |
| 2 | `markdown-conformance.yml` reusable workflow (`workflow_call`) | ☐ | markdownlint + internal-reference check; inputs for config/paths |
| 3 | Generalize the reference checker so any repo can call it | ☐ | From `ops/scripts/check_links.py`; make roots/globs configurable |
| 4 | `repo-hygiene.yml` reusable workflow | ☐ | Assert required files exist and are non-trivial; configurable required-file list |
| 5 | Shared, versioned markdownlint config consumers can reference | ☐ | Pinnable; mirrors the studio standard (CK-003) |
| 6 | Tag `v0.1.0`; document the `uses: …@v0.1.0` consume path | ☐ | Release/versioning story below |
| 7 | Pilot adoption in `ops`: replace local `docs.yml` with `uses:` this repo | ☐ | Proves the end-to-end consume path |

## v0.2 — Code conformance track

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| 1 | Studio Biome + TypeScript base configs (pinned, referenceable) | ☐ | No per-repo drift |
| 2 | `code-conformance.yml` reusable workflow | ☐ | Lint + format + typecheck baseline |
| 3 | Invoke `clockwork-kitten/bedrock` as a check in the code track | ☐ | Bedrock is a tool the track runs, not the home |
| 4 | Opinionated Astro ruleset for site/client repos | ☐ | Coordinate with the galleycat template/provisioner |

## Release & versioning

- Consuming repos reference reusable workflows and configs **pinned to a tag** (`@v0.1.0`) and
  upgrade deliberately.
- Semantic-ish tags; breaking changes to a workflow's inputs or a config's rules bump the major.

## Open items

- **License choice at extraction.** Currently `LICENSE` is MIT for simplicity while private.
  Reconsider **Apache-2.0** (patent grant) if the conformance engine is extracted/commercialized —
  see `IDEAS.md` and the `ops` `docs/oss-policy.md`.
- **Public vs private.** Private now; revisit at product extraction.
