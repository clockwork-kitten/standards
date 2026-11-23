import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateExistingBehavior } from "../scripts/existing-behavior-validation.js";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA_FILES = [
  "rule.schema.json",
  "suppression.schema.json",
  "profile.schema.json",
  "policy.schema.json",
  "migration-disposition.schema.json",
  "inventory-reconciliation.schema.json",
  "vector-catalog.schema.json",
] as const;

type MigrationLedger = {
  entries: Parameters<typeof validateExistingBehavior>[3];
};

async function createValidator(): Promise<Ajv2020> {
  const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    strict: true,
  });
  addFormats(ajv);
  for (const schemaFile of SCHEMA_FILES) {
    ajv.addSchema(
      await readJson<Record<string, unknown>>(`schemas/${schemaFile}`),
    );
  }
  return ajv;
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(
    await readFile(join(PACKAGE_ROOT, relativePath), "utf8"),
  ) as T;
}

async function readRecords() {
  const [policy, canon, conform, crucible, reconciliation, migration] =
    await Promise.all([
      readJson<Parameters<typeof validateExistingBehavior>[0]>(
        "policy/existing-behavior.json",
      ),
      readJson<Parameters<typeof validateExistingBehavior>[1][number]>(
        "vectors/canon.json",
      ),
      readJson<Parameters<typeof validateExistingBehavior>[1][number]>(
        "vectors/conform.json",
      ),
      readJson<Parameters<typeof validateExistingBehavior>[1][number]>(
        "vectors/crucible.json",
      ),
      readJson<Parameters<typeof validateExistingBehavior>[2]>(
        "reconciliation/existing-behavior.json",
      ),
      readJson<MigrationLedger>("migration/legacy-disposition.json"),
    ]);
  return {
    catalogs: [canon, conform, crucible],
    migration,
    policy,
    reconciliation,
  };
}

describe("authoritative existing-behavior records", () => {
  test("validate against their public schemas", async () => {
    const records = await readRecords();
    const ajv = await createValidator();

    expect(
      ajv.getSchema("https://schemas.clockwork-kitten.dev/crux/policy/1")?.(
        records.policy,
      ),
      JSON.stringify(
        ajv.getSchema("https://schemas.clockwork-kitten.dev/crux/policy/1")
          ?.errors,
      ),
    ).toBe(true);
    for (const catalog of records.catalogs) {
      expect(
        ajv.getSchema(
          "https://schemas.clockwork-kitten.dev/crux/vector-catalog/1",
        )?.(catalog),
        JSON.stringify(
          ajv.getSchema(
            "https://schemas.clockwork-kitten.dev/crux/vector-catalog/1",
          )?.errors,
        ),
      ).toBe(true);
    }
    expect(
      ajv.getSchema(
        "https://schemas.clockwork-kitten.dev/crux/inventory-reconciliation/1",
      )?.(records.reconciliation),
    ).toBe(true);
    expect(
      ajv.getSchema(
        "https://schemas.clockwork-kitten.dev/crux/migration-disposition/1",
      )?.({
        entries: records.migration.entries,
        inventoryRevision: 1,
        schemaVersion: "1.0.0",
      }),
    ).toBe(true);
  });

  test("reconciles all 325 rows and 76 diagnostic identities exactly once", async () => {
    const records = await readRecords();

    expect(records.reconciliation.rows).toHaveLength(325);
    expect(records.reconciliation.legacyIdentities).toHaveLength(76);
    expect(
      validateExistingBehavior(
        records.policy,
        records.catalogs,
        records.reconciliation,
        records.migration.entries,
      ),
    ).toEqual([]);
  });

  test("rejects an inverted expected result", async () => {
    const records = await readRecords();
    const invertedCatalogs = structuredClone(records.catalogs);
    const vector = invertedCatalogs[0]?.vectors[0];
    if (vector === undefined) {
      throw new Error("Expected at least one Canon vector");
    }
    vector.expectedOutcome =
      vector.expectedOutcome === "pass" ? "fail" : "pass";

    expect(
      validateExistingBehavior(
        records.policy,
        invertedCatalogs,
        records.reconciliation,
        records.migration.entries,
      ),
    ).toContain(`vector outcome mismatch: ${vector.vectorId}`);
  });

  test("rejects missing, duplicate, unknown, wrong-owner, overlap, and orphan mutations", async () => {
    const records = await readRecords();
    const duplicate = structuredClone(records.reconciliation);
    duplicate.rows.push(duplicate.rows[0]!);
    expect(
      validateExistingBehavior(
        records.policy,
        records.catalogs,
        duplicate,
        records.migration.entries,
      ).some((error) => error.startsWith("inventory row reconciled 2 times:")),
    ).toBe(true);

    const missing = structuredClone(records.reconciliation);
    missing.rows.pop();
    expect(
      validateExistingBehavior(
        records.policy,
        records.catalogs,
        missing,
        records.migration.entries,
      ).some((error) => error.startsWith("source denominator mismatch")),
    ).toBe(true);

    const unknown = structuredClone(records.reconciliation);
    unknown.rows[0]!.sourceId = "unknown-source";
    expect(
      validateExistingBehavior(
        records.policy,
        records.catalogs,
        unknown,
        records.migration.entries,
      ),
    ).toContain("inventory row references unknown source: unknown-source");

    const wrongOwner = structuredClone(records.reconciliation);
    const mapped = wrongOwner.rows.find(
      (row) => row.disposition === "mapped-rule",
    );
    if (mapped === undefined) throw new Error("Expected a mapped rule");
    mapped.owner = mapped.owner === "canon" ? "crucible" : "canon";
    expect(
      validateExistingBehavior(
        records.policy,
        records.catalogs,
        wrongOwner,
        records.migration.entries,
      ).some((error) => error.startsWith("inventory row maps wrong owner:")),
    ).toBe(true);

    const overlapPolicy = structuredClone(records.policy);
    overlapPolicy.rules[1]!.aspect = overlapPolicy.rules[0]!.aspect;
    expect(
      validateExistingBehavior(
        overlapPolicy,
        records.catalogs,
        records.reconciliation,
        records.migration.entries,
      ).some((error) => error.startsWith("overlapping ownership tuple:")),
    ).toBe(true);

    const orphanReconciliation = structuredClone(records.reconciliation);
    const orphanRuleId = records.policy.rules[0]!.ruleId;
    orphanReconciliation.rows = orphanReconciliation.rows.filter(
      (row) => row.ruleId !== orphanRuleId,
    );
    expect(
      validateExistingBehavior(
        records.policy,
        records.catalogs,
        orphanReconciliation,
        records.migration.entries,
      ),
    ).toContain(`orphaned rule has no inventory mapping: ${orphanRuleId}`);

    const unknownVectorCatalogs = structuredClone(records.catalogs);
    unknownVectorCatalogs[0]!.vectors[0]!.ruleIds = ["crux/docs/unknown"];
    expect(
      validateExistingBehavior(
        records.policy,
        unknownVectorCatalogs,
        records.reconciliation,
        records.migration.entries,
      ).some((error) => error.startsWith("vector references unknown rule:")),
    ).toBe(true);

    const wrongOwnerCatalogs = structuredClone(records.catalogs);
    wrongOwnerCatalogs[0]!.vectors[0]!.engine = "crucible";
    expect(
      validateExistingBehavior(
        records.policy,
        wrongOwnerCatalogs,
        records.reconciliation,
        records.migration.entries,
      ).some((error) => error.includes("wrong engine")),
    ).toBe(true);

    const orphanVectorCatalogs = structuredClone(records.catalogs);
    const orphanVector = structuredClone(orphanVectorCatalogs[0]!.vectors[0]!);
    orphanVector.vectorId = "orphan-vector";
    orphanVectorCatalogs[0]!.vectors.push(orphanVector);
    expect(
      validateExistingBehavior(
        records.policy,
        orphanVectorCatalogs,
        records.reconciliation,
        records.migration.entries,
      ),
    ).toContain("orphaned vector is not declared by a rule: orphan-vector");

    const missingDisposition = records.migration.entries.slice(1);
    expect(
      validateExistingBehavior(
        records.policy,
        records.catalogs,
        records.reconciliation,
        missingDisposition,
      ).some((error) => error.startsWith("missing-disposition:")),
    ).toBe(true);

    const unknownDisposition = [
      ...records.migration.entries,
      {
        legacy: { id: "legacy/unknown", kind: "rule" as const },
      },
    ];
    expect(
      validateExistingBehavior(
        records.policy,
        records.catalogs,
        records.reconciliation,
        unknownDisposition,
      ),
    ).toContain("unknown-disposition: rule:legacy/unknown");
  });
});
