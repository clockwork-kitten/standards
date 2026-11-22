/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * @minItems 1
 *
 * This interface was referenced by `EngineManifest`'s JSON-Schema
 * via the `definition` "positiveIntegerArray".
 */
export type PositiveIntegerArray = [number, ...number[]];

/**
 * Published engine implementation, capability, and vector coverage declaration.
 */
export interface EngineManifest {
  schemaVersion: string;
  engine: "canon" | "crucible" | "conform";
  package: {
    name: string;
    version: string;
    integrity: string | null;
  };
  compatibleSchemaMajors: {
    rule: PositiveIntegerArray;
    policy: PositiveIntegerArray;
    profile: PositiveIntegerArray;
    suppression: PositiveIntegerArray;
    result: PositiveIntegerArray;
  };
  implementedRuleIds: string[];
  vectorCoverageIds: string[];
  capabilities: string[];
  /**
   * @minItems 1
   */
  commandClasses: [
    "static" | "executing" | "fix" | "report" | "policy-operation",
    ...("static" | "executing" | "fix" | "report" | "policy-operation")[],
  ];
  fixerFileClasses: (
    | "documentation"
    | "source"
    | "test"
    | "tool-config"
    | "repository-metadata"
    | "generated"
    | "vendored"
  )[];
  supportedResultMinors: {
    /**
     * @minItems 1
     *
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[1-9][0-9]*$".
     */
    [k: string]: [number, ...number[]];
  };
  manifestHash: string | null;
  extensions?: Extensions;
}
export interface Extensions {
  [k: string]: unknown;
}
