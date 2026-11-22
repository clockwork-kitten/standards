/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * This interface was referenced by `MigrationDispositionLedger`'s JSON-Schema
 * via the `definition` "dispositionEntry".
 */
export type DispositionEntry =
  | {
      legacy: DiagnosticIdentity;
      disposition: "replaced";
      replacement: ReplacementIdentity;
      rationale: string;
    }
  | {
      legacy: DiagnosticIdentity;
      disposition: "dropped";
      rationale: string;
    };

/**
 * One-way diagnostic dispositions for known legacy inputs. This ledger never authorizes alias execution or a compatibility window.
 */
export interface MigrationDispositionLedger {
  schemaVersion: string;
  inventoryRevision: number;
  entries: DispositionEntry[];
}
/**
 * This interface was referenced by `MigrationDispositionLedger`'s JSON-Schema
 * via the `definition` "diagnosticIdentity".
 */
export interface DiagnosticIdentity {
  kind: "command" | "config-key" | "rule" | "suppression";
  id: string;
}
/**
 * This interface was referenced by `MigrationDispositionLedger`'s JSON-Schema
 * via the `definition` "replacementIdentity".
 */
export interface ReplacementIdentity {
  kind: "command" | "config-key" | "rule" | "suppression";
  id: string;
  owner: "canon" | "crucible" | "conform";
}
