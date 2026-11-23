/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * A repository-relative POSIX path without dot segments.
 *
 * This interface was referenced by `FingerprintRecord`'s JSON-Schema
 * via the `definition` "repositoryPath".
 */
export type RepositoryPath = string;

/**
 * A deterministic, count-aware finding identity suitable for review and baseline matching.
 */
export interface FingerprintRecord {
  schemaVersion: string;
  fingerprintVersion: string;
  algorithm: "sha256";
  ruleId: string;
  path: RepositoryPath;
  fingerprint: string;
  /**
   * The number of deterministic occurrences represented by this identity. A larger observed count is new debt.
   */
  count: number;
  structuralSummary: string;
}
