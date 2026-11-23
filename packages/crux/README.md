# Crux

`@clockwork-kitten/crux` is the inert policy-contract package for the Clockwork
Kitten conformance toolchain. Its JSON Schemas are authoritative; the bundled
TypeScript declarations are deterministic generated views of those schemas.

## Public exports

The package intentionally has no root JavaScript export. Consumers load these
JSON and declaration subpaths:

- `@clockwork-kitten/crux/schemas/rule`
- `@clockwork-kitten/crux/schemas/policy`
- `@clockwork-kitten/crux/schemas/profile`
- `@clockwork-kitten/crux/schemas/suppression`
- `@clockwork-kitten/crux/schemas/suppression-registry`
- `@clockwork-kitten/crux/schemas/engine-manifest`
- `@clockwork-kitten/crux/schemas/fingerprint`
- `@clockwork-kitten/crux/schemas/baseline`
- `@clockwork-kitten/crux/schemas/exception`
- `@clockwork-kitten/crux/schemas/repository-policy`
- `@clockwork-kitten/crux/schemas/migration-disposition`
- `@clockwork-kitten/crux/schemas/bundle`
- `@clockwork-kitten/crux/schemas/lock`
- `@clockwork-kitten/crux/schemas/engine-result`
- `@clockwork-kitten/crux/schemas/conform-result`
- `@clockwork-kitten/crux/schemas/context`
- `@clockwork-kitten/crux/types`

All schemas use JSON Schema 2020-12 and stable major-version `$id` URIs under
`https://schemas.clockwork-kitten.dev/crux/`. Critical objects are closed.
Additive product-specific data is accepted only in an explicitly named
`extensions` map.

## Lock, result, and context contracts

Bundles and locks record exact registry package versions, HTTPS registry URLs,
SRI values, component manifest hashes, schema majors, capabilities, and their
supported environment. The first bundle supports Node.js 24 and 26 on Linux
and macOS. Both npm `package-lock.json` and `bun.lock` installations are
recognized, but verdicts always execute under Node. The mandatory bundle
profiles are `static` and `full`; bundle capabilities are the exact union of
the declared component and verdict-tool capabilities. The first bundle uses
result-schema major 1 and omits `previous` because no earlier published major
exists. Future bundle readers support exactly the current and immediately
previous result-schema majors for at least one Conform minor and 90 days.
Results emitted for a bundle always use that bundle's current result-schema
major.

`EngineResult` is the canonical partial result. `ConformResult` preserves those
validated partials unchanged, adds Conform-owned contract findings, and exposes
the canonical classifications `pass`, `fail`, and `pass-review-required`.
Result environments record what was observed rather than claiming support, so
Windows, unsupported Node majors, and Bun verdict execution can still produce
canonical `unsupported` results classified `fail`. Bundle and lock environment
declarations remain restricted to the supported Node 24/26, Linux/macOS,
npm/Bun-lock installation, and Node-runtime matrix.
Findings carry stable owner, lifecycle, severity, location, bounded/redacted
evidence, remediation, fix, fingerprint, disposition, matched-record, and state
fields.

Canonical hashes are lowercase SHA-256 over RFC 8785 JSON Canonicalization
Scheme bytes. Effective-policy hashes exclude derived outputs and results;
fingerprints exclude line/column and tool prose; context hashes exclude the
`contextHash` field itself. Absolute paths, timestamps, hostnames, and
installation-layout details are never hash inputs. The committed canonical JSON
vectors record RFC 8785 and reference-implementation provenance. A
runtime-neutral harness executes them in Node.js 24 and 26 CI and in the Bun
development suite. Artifact vectors independently vary timestamps, hostnames,
absolute paths, installation layouts, location coordinates, and tool prose to
prove those fields cannot affect effective-policy, policy, context, or
fingerprint hashes.

Derived context contains policy and bundle identifiers, rule states, glossary,
exceptions, architecture references, commands, profiles, top invariants, and
the canonical-result location. Its closed schema intentionally rejects time,
environment, baseline contents, result data, and secrets.

## Baseline, exception, and migration contracts

Human-authored repository policy, exceptions, selectors, overrides, baseline
operation inputs, and migration-diagnostic inputs use JSONC before validation.
Generated, normalized, lock, manifest, result, migration-disposition, and
committed baseline artifacts use strict JSON. Parsing JSONC is a consumer
responsibility; every artifact is validated against the same authoritative
schema after comments are removed.

Baselines are count-aware: each deterministic fingerprint record carries an
occurrence count, and a larger observed count is new debt. Integrity, unknown,
unimplemented, incomplete, unlocked, unsupported, compatibility-failure, and
engine-failure states cannot enter a baseline. Fingerprint-version changes
carry explicit owner package, bundle, before/after count, and mapping-hash
metadata; an absent migration is never an automatic rebaseline.
Development-only reconciliation rejects duplicate occurrence identities,
mixed or non-current fingerprint versions, disconnected migration histories,
and any migration whose exact occurrence totals do not remain consistent
through the current baseline.

Exception expiry is data for an explicit as-of report, not ambient-clock
verdict state. Suppression forms identify one engine owner and a parser with
the same owner. Migration dispositions are one-way diagnostics: they record a
replacement or a reason to drop a known legacy input, but never execute command,
rule, or suppression aliases and never establish a compatibility window.

## Development

From the repository root:

```sh
bun run --cwd packages/crux generate:types
bun run --cwd packages/crux typecheck
bun run --cwd packages/crux test
```

`check:generated` regenerates declarations in memory and fails when
`types/index.d.ts` differs, so schema changes cannot land with stale types.
Schema validation uses Ajv only as development tooling; the published package
has no runtime dependencies.

Development-only reconciliation verifies a lock against its named bundle
without adding an executable package export. It rejects missing, extra, or
mismatched components and tools; package names and exact versions; registry
sources and SRIs; manifest hashes; schema majors; capabilities; policy package;
and supported environment selection. Result reconciliation derives counts and
classification, checks finding dispositions and references, requires relevant
base metadata, validates stable ordering, and proves aggregate results preserve
validated engine partials.

## Support boundary

Crux defines policy data, identity, lifecycle, ownership, profile, suppression,
fingerprint, baseline, exception, repository-override, migration-disposition,
and engine-manifest contracts. It does not scan repositories, execute vectors
or rules, apply exceptions or baselines, interpret JSONC, render results,
resolve locks, translate legacy inputs, or write files. Canon, Crucible, and
Conform consume these contracts and remain responsible for their executable
behavior.

Rule IDs are permanent and never reused. Cross-release validation permits only
the lifecycle transitions encoded by the development validator and rejects
missing IDs, duplicate IDs, removed-ID reuse, zero or multiple owners, and
overlapping ownership tuples assigned to different engines.

Engine manifests bind Canon, Crucible, and Conform to their exact package
identities. Development-only catalog validation reconciles manifest rule,
vector, and capability claims against supplied policy records, including
complete coverage for applicable owned rules. This relational validation is
not exported from the inert package and does not add runtime behavior.
Development-only artifact reconciliation likewise checks baseline, exception,
and repository-override references against authoritative rule existence,
lifecycle, and ownership.
