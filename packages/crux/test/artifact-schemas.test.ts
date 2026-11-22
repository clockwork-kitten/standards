import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  Baseline,
  FingerprintRecord,
  SuppressionForm,
} from "../types/index.js";

import {
  validateArtifactPolicyReferences,
  validateBaselineIntegrity,
} from "../scripts/artifact-validation.js";
import {
  type LegacyIdentity,
  type MigrationDispositionEntry,
  validateMigrationDispositions,
} from "../scripts/migration-validation.js";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA_DIRECTORY = join(PACKAGE_ROOT, "schemas");
const FIXTURE_DIRECTORY = fileURLToPath(new URL("fixtures", import.meta.url));
const SCHEMA_FILES = [
  "rule.schema.json",
  "fingerprint.schema.json",
  "baseline.schema.json",
  "exception.schema.json",
  "repository-policy.schema.json",
  "suppression.schema.json",
  "suppression-registry.schema.json",
  "migration-disposition.schema.json",
] as const;

type AliasFixture = NamedFixture & {
  entry: Record<string, unknown>;
};

type ArtifactReconciliationFixture = NamedFixture & {
  baselineRuleId: string;
  exceptionReference: {
    owner: "canon" | "conform" | "crucible";
    ruleId: string;
  };
  expectedErrors: string[];
  overrideReference: {
    owner: "canon" | "conform" | "crucible";
    ruleId: string;
  };
  rules: Parameters<typeof validateArtifactPolicyReferences>[0];
};

type BaselineIntegrityFixture = NamedFixture & {
  baseline: Baseline;
  currentFingerprintVersion: string;
  expectedErrors: string[];
};

type BaselineStateFixture = NamedFixture & {
  states: string[];
};

type MigrationFixture = NamedFixture & {
  entries: MigrationDispositionEntry[];
  inventory: LegacyIdentity[];
};

type NamedFixture = {
  fixtureRevision: number;
  name: string;
};

async function createValidator(): Promise<Ajv2020> {
  const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    strict: true,
  });
  addFormats(ajv);
  for (const schemaFile of SCHEMA_FILES) {
    const schemaPath = join(SCHEMA_DIRECTORY, schemaFile);
    const schemaText = await readFile(schemaPath, "utf8");
    ajv.addSchema(JSON.parse(schemaText) as Record<string, unknown>);
  }
  return ajv;
}

async function readFixture<T extends NamedFixture>(
  relativePath: string,
): Promise<T> {
  return JSON.parse(
    await readFile(join(FIXTURE_DIRECTORY, relativePath), "utf8"),
  ) as T;
}

const fingerprint: FingerprintRecord = {
  algorithm: "sha256",
  count: 2,
  fingerprint: "a".repeat(64),
  fingerprintVersion: "1.0.0",
  path: "docs/README.md",
  ruleId: "crux/docs/markdown-format",
  schemaVersion: "1.0.0",
  structuralSummary: "Two headings omit the required spacing.",
};

const baseline: Baseline = {
  baselineId: "initial-adoption",
  bundleId: "t1-candidate",
  effectivePolicyHash: "b".repeat(64),
  entries: [
    {
      findingState: "active",
      record: fingerprint,
    },
  ],
  fingerprintVersion: "1.0.0",
  migrations: [
    {
      afterCount: 2,
      beforeCount: 2,
      bundleId: "t1-candidate",
      fromFingerprintVersion: "0.9.0",
      mappingHash: "c".repeat(64),
      migrationId: "fingerprint-v1",
      owner: "canon",
      ownerPackageVersion: "1.0.0",
      toFingerprintVersion: "1.0.0",
    },
  ],
  repositoryRevision: "d".repeat(40),
  schemaVersion: "1.0.0",
};

const suppressionForm: SuppressionForm = {
  fileClasses: ["documentation"],
  owner: "canon",
  parser: {
    id: "canon-markdown",
    owner: "canon",
  },
  requiresLedgerEntry: true,
  schemaVersion: "1.0.0",
  suppressionId: "markdown-directive",
  syntax: {
    kind: "document-directive",
    maxLength: 256,
    pattern: "<!-- crux-ignore <rule-id> -->",
  },
};

describe("baseline and fingerprint schemas", () => {
  test("accept count-aware records and explicit migration metadata", async () => {
    const ajv = await createValidator();

    expect(
      ajv.getSchema(
        "https://schemas.clockwork-kitten.dev/crux/fingerprint/1",
      )?.(fingerprint),
    ).toBe(true);
    expect(
      ajv.getSchema("https://schemas.clockwork-kitten.dev/crux/baseline/1")?.(
        baseline,
      ),
    ).toBe(true);
  });

  test("rejects unknown properties and every unbaselinable state", async () => {
    const ajv = await createValidator();
    const validate = ajv.getSchema(
      "https://schemas.clockwork-kitten.dev/crux/baseline/1",
    );
    const forbidden = await readFixture<BaselineStateFixture>(
      "baseline/forbidden-state.json",
    );
    const unknown = await readFixture<NamedFixture & { unknownField: boolean }>(
      "baseline/unknown-field.json",
    );
    expect(forbidden.fixtureRevision, forbidden.name).toBe(1);
    expect(
      validate?.({
        ...baseline,
        unknownField: unknown.unknownField,
      }),
      unknown.name,
    ).toBe(false);
    for (const state of forbidden.states) {
      expect(
        validate?.({
          ...baseline,
          entries: [
            {
              ...baseline.entries[0],
              findingState: state,
            },
          ],
        }),
        state,
      ).toBe(false);
    }
  });
});

describe("baseline integrity reconciliation", () => {
  test("produces exact deterministic fixture verdicts", async () => {
    const fixtureNames = [
      "broken-chain.json",
      "duplicate-identity.json",
      "missing-chain.json",
      "mixed-versions.json",
      "unmigrated-version.json",
      "valid-migrated.json",
    ];

    for (const fixtureName of fixtureNames) {
      const fixture = await readFixture<BaselineIntegrityFixture>(
        `baseline-integrity/${fixtureName}`,
      );

      expect(fixture.fixtureRevision, fixture.name).toBe(1);
      expect(
        validateBaselineIntegrity(
          fixture.baseline,
          fixture.currentFingerprintVersion,
        ),
        fixture.name,
      ).toEqual(fixture.expectedErrors.toSorted());
    }
  });
});

describe("artifact-to-policy reconciliation", () => {
  test("rejects genuine unknown, removed, non-applicable, and wrong-owner references", async () => {
    const fixtureNames = [
      "non-applicable-rule.json",
      "removed-rule.json",
      "unknown-rule.json",
      "valid-references.json",
      "wrong-owner.json",
    ];

    for (const fixtureName of fixtureNames) {
      const fixture = await readFixture<ArtifactReconciliationFixture>(
        `artifact-reconciliation/${fixtureName}`,
      );

      expect(fixture.fixtureRevision, fixture.name).toBe(1);
      expect(
        validateArtifactPolicyReferences(
          fixture.rules,
          {
            ...baseline,
            entries: [
              {
                findingState: "active",
                record: {
                  ...fingerprint,
                  ruleId: fixture.baselineRuleId,
                },
              },
            ],
          },
          {
            entries: [
              {
                createdBy: "@maintainer",
                createdOn: "2026-11-22",
                exceptionId: "temporary-docs-exception",
                owner: "@docs-team",
                rationale: "A reviewed temporary exception.",
                reference: "https://github.com/example/repo/issues/12",
                ruleId: fixture.exceptionReference.ruleId,
                ruleOwner: fixture.exceptionReference.owner,
                scope: {
                  kind: "repository",
                },
              },
            ],
            ledgerId: "repository-exceptions",
            schemaVersion: "1.0.0",
          },
          {
            profileId: "ci",
            repositoryShape: "typescript-package",
            schemaVersion: "1.0.0",
            severityOverrides: [
              {
                owner: fixture.overrideReference.owner,
                rationale: "A reviewed temporary override.",
                reference: "https://github.com/example/repo/issues/12",
                ruleId: fixture.overrideReference.ruleId,
                severity: "warning",
              },
            ],
          },
        ),
        fixture.name,
      ).toEqual(fixture.expectedErrors.toSorted());
    }
  });
});

describe("exception, override, and suppression schemas", () => {
  test("accept reviewable exception and repository override inputs", async () => {
    const ajv = await createValidator();
    const exceptionLedger = {
      entries: [
        {
          createdBy: "@maintainer",
          createdOn: "2026-11-22",
          exceptionId: "temporary-docs-exception",
          expiresOn: "2027-01-15",
          owner: "@docs-team",
          rationale: "The generated reference is replaced next quarter.",
          reference: "https://github.com/example/repo/issues/12",
          ruleId: "crux/docs/markdown-format",
          ruleOwner: "canon",
          scope: {
            kind: "paths",
            paths: ["docs/reference.md"],
          },
        },
      ],
      ledgerId: "repository-exceptions",
      schemaVersion: "1.0.0",
    };
    const repositoryPolicy = {
      profileId: "ci",
      repositoryShape: "typescript-package",
      schemaVersion: "1.0.0",
      severityOverrides: [
        {
          owner: "canon",
          rationale: "Migration work is tracked and protected.",
          reference: "https://github.com/example/repo/issues/12",
          ruleId: "crux/docs/markdown-format",
          severity: "warning",
        },
      ],
    };

    expect(
      ajv.getSchema("https://schemas.clockwork-kitten.dev/crux/exception/1")?.(
        exceptionLedger,
      ),
    ).toBe(true);
    expect(
      ajv.getSchema(
        "https://schemas.clockwork-kitten.dev/crux/repository-policy/1",
      )?.(repositoryPolicy),
    ).toBe(true);
    expect(
      ajv.getSchema("https://schemas.clockwork-kitten.dev/crux/exception/1")?.({
        ...exceptionLedger,
        entries: [
          {
            ...exceptionLedger.entries[0],
            verdictState: "expired",
          },
        ],
      }),
    ).toBe(false);
  });

  test("requires each suppression parser to match its sole owner", async () => {
    const ajv = await createValidator();
    const fixture = await readFixture<
      NamedFixture & { owner: string; parserOwner: string }
    >("suppression-registry/wrong-owner.json");
    const validateForm = ajv.getSchema(
      "https://schemas.clockwork-kitten.dev/crux/suppression/1",
    );
    const validateRegistry = ajv.getSchema(
      "https://schemas.clockwork-kitten.dev/crux/suppression-registry/1",
    );

    expect(
      validateRegistry?.({
        forms: [suppressionForm],
        schemaVersion: "1.0.0",
      }),
    ).toBe(true);
    expect(
      validateForm?.({
        ...suppressionForm,
        owner: fixture.owner,
        parser: {
          ...suppressionForm.parser,
          owner: fixture.parserOwner,
        },
      }),
      fixture.name,
    ).toBe(false);
  });
});

describe("migration disposition schema and reconciliation", () => {
  test("accepts one-way diagnostic replacement and drop records", async () => {
    const ajv = await createValidator();
    const ledger = {
      entries: [
        {
          disposition: "replaced",
          legacy: {
            id: "legacy/no-tabs",
            kind: "rule",
          },
          rationale: "The permanent Crux rule supersedes this legacy identity.",
          replacement: {
            id: "crux/code/no-tabs",
            kind: "rule",
            owner: "crucible",
          },
        },
        {
          disposition: "dropped",
          legacy: {
            id: "conform old-check",
            kind: "command",
          },
          rationale: "The old command mixed static and executing checks.",
        },
      ],
      inventoryRevision: 1,
      schemaVersion: "1.0.0",
    };

    expect(
      ajv.getSchema(
        "https://schemas.clockwork-kitten.dev/crux/migration-disposition/1",
      )?.(ledger),
    ).toBe(true);
  });

  test("rejects alias-like execution semantics", async () => {
    const ajv = await createValidator();
    const fixture = await readFixture<AliasFixture>(
      "migration-disposition/alias-like.json",
    );

    expect(
      ajv.getSchema(
        "https://schemas.clockwork-kitten.dev/crux/migration-disposition/1",
      )?.({
        entries: [fixture.entry],
        inventoryRevision: 1,
        schemaVersion: "1.0.0",
      }),
      fixture.name,
    ).toBe(false);
  });

  test("reports duplicate, missing, and unknown inventory dispositions", async () => {
    const duplicate = await readFixture<MigrationFixture>(
      "migration-disposition/duplicate.json",
    );
    const missing = await readFixture<MigrationFixture>(
      "migration-disposition/missing.json",
    );
    const unknown = await readFixture<MigrationFixture>(
      "migration-disposition/unknown.json",
    );

    expect(
      validateMigrationDispositions(duplicate.inventory, duplicate.entries),
      duplicate.name,
    ).toEqual([
      {
        code: "duplicate-disposition",
        identity: "rule:legacy/no-tabs",
      },
    ]);
    expect(
      validateMigrationDispositions(missing.inventory, missing.entries),
      missing.name,
    ).toEqual([
      {
        code: "missing-disposition",
        identity: "command:conform legacy-check",
      },
    ]);
    expect(
      validateMigrationDispositions(unknown.inventory, unknown.entries),
      unknown.name,
    ).toEqual([
      {
        code: "missing-disposition",
        identity: "rule:legacy/no-tabs",
      },
      {
        code: "unknown-disposition",
        identity: "rule:legacy/unknown-rule",
      },
    ]);
  });
});
