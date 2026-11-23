import {
  type MigrationDispositionEntry,
  validateMigrationDispositions,
} from "./migration-validation.js";

type Engine = "canon" | "conform" | "crucible";

type LegacyKind = "command" | "config-key" | "rule" | "suppression";

type Policy = {
  rules: Rule[];
};

type Reconciliation = {
  legacyIdentities: { id: string; kind: LegacyKind }[];
  rows: ReconciliationRow[];
  sources: { expectedRows: number; sourceId: string }[];
};

type ReconciliationRow = {
  disposition: string;
  inventoryId: string;
  owner?: Engine;
  ruleId?: string;
  section: string;
  sourceId: string;
};

type Rule = {
  aspect: string;
  checkKind: "executing" | "static";
  domains: string[];
  fileClass: string;
  lifecycle: string;
  owner: Engine;
  ruleId: string;
  vectors: {
    engine: Engine;
    expectedOutcome: "fail" | "pass";
    vectorId: string;
  }[];
};

type VectorCatalog = {
  engine: Engine;
  vectors: {
    engine: Engine;
    expectedOutcome: "fail" | "pass";
    expectedOwners?: Record<string, Engine>;
    kind: "boundary" | "negative" | "positive";
    ruleIds: string[];
    vectorId: string;
  }[];
};

const APPLICABLE_LIFECYCLES = new Set(["deprecated", "error", "warn"]);

export function validateExistingBehavior(
  policy: Policy,
  catalogs: readonly VectorCatalog[],
  reconciliation: Reconciliation,
  migrationEntries: readonly MigrationDispositionEntry[],
): string[] {
  const errors: string[] = [];
  const rulesById = new Map(policy.rules.map((rule) => [rule.ruleId, rule]));
  const rowsByKey = new Map<string, number>();
  const sourceCounts = new Map<string, number>();

  for (const row of reconciliation.rows) {
    const key = `${row.sourceId}:${row.section}:${row.inventoryId}`;
    rowsByKey.set(key, (rowsByKey.get(key) ?? 0) + 1);
    sourceCounts.set(row.sourceId, (sourceCounts.get(row.sourceId) ?? 0) + 1);
    if (row.disposition === "mapped-rule") {
      const rule =
        row.ruleId === undefined ? undefined : rulesById.get(row.ruleId);
      if (rule === undefined) {
        errors.push(`inventory row maps unknown rule: ${key}`);
      } else if (row.owner !== rule.owner) {
        errors.push(`inventory row maps wrong owner: ${key}`);
      }
    }
  }

  for (const [key, count] of rowsByKey) {
    if (count !== 1) {
      errors.push(`inventory row reconciled ${count} times: ${key}`);
    }
  }
  for (const source of reconciliation.sources) {
    const actual = sourceCounts.get(source.sourceId) ?? 0;
    if (actual !== source.expectedRows) {
      errors.push(
        `source denominator mismatch for ${source.sourceId}: expected ${source.expectedRows}, received ${actual}`,
      );
    }
  }
  for (const sourceId of sourceCounts.keys()) {
    if (
      reconciliation.sources.every((source) => source.sourceId !== sourceId)
    ) {
      errors.push(`inventory row references unknown source: ${sourceId}`);
    }
  }

  const mappedRuleIds = new Set(
    reconciliation.rows.flatMap((row) =>
      row.disposition === "mapped-rule" && row.ruleId !== undefined
        ? [row.ruleId]
        : [],
    ),
  );
  for (const rule of policy.rules) {
    if (!mappedRuleIds.has(rule.ruleId)) {
      errors.push(`orphaned rule has no inventory mapping: ${rule.ruleId}`);
    }
  }

  const catalogVectors = catalogs.flatMap((catalog) =>
    catalog.vectors.map((vector) => ({ catalog, vector })),
  );
  const vectorsById = new Map<string, (typeof catalogVectors)[number][]>();
  for (const record of catalogVectors) {
    const records = vectorsById.get(record.vector.vectorId) ?? [];
    records.push(record);
    vectorsById.set(record.vector.vectorId, records);
    if (record.catalog.engine !== record.vector.engine) {
      errors.push(`vector catalog has wrong engine: ${record.vector.vectorId}`);
    }
    for (const ruleId of record.vector.ruleIds) {
      const rule = rulesById.get(ruleId);
      if (rule === undefined) {
        errors.push(
          `vector references unknown rule: ${record.vector.vectorId}`,
        );
      } else if (rule.owner !== record.vector.engine) {
        errors.push(`vector has wrong owner: ${record.vector.vectorId}`);
      }
      const expectedOwner = record.vector.expectedOwners?.[ruleId];
      if (expectedOwner !== undefined && expectedOwner !== rule?.owner) {
        errors.push(
          `boundary vector has wrong owner: ${record.vector.vectorId}`,
        );
      }
    }
  }
  for (const [vectorId, records] of vectorsById) {
    if (records.length !== 1) {
      errors.push(`duplicate vector ID: ${vectorId}`);
    }
  }

  for (const rule of policy.rules) {
    for (const vector of rule.vectors) {
      const record = vectorsById.get(vector.vectorId)?.[0]?.vector;
      if (record === undefined) {
        errors.push(`rule references missing vector: ${vector.vectorId}`);
      } else {
        if (record.engine !== rule.owner) {
          errors.push(`rule vector has wrong owner: ${vector.vectorId}`);
        }
        if (record.expectedOutcome !== vector.expectedOutcome) {
          errors.push(`vector outcome mismatch: ${vector.vectorId}`);
        }
        if (!record.ruleIds.includes(rule.ruleId)) {
          errors.push(`vector omits declaring rule: ${vector.vectorId}`);
        }
      }
    }
    if (
      APPLICABLE_LIFECYCLES.has(rule.lifecycle) &&
      rule.vectors.length === 0
    ) {
      errors.push(`applicable rule has no vector coverage: ${rule.ruleId}`);
    }
  }
  const declaredVectorIds = new Set(
    policy.rules.flatMap((rule) =>
      rule.vectors.map((vector) => vector.vectorId),
    ),
  );
  for (const { vector } of catalogVectors) {
    if (vector.kind !== "boundary" && !declaredVectorIds.has(vector.vectorId)) {
      errors.push(
        `orphaned vector is not declared by a rule: ${vector.vectorId}`,
      );
    }
  }

  for (const [index, left] of policy.rules.entries()) {
    const subsequentRules = policy.rules.slice(index + 1);
    for (const right of subsequentRules) {
      const overlaps =
        left.fileClass === right.fileClass &&
        left.aspect === right.aspect &&
        left.checkKind === right.checkKind &&
        left.domains.some((domain) => right.domains.includes(domain));
      if (overlaps) {
        errors.push(
          `overlapping ownership tuple: ${left.ruleId} and ${right.ruleId}`,
        );
      }
    }
  }

  errors.push(
    ...validateMigrationDispositions(
      reconciliation.legacyIdentities,
      migrationEntries,
    ).map((error) => `${error.code}: ${error.identity}`),
  );

  return errors.toSorted();
}
