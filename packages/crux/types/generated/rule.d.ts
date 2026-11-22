/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * Authoritative metadata and ownership contract for one permanent Crux rule ID.
 */
export type RuleRecord = {
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
  promotion?: Promotion;
  implementation: {
    capabilities: KebabId[];
    adapterRequirements: KebabId[];
  };
  fix:
    | {
        kind: "none";
        maxPasses: 0;
        /**
         * @maxItems 0
         */
        writableFileClasses: [];
      }
    | {
        kind: "bounded";
        maxPasses: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
        /**
         * @minItems 1
         */
        writableFileClasses: [FileClass, ...FileClass[]];
      };
  suppressionFormIds: KebabId[];
  vectors: {
    vectorId: KebabId;
    kind: "positive" | "negative";
    engine: Engine;
    expectedOutcome: "pass" | "fail";
  }[];
  extensions?: Extensions;
} & (
  | {
      lifecycle?: "proposed";
      defaultSeverity?: "info";
      topInvariant?: false;
      promotion: Promotion;
    }
  | {
      lifecycle?: "warn";
      defaultSeverity?: "warning";
      promotion: Promotion;
    }
  | {
      lifecycle?: "error";
      defaultSeverity?: "error";
    }
  | {
      lifecycle?: "deprecated";
      deprecated: ReleaseMetadata;
    }
  | {
      lifecycle?: "removed";
      defaultSeverity?: "info";
      topInvariant?: false;
      deprecated: ReleaseMetadata;
      removed: ReleaseMetadata;
    }
);
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "semver".
 */
export type Semver = string;
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "ruleId".
 */
export type RuleId = string;
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "nonEmptyText".
 */
export type NonEmptyText = string;
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "engine".
 */
export type Engine = "canon" | "crucible" | "conform";
/**
 * This interface was referenced by `undefined`'s JSON-Schema
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
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "kebabId".
 */
export type KebabId = string;
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "domain".
 */
export type Domain = string;
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "boundedPattern".
 */
export type BoundedPattern = string;

/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "releaseMetadata".
 */
export interface ReleaseMetadata {
  version: Semver;
  date: string;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "promotion".
 */
export interface Promotion {
  condition: NonEmptyText;
  falsePositiveCeiling: number;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "extensions".
 */
export interface Extensions {
  [k: string]: unknown;
}
