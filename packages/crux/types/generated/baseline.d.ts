/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * This interface was referenced by `Baseline`'s JSON-Schema
 * via the `definition` "sha256".
 */
export type Sha256 = string;
/**
 * Finding states that must never appear in baseline entries.
 *
 * This interface was referenced by `Baseline`'s JSON-Schema
 * via the `definition` "unbaselinableState".
 */
export type UnbaselinableState =
  | "integrity-failure"
  | "unknown"
  | "unimplemented"
  | "incomplete"
  | "unlocked"
  | "unsupported"
  | "compatibility-failure"
  | "engine-failure";

/**
 * A strict generated baseline artifact containing count-aware fingerprints and explicit fingerprint migrations.
 */
export interface Baseline {
  schemaVersion: string;
  baselineId: string;
  bundleId: string;
  effectivePolicyHash: Sha256;
  repositoryRevision: string;
  fingerprintVersion: string;
  entries: {
    findingState: "active";
    record: HttpsSchemasClockworkKittenDevCruxFingerprint1;
  }[];
  migrations: FingerprintMigration[];
}
/**
 * A deterministic, count-aware finding identity suitable for review and baseline matching.
 */
export interface HttpsSchemasClockworkKittenDevCruxFingerprint1 {
  schemaVersion: string;
  fingerprintVersion: string;
  algorithm: "sha256";
  ruleId: string;
  /**
   * A repository-relative POSIX path without dot segments.
   *
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxFingerprint1`'s JSON-Schema
   * via the `definition` "repositoryPath".
   */
  path: string;
  fingerprint: string;
  /**
   * The number of deterministic occurrences represented by this identity. A larger observed count is new debt.
   */
  count: number;
  structuralSummary: string;
}
/**
 * Reviewable metadata for a deterministic, owner-supplied fingerprint-version migration. Counts are occurrence totals before and after migration.
 *
 * This interface was referenced by `Baseline`'s JSON-Schema
 * via the `definition` "fingerprintMigration".
 */
export interface FingerprintMigration {
  migrationId: string;
  owner: "canon" | "crucible" | "conform";
  ownerPackageVersion: string;
  bundleId: string;
  fromFingerprintVersion: string;
  toFingerprintVersion: string;
  beforeCount: number;
  afterCount: number;
  mappingHash: Sha256;
}
