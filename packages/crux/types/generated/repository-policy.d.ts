/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * Human-authored repository policy inputs, including explicit and reviewable rule overrides.
 */
export interface RepositoryPolicy {
  schemaVersion: string;
  profileId: string;
  repositoryShape: string;
  severityOverrides: {
    ruleId: string;
    owner: "canon" | "crucible" | "conform";
    severity: "info" | "warning" | "error" | "disabled";
    rationale: string;
    reference: string;
  }[];
  extensions?: Extensions;
}
export interface Extensions {
  [k: string]: unknown;
}
