/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * This interface was referenced by `EngineResult`'s JSON-Schema
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
} & EngineIdentity1;
export type EngineIdentity1 =
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
    };
/**
 * This interface was referenced by `EngineResult`'s JSON-Schema
 * via the `definition` "repositoryPath".
 */
export type RepositoryPath = string;
/**
 * This interface was referenced by `EngineResult`'s JSON-Schema
 * via the `definition` "completionState".
 */
export type CompletionState =
  | "complete"
  | "incomplete"
  | "unlocked"
  | "unsupported"
  | "engine-failure"
  | "integrity-failure"
  | "compatibility-failure"
  | "fix-not-converged";
/**
 * This interface was referenced by `EngineResult`'s JSON-Schema
 * via the `definition` "disposition".
 */
export type Disposition =
  "active" | "baselined" | "excepted" | "disabled-by-override" | "not-enforced";
/**
 * This interface was referenced by `EngineResult`'s JSON-Schema
 * via the `definition` "findingState".
 */
export type FindingState =
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
/**
 * This interface was referenced by `EngineResult`'s JSON-Schema
 * via the `definition` "classification".
 */
export type Classification = "pass" | "fail" | "pass-review-required";

/**
 * Canonical partial result emitted by one policy engine.
 */
export interface EngineResult {
  schemaVersion: string;
  bundleId: string;
  runId: string;
  engine: EngineIdentity;
  repository: RepositoryRevision;
  environment: Environment;
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
  completionState: CompletionState;
  findings: Finding[];
  counts: Counts;
  classification: Classification;
  extensions?: Extensions;
}
/**
 * This interface was referenced by `EngineResult`'s JSON-Schema
 * via the `definition` "repositoryRevision".
 */
export interface RepositoryRevision {
  revision: string;
  baseRevision?: string;
}
/**
 * This interface was referenced by `EngineResult`'s JSON-Schema
 * via the `definition` "environment".
 */
export interface Environment {
  nodeMajor: 24 | 26;
  operatingSystem: "linux" | "darwin";
  packageManagerLock: "package-lock.json" | "bun.lock";
  verdictRuntime: "node";
}
/**
 * This interface was referenced by `EngineResult`'s JSON-Schema
 * via the `definition` "scope".
 */
export interface Scope {
  kind: "repository" | "change" | "paths";
  paths: RepositoryPath[];
}
export interface PackageRecord {
  name: string;
  version: string;
  registryUrl: string;
  integrity: string;
}
/**
 * This interface was referenced by `EngineResult`'s JSON-Schema
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
  disposition: Disposition;
  matchedRecord?: MatchedRecord;
  state: FindingState;
}
/**
 * This interface was referenced by `EngineResult`'s JSON-Schema
 * via the `definition` "location".
 */
export interface Location {
  path: RepositoryPath;
  structuralAnchor: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}
/**
 * This interface was referenced by `EngineResult`'s JSON-Schema
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
 * This interface was referenced by `EngineResult`'s JSON-Schema
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
 * This interface was referenced by `EngineResult`'s JSON-Schema
 * via the `definition` "matchedRecord".
 */
export interface MatchedRecord {
  kind: "baseline" | "exception";
  recordId: string;
}
/**
 * This interface was referenced by `EngineResult`'s JSON-Schema
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
