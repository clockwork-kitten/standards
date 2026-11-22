/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * Versioned verdict, evidence, execution, and bounded-fix policy.
 */
export interface ExecutionProfile {
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
