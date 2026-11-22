/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * This interface was referenced by `RuleRecord`'s JSON-Schema
 * via the `definition` "semver".
 */
export type Semver = string;
/**
 * This interface was referenced by `RuleRecord`'s JSON-Schema
 * via the `definition` "ruleId".
 */
export type RuleId = string;
/**
 * This interface was referenced by `RuleRecord`'s JSON-Schema
 * via the `definition` "nonEmptyText".
 */
export type NonEmptyText = string;
/**
 * This interface was referenced by `RuleRecord`'s JSON-Schema
 * via the `definition` "engine".
 */
export type Engine = "canon" | "crucible" | "conform";
/**
 * This interface was referenced by `RuleRecord`'s JSON-Schema
 * via the `definition` "fileClass".
 */
export type FileClass =
  | "documentation"
  | "source"
  | "test"
  | "tool-config"
  | "repository-metadata"
  | "generated"
  | "vendored";
/**
 * This interface was referenced by `RuleRecord`'s JSON-Schema
 * via the `definition` "kebabId".
 */
export type KebabId = string;
/**
 * This interface was referenced by `RuleRecord`'s JSON-Schema
 * via the `definition` "domain".
 */
export type Domain = string;
/**
 * This interface was referenced by `RuleRecord`'s JSON-Schema
 * via the `definition` "boundedPattern".
 */
export type BoundedPattern = string;

/**
 * Authoritative metadata and ownership contract for one permanent Crux rule ID.
 */
export interface RuleRecord {
  schemaVersion: Semver;
  ruleId: RuleId;
  title: NonEmptyText;
  summary: NonEmptyText;
  rationale: NonEmptyText;
  remediation: NonEmptyText;
  owner: Engine;
  fileClass: FileClass;
  aspect: KebabId;
  checkKind: "static" | "executing";
  /**
   * @minItems 1
   */
  domains: [Domain, ...Domain[]];
  lifecycle: "proposed" | "warn" | "error" | "deprecated" | "removed";
  defaultSeverity: "info" | "warning" | "error";
  introduced: ReleaseMetadata;
  deprecated?: ReleaseMetadata;
  removed?: ReleaseMetadata;
  replacementRuleId?: RuleId;
  selectors: {
    /**
     * @minItems 1
     */
    repositoryShapes: [KebabId, ...KebabId[]];
    /**
     * @minItems 1
     */
    include: [BoundedPattern, ...BoundedPattern[]];
    exclude: BoundedPattern[];
  };
  topInvariant: boolean;
  promotion?: {
    condition: NonEmptyText;
    falsePositiveCeiling: number;
  };
  implementation: {
    capabilities: KebabId[];
    adapterRequirements: KebabId[];
  };
  fix: {
    kind: "none" | "bounded";
    maxPasses: number;
    writableFileClasses: FileClass[];
  };
  suppressionFormIds: KebabId[];
  vectors: {
    vectorId: KebabId;
    kind: "positive" | "negative";
    engine: Engine;
    expectedOutcome: "pass" | "fail";
  }[];
  extensions?: Extensions;
}
/**
 * This interface was referenced by `RuleRecord`'s JSON-Schema
 * via the `definition` "releaseMetadata".
 */
export interface ReleaseMetadata {
  version: Semver;
  date: string;
}
/**
 * This interface was referenced by `RuleRecord`'s JSON-Schema
 * via the `definition` "extensions".
 */
export interface Extensions {
  [k: string]: unknown;
}
