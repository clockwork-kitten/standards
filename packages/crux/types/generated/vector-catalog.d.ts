/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * Inert expected-outcome vectors for one engine's Crux-owned rules and ownership boundaries.
 */
export interface VectorCatalog {
  schemaVersion: string;
  engine: "canon" | "crucible" | "conform";
  sourceRevision: string;
  vectors: {
    [k: string]: unknown;
  }[];
}
