/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * Ordered authoritative rules and shared policy data.
 */
export interface Policy {
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
   * via the `definition` "semver".
   */
  schemaVersion: string;
  policyId: string;
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
   * via the `definition` "semver".
   */
  policyVersion: string;
  /**
   * @minItems 1
   */
  rules: [
    HttpsSchemasClockworkKittenDevCruxRule1,
    ...HttpsSchemasClockworkKittenDevCruxRule1[],
  ];
  studioGlossary: {
    term: string;
    definition: string;
  }[];
  /**
   * @minItems 1
   */
  fileClassRules: [
    {
      /**
       * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
       * via the `definition` "fileClass".
       */
      fileClass:
        | "documentation"
        | "source"
        | "test"
        | "tool-config"
        | "repository-metadata"
        | "generated"
        | "vendored";
      /**
       * @minItems 1
       */
      include: [string, ...string[]];
      exclude: string[];
    },
    ...{
      /**
       * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
       * via the `definition` "fileClass".
       */
      fileClass:
        | "documentation"
        | "source"
        | "test"
        | "tool-config"
        | "repository-metadata"
        | "generated"
        | "vendored";
      /**
       * @minItems 1
       */
      include: [string, ...string[]];
      exclude: string[];
    }[],
  ];
  controlledTokens: {
    token: string;
    tokenization: "exact" | "kebab" | "camel" | "pascal" | "snake";
    /**
     * @minItems 1
     */
    declarations: [string, ...string[]];
    warning: string;
    excludeGenerated: boolean;
    excludeVendored: boolean;
    abbreviations: string[];
  }[];
  suppressions: HttpsSchemasClockworkKittenDevCruxSuppression1[];
  /**
   * @minItems 1
   */
  profiles: [
    HttpsSchemasClockworkKittenDevCruxProfile1,
    ...HttpsSchemasClockworkKittenDevCruxProfile1[],
  ];
  extensions?: Extensions;
}
/**
 * Authoritative metadata and ownership contract for one permanent Crux rule ID.
 */
export interface HttpsSchemasClockworkKittenDevCruxRule1 {
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
   * via the `definition` "semver".
   */
  schemaVersion: string;
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
   * via the `definition` "ruleId".
   */
  ruleId: string;
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
   * via the `definition` "nonEmptyText".
   */
  title: string;
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
   * via the `definition` "nonEmptyText".
   */
  summary: string;
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
   * via the `definition` "nonEmptyText".
   */
  rationale: string;
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
   * via the `definition` "nonEmptyText".
   */
  remediation: string;
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
   * via the `definition` "engine".
   */
  owner: "canon" | "crucible" | "conform";
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
   * via the `definition` "fileClass".
   */
  fileClass:
    | "documentation"
    | "source"
    | "test"
    | "tool-config"
    | "repository-metadata"
    | "generated"
    | "vendored";
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
   * via the `definition` "kebabId".
   */
  aspect: string;
  checkKind: "static" | "executing";
  /**
   * @minItems 1
   */
  domains: [string, ...string[]];
  lifecycle: "proposed" | "warn" | "error" | "deprecated" | "removed";
  defaultSeverity: "info" | "warning" | "error";
  introduced: ReleaseMetadata;
  deprecated?: ReleaseMetadata;
  removed?: ReleaseMetadata;
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
   * via the `definition` "ruleId".
   */
  replacementRuleId?: string;
  selectors: {
    /**
     * @minItems 1
     */
    repositoryShapes: [string, ...string[]];
    /**
     * @minItems 1
     */
    include: [string, ...string[]];
    exclude: string[];
  };
  topInvariant: boolean;
  promotion?: {
    /**
     * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
     * via the `definition` "nonEmptyText".
     */
    condition: string;
    falsePositiveCeiling: number;
  };
  implementation: {
    capabilities: string[];
    adapterRequirements: string[];
  };
  fix: {
    kind: "none" | "bounded";
    maxPasses: number;
    writableFileClasses: (
      | "documentation"
      | "source"
      | "test"
      | "tool-config"
      | "repository-metadata"
      | "generated"
      | "vendored"
    )[];
  };
  suppressionFormIds: string[];
  vectors: {
    /**
     * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
     * via the `definition` "kebabId".
     */
    vectorId: string;
    kind: "positive" | "negative";
    /**
     * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
     * via the `definition` "engine".
     */
    engine: "canon" | "crucible" | "conform";
    expectedOutcome: "pass" | "fail";
  }[];
  extensions?: Extensions;
}
/**
 * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
 * via the `definition` "releaseMetadata".
 */
export interface ReleaseMetadata {
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
   * via the `definition` "semver".
   */
  version: string;
  date: string;
}
/**
 * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxRule1`'s JSON-Schema
 * via the `definition` "extensions".
 */
export interface Extensions {
  [k: string]: unknown;
}
/**
 * One recognized inline suppression syntax and its sole parser owner.
 */
export interface HttpsSchemasClockworkKittenDevCruxSuppression1 {
  schemaVersion: string;
  suppressionId: string;
  owner: "canon" | "crucible" | "conform";
  parser: string;
  syntax: {
    kind: "line-comment" | "block-comment" | "document-directive" | "metadata";
    pattern: string;
    maxLength: number;
  };
  /**
   * @minItems 1
   */
  fileClasses: [
    "documentation" | "source" | "test" | "tool-config" | "repository-metadata",
    ...(
      | "documentation"
      | "source"
      | "test"
      | "tool-config"
      | "repository-metadata"
    )[],
  ];
  requiresLedgerEntry: true;
  extensions?: {
    [k: string]: unknown;
  };
}
/**
 * Versioned verdict, evidence, execution, and bounded-fix policy.
 */
export interface HttpsSchemasClockworkKittenDevCruxProfile1 {
  schemaVersion: string;
  profileId: string;
  ci: boolean;
  /**
   * @minItems 1
   */
  allowedCheckKinds: ["static" | "executing", ...("static" | "executing")[]];
  evidenceLimits: {
    perFindingBytes: number;
    totalBytes: number;
  };
  agentOutputLimits: {
    ordinaryFindingCount: number;
    totalBytes: number;
    neverTruncateIntegrity: true;
    neverTruncateProtectedReview: true;
  };
  fix: {
    maxPasses: number;
    engineOrder: ("canon" | "crucible" | "conform")[];
    writableFileClasses: {
      canon?: "documentation"[];
      crucible?: ("source" | "test" | "tool-config")[];
      conform?: "repository-metadata"[];
    };
  };
  extensions?: {
    [k: string]: unknown;
  };
}
