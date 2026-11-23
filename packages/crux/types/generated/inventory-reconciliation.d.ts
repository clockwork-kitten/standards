/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

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
      sourceId: string;
      repository: string;
      revision: string;
      artifact: string;
      expectedRows: number;
    },
    ...{
      sourceId: string;
      repository: string;
      revision: string;
      artifact: string;
      expectedRows: number;
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
