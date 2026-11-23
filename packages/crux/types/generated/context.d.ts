/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * This interface was referenced by `DerivedContext`'s JSON-Schema
 * via the `definition` "contextRules".
 */
export type ContextRules = ContextRule[];

/**
 * Deterministic derived repository context; contextHash is SHA-256 over RFC 8785 canonical bytes excluding contextHash.
 */
export interface DerivedContext {
  schemaVersion: string;
  /**
   * Lowercase SHA-256 of RFC 8785 canonical JSON bytes for the artifact-specific hash input.
   */
  contextHash: string;
  bundleId: string;
  policy: {
    policyId: string;
    policyVersion: string;
    /**
     * Lowercase SHA-256 of RFC 8785 canonical JSON bytes for the artifact-specific hash input.
     */
    effectivePolicyHash: string;
  };
  rules: {
    active: ContextRules;
    disabled: ContextRules;
    notEnforced: ContextRules;
  };
  glossary: {
    term: string;
    definition: string;
  }[];
  exceptions: {
    exceptionId: string;
    ruleId: string;
    /**
     * @minItems 1
     */
    scope: [string, ...string[]];
    rationale: string;
  }[];
  architectureReferences: {
    title: string;
    path: string;
  }[];
  commands: {
    name: string;
    command: string;
  }[];
  profiles: string[];
  /**
   * @maxItems 10
   */
  topInvariants:
    | []
    | [ContextRule]
    | [ContextRule, ContextRule]
    | [ContextRule, ContextRule, ContextRule]
    | [ContextRule, ContextRule, ContextRule, ContextRule]
    | [ContextRule, ContextRule, ContextRule, ContextRule, ContextRule]
    | [
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
      ]
    | [
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
      ]
    | [
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
      ]
    | [
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
      ]
    | [
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
        ContextRule,
      ];
  canonicalResultPath: string;
  extensions?: Extensions;
}
/**
 * This interface was referenced by `DerivedContext`'s JSON-Schema
 * via the `definition` "contextRule".
 */
export interface ContextRule {
  ruleId: string;
  title: string;
  summary: string;
  owner: "canon" | "crucible" | "conform";
  lifecycle: "proposed" | "warn" | "error" | "deprecated" | "removed";
}
export interface Extensions {
  [k: string]: unknown;
}
