/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * This interface was referenced by `InventoryReconciliation`'s JSON-Schema
 * via the `definition` "migrationDecision".
 */
export type MigrationDecision = {
  [k: string]: unknown;
} & {
  disposition: "replaced" | "dropped";
  target: string;
  replacement?: ReplacementIdentity;
  intentionalDifference?: string;
};

/**
 * Exact diagnostic reconciliation of frozen legacy inventory rows to permanent ownership or an explicit clean-break disposition.
 */
export interface InventoryReconciliation {
  schemaVersion: string;
  revision: number;
  /**
   * @minItems 1
   */
  sources: [
    {
      [k: string]: unknown;
    },
    ...{
      [k: string]: unknown;
    }[],
  ];
  rows: {
    [k: string]: unknown;
  }[];
  legacyIdentities: DiagnosticIdentity[];
}
export interface DiagnosticIdentity {
  kind: "command" | "config-key" | "rule" | "suppression";
  id: string;
}
export interface ReplacementIdentity {
  kind: "command" | "config-key" | "rule" | "suppression";
  id: string;
  owner: "canon" | "crucible" | "conform";
}
