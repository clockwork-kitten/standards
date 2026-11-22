/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
 * via the `definition` "engineIdentity".
 */
export type EngineIdentity = {
  name: "canon" | "crucible" | "conform";
  version: string;
  package: string;
  integrity: string;
  /**
   * Lowercase SHA-256 of RFC 8785 canonical JSON bytes for the artifact-specific hash input.
   */
  manifestHash: string;
} & (
  | {
      name?: "canon";
      package?: "@clockwork-kitten/canon";
    }
  | {
      name?: "crucible";
      package?: "@clockwork-kitten/crucible";
    }
  | {
      name?: "conform";
      package?: "@clockwork-kitten/conform";
    }
);

/**
 * Canonical aggregate result preserving validated engine partials and adding Conform-owned contract findings.
 */
export interface ConformResult {
  schemaVersion: string;
  bundleId: string;
  runId: string;
  conform: EngineIdentity & {
    name?: "conform";
    package?: "@clockwork-kitten/conform";
  };
  repository: RepositoryRevision;
  environment: ObservedEnvironment;
  command: "check" | "fix" | "report" | "policy-operation";
  profile: string;
  scope: Scope;
  policyPackage: PackageRecord & {
    name?: "@clockwork-kitten/crux";
  };
  /**
   * Lowercase SHA-256 of RFC 8785 canonical JSON bytes for the artifact-specific hash input.
   */
  effectivePolicyHash: string;
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
   * via the `definition` "completionState".
   */
  completionState:
    | "complete"
    | "incomplete"
    | "unlocked"
    | "unsupported"
    | "engine-failure"
    | "integrity-failure"
    | "compatibility-failure"
    | "fix-not-converged";
  engineResults: HttpsSchemasClockworkKittenDevCruxEngineResult1[];
  contractFindings: Finding[];
  /**
   * All findings in the normative stable sort order; embedded engine results remain unchanged.
   */
  findings: Finding[];
  counts: Counts;
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
   * via the `definition` "classification".
   */
  classification: "pass" | "fail" | "pass-review-required";
  extensions?: Extensions;
}
/**
 * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
 * via the `definition` "repositoryRevision".
 */
export interface RepositoryRevision {
  revision: string;
  baseRevision?: string;
}
/**
 * Observed execution environment. Unsupported values remain representable so canonical unsupported results can be emitted.
 *
 * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
 * via the `definition` "observedEnvironment".
 */
export interface ObservedEnvironment {
  nodeMajor: number;
  operatingSystem: string;
  packageManagerLock: string;
  verdictRuntime: string;
}
/**
 * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
 * via the `definition` "scope".
 */
export interface Scope {
  kind: "repository" | "change" | "paths";
  paths: string[];
}
export interface PackageRecord {
  name: string;
  version: string;
  registryUrl: string;
  integrity: string;
}
/**
 * Canonical partial result emitted by one policy engine.
 */
export interface HttpsSchemasClockworkKittenDevCruxEngineResult1 {
  schemaVersion: string;
  bundleId: string;
  runId: string;
  engine: EngineIdentity;
  repository: RepositoryRevision;
  environment: ObservedEnvironment;
  command: "check" | "fix" | "report" | "policy-operation";
  profile: string;
  scope: Scope;
  policyPackage: PackageRecord & {
    name?: "@clockwork-kitten/crux";
  };
  /**
   * Lowercase SHA-256 of RFC 8785 canonical JSON bytes for the artifact-specific hash input.
   */
  effectivePolicyHash: string;
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
   * via the `definition` "completionState".
   */
  completionState:
    | "complete"
    | "incomplete"
    | "unlocked"
    | "unsupported"
    | "engine-failure"
    | "integrity-failure"
    | "compatibility-failure"
    | "fix-not-converged";
  findings: Finding[];
  counts: Counts;
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
   * via the `definition` "classification".
   */
  classification: "pass" | "fail" | "pass-review-required";
  extensions?: Extensions;
}
/**
 * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
 * via the `definition` "finding".
 */
export interface Finding {
  ruleId: string;
  owner: "canon" | "crucible" | "conform";
  lifecycle: "proposed" | "warn" | "error" | "deprecated" | "removed";
  effectiveSeverity: "info" | "warning" | "error";
  kind: "policy" | "integrity" | "protected-review" | "compatibility";
  location: Location;
  evidence: Evidence;
  remediation: string;
  fixStatus:
    "not-fixable" | "available" | "applied" | "failed" | "not-converged";
  fingerprint: Fingerprint;
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
   * via the `definition` "disposition".
   */
  disposition:
    | "active"
    | "baselined"
    | "excepted"
    | "disabled-by-override"
    | "not-enforced";
  matchedRecord?: MatchedRecord;
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
   * via the `definition` "findingState".
   */
  state:
    | "active"
    | "baselined"
    | "excepted"
    | "disabled-by-override"
    | "not-enforced"
    | "proposed"
    | "removed"
    | "unknown"
    | "unimplemented"
    | "skipped"
    | "incomplete"
    | "unlocked"
    | "unsupported"
    | "engine-failure"
    | "integrity-failure"
    | "compatibility-failure";
}
/**
 * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
 * via the `definition` "location".
 */
export interface Location {
  /**
   * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
   * via the `definition` "repositoryPath".
   */
  path: string;
  structuralAnchor: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}
/**
 * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
 * via the `definition` "evidence".
 */
export interface Evidence {
  identity: string;
  summary: string;
  byteLength: number;
  truncated: boolean;
  redactions: {
    category: "secret-path" | "environment-value" | "token-pattern";
    placeholder: string;
  }[];
}
/**
 * SHA-256 over the versioned rule ID, normalized path, check-kind structural anchor, normalized evidence identity, and occurrence ordinal; line, column, and tool prose are excluded.
 *
 * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
 * via the `definition` "fingerprint".
 */
export interface Fingerprint {
  version: number;
  /**
   * Lowercase SHA-256 of RFC 8785 canonical JSON bytes for the artifact-specific hash input.
   */
  value: string;
  occurrenceOrdinal: number;
  causedBy?: string;
}
/**
 * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
 * via the `definition` "matchedRecord".
 */
export interface MatchedRecord {
  kind: "baseline" | "exception";
  recordId: string;
}
/**
 * This interface was referenced by `HttpsSchemasClockworkKittenDevCruxEngineResult1`'s JSON-Schema
 * via the `definition` "counts".
 */
export interface Counts {
  total: number;
  failing: number;
  reviewRequired: number;
  info: number;
  warning: number;
  error: number;
}
export interface Extensions {
  [k: string]: unknown;
}
