/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * One recognized inline suppression syntax and its sole parser owner.
 */
export interface SuppressionForm {
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
