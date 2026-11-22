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
- `@clockwork-kitten/crux/types`

All schemas use JSON Schema 2020-12 and stable major-version `$id` URIs under
`https://schemas.clockwork-kitten.dev/crux/`. Critical objects are closed.
Additive product-specific data is accepted only in an explicitly named
`extensions` map.

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
