/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * A human-authored exception ledger. Dates are report inputs and never ambient-clock verdict state.
 */
export interface ExceptionLedger {
  schemaVersion: string;
  ledgerId: string;
  entries: ExceptionEntry[];
}
/**
 * This interface was referenced by `ExceptionLedger`'s JSON-Schema
 * via the `definition` "exceptionEntry".
 */
export interface ExceptionEntry {
  exceptionId: string;
  ruleId: string;
  ruleOwner: "canon" | "crucible" | "conform";
  rationale: string;
  scope:
    | {
        kind: "repository";
      }
    | {
        kind: "paths";
        /**
         * @minItems 1
         */
        paths: [string, ...string[]];
      }
    | {
        kind: "fingerprints";
        /**
         * @minItems 1
         */
        fingerprints: [string, ...string[]];
      };
  owner: string;
  createdBy: string;
  createdOn: string;
  /**
   * Optional report datum. Its presence does not imply an ambient-clock verdict.
   */
  expiresOn?: string;
  reference: string;
}
