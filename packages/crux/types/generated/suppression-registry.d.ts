/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * One recognized inline suppression syntax and its sole parser owner.
 */
export type HttpsSchemasClockworkKittenDevCruxSuppression1 = {
  schemaVersion: string;
  suppressionId: string;
  owner: "canon" | "crucible" | "conform";
  parser: {
    id: string;
    owner: "canon" | "crucible" | "conform";
  };
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
} & (
  | {
      owner?: "canon";
      parser?: {
        owner?: "canon";
      };
    }
  | {
      owner?: "crucible";
      parser?: {
        owner?: "crucible";
      };
    }
  | {
      owner?: "conform";
      parser?: {
        owner?: "conform";
      };
    }
);

/**
 * The authoritative registry of inline suppression forms and their sole parser owners.
 */
export interface SuppressionRegistry {
  schemaVersion: string;
  forms: HttpsSchemasClockworkKittenDevCruxSuppression1[];
}
