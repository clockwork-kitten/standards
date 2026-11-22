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
- `@clockwork-kitten/crux/schemas/engine-manifest`
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
recognized, but verdicts always execute under Node. Bundle result readers
support the current and immediately previous result-schema major for at least
one Conform minor and 90 days.

`EngineResult` is the canonical partial result. `ConformResult` preserves those
validated partials unchanged, adds Conform-owned contract findings, and exposes
the canonical classifications `pass`, `fail`, and `pass-review-required`.
Findings carry stable owner, lifecycle, severity, location, bounded/redacted
evidence, remediation, fix, fingerprint, disposition, matched-record, and state
fields.

Canonical hashes are lowercase SHA-256 over RFC 8785 JSON Canonicalization
Scheme bytes. Effective-policy hashes exclude derived outputs and results;
fingerprints exclude line/column and tool prose; context hashes exclude the
`contextHash` field itself. Absolute paths, timestamps, hostnames, and
installation-layout details are never hash inputs. The committed canonical JSON
vectors are portable across Node.js 24, Node.js 26, and the Bun development
runtime.

Derived context contains policy and bundle identifiers, rule states, glossary,
exceptions, architecture references, commands, profiles, top invariants, and
the canonical-result location. Its closed schema intentionally rejects time,
environment, baseline contents, result data, and secrets.

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

## Support boundary

Crux defines policy data, identity, lifecycle, ownership, profile, suppression,
and engine-manifest contracts. It does not scan repositories, execute vectors
or rules, apply exceptions or baselines, render results, resolve locks, or write
files. Canon, Crucible, and Conform consume these contracts and remain
responsible for their executable behavior.

Rule IDs are permanent and never reused. Cross-release validation permits only
the lifecycle transitions encoded by the development validator and rejects
missing IDs, duplicate IDs, removed-ID reuse, zero or multiple owners, and
overlapping ownership tuples assigned to different engines.

Engine manifests bind Canon, Crucible, and Conform to their exact package
identities. Development-only catalog validation reconciles manifest rule,
vector, and capability claims against supplied policy records, including
complete coverage for applicable owned rules. This relational validation is
not exported from the inert package and does not add runtime behavior.
