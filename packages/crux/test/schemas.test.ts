import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA_DIRECTORY = join(PACKAGE_ROOT, "schemas");
const SCHEMA_FILES = [
  "rule.schema.json",
  "suppression.schema.json",
  "suppression-registry.schema.json",
  "profile.schema.json",
  "policy.schema.json",
  "engine-manifest.schema.json",
  "fingerprint.schema.json",
  "baseline.schema.json",
  "exception.schema.json",
  "repository-policy.schema.json",
  "migration-disposition.schema.json",
  "inventory-reconciliation.schema.json",
  "vector-catalog.schema.json",
  "bundle.schema.json",
  "lock.schema.json",
  "engine-result.schema.json",
  "conform-result.schema.json",
  "context.schema.json",
] as const;
const MANIFEST_SCHEMA_FIXTURE_DIRECTORY = fileURLToPath(
  new URL("fixtures/manifest-schema", import.meta.url),
);

async function createValidator(): Promise<Ajv2020> {
  const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    strict: true,
  });
  addFormats(ajv);
  const schemas = await loadSchemas();
  for (const schema of schemas) {
    ajv.addSchema(schema);
  }
  return ajv;
}

async function loadSchemas(): Promise<Record<string, unknown>[]> {
  return Promise.all(
    SCHEMA_FILES.map(async (schemaFile) => {
      return JSON.parse(
        await readFile(join(SCHEMA_DIRECTORY, schemaFile), "utf8"),
      ) as Record<string, unknown>;
    }),
  );
}

const validRule = {
  aspect: "content",
  checkKind: "static",
  defaultSeverity: "warning",
  domains: ["documentation.markdown"],
  fileClass: "documentation",
  fix: {
    kind: "bounded",
    maxPasses: 2,
    writableFileClasses: ["documentation"],
  },
  implementation: {
    adapterRequirements: [],
    capabilities: ["markdown-parser"],
  },
  introduced: {
    date: "2026-11-22",
    version: "1.0.0",
  },
  lifecycle: "warn",
  owner: "canon",
  promotion: {
    condition: "All owner vectors pass with no known false positives.",
    falsePositiveCeiling: 0,
  },
  rationale: "One format keeps changes reviewable.",
  remediation: "Run the Canon formatter.",
  ruleId: "crux/docs/markdown-format",
  schemaVersion: "1.0.0",
  selectors: {
    exclude: ["vendor/**"],
    include: ["**/*.md"],
    repositoryShapes: ["typescript-package"],
  },
  summary: "Markdown follows the canonical format.",
  suppressionFormIds: ["markdown-directive"],
  title: "Format Markdown",
  topInvariant: false,
  vectors: [
    {
      engine: "canon",
      expectedOutcome: "pass",
      kind: "positive",
      vectorId: "markdown-format-positive",
    },
    {
      engine: "canon",
      expectedOutcome: "fail",
      kind: "negative",
      vectorId: "markdown-format-negative",
    },
  ],
} as const;

const validSuppression = {
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
} as const;

const validProfile = {
  agentOutputLimits: {
    neverTruncateIntegrity: true,
    neverTruncateProtectedReview: true,
    ordinaryFindingCount: 50,
    totalBytes: 65_536,
  },
  allowedCheckKinds: ["static"],
  ci: true,
  evidenceLimits: {
    perFindingBytes: 4096,
    totalBytes: 65_536,
  },
  fix: {
    engineOrder: ["canon", "crucible", "conform"],
    maxPasses: 2,
    writableFileClasses: {
      canon: ["documentation"],
      conform: ["repository-metadata"],
      crucible: ["source", "test", "tool-config"],
    },
  },
  profileId: "ci",
  schemaVersion: "1.0.0",
} as const;

type EnginePackageFixture = {
  fixtureRevision: number;
  name: string;
  pairs: {
    engine: "canon" | "conform" | "crucible";
    packageName: string;
  }[];
};

const validManifest = {
  capabilities: ["markdown-parser"],
  commandClasses: ["static", "fix"],
  compatibleSchemaMajors: {
    policy: [1],
    profile: [1],
    result: [1],
    rule: [1],
    suppression: [1],
  },
  engine: "canon",
  fixerFileClasses: ["documentation"],
  implementedRuleIds: ["crux/docs/markdown-format"],
  manifestHash: "0".repeat(64),
  package: {
    integrity: "sha512-YQ==",
    name: "@clockwork-kitten/canon",
    version: "1.0.0",
  },
  schemaVersion: "1.0.0",
  supportedResultMinors: {
    "1": [0],
  },
  vectorCoverageIds: ["markdown-format-negative", "markdown-format-positive"],
} as const;

describe("authoritative schemas", () => {
  test("self-validate and accept complete records", async () => {
    const ajv = await createValidator();
    const policy = {
      controlledTokens: [],
      fileClassRules: [
        {
          exclude: ["vendor/**"],
          fileClass: "documentation",
          include: ["**/*.md"],
        },
      ],
      policyId: "studio",
      policyVersion: "1.0.0",
      profiles: [validProfile],
      rules: [validRule],
      schemaVersion: "1.0.0",
      studioGlossary: [
        {
          definition: "The sole engine responsible for a rule.",
          term: "owner",
        },
      ],
      suppressions: [validSuppression],
    };
    expect(
      ajv.getSchema("https://schemas.clockwork-kitten.dev/crux/rule/1")?.(
        validRule,
      ),
    ).toBe(true);
    expect(
      ajv.getSchema("https://schemas.clockwork-kitten.dev/crux/policy/1")?.(
        policy,
      ),
    ).toBe(true);
    expect(
      ajv.getSchema(
        "https://schemas.clockwork-kitten.dev/crux/engine-manifest/1",
      )?.(validManifest),
    ).toBe(true);
  });

  test("binds every engine to its exact package identity", async () => {
    const ajv = await createValidator();
    const validateManifest = ajv.getSchema(
      "https://schemas.clockwork-kitten.dev/crux/engine-manifest/1",
    );
    const validFixture = JSON.parse(
      await readFile(
        join(MANIFEST_SCHEMA_FIXTURE_DIRECTORY, "engine-package-valid.json"),
        "utf8",
      ),
    ) as EnginePackageFixture;
    const mismatchFixture = JSON.parse(
      await readFile(
        join(MANIFEST_SCHEMA_FIXTURE_DIRECTORY, "engine-package-mismatch.json"),
        "utf8",
      ),
    ) as EnginePackageFixture;

    expect(validFixture.fixtureRevision, validFixture.name).toBe(1);
    expect(mismatchFixture.fixtureRevision, mismatchFixture.name).toBe(1);
    for (const pair of validFixture.pairs) {
      expect(
        validateManifest?.({
          ...validManifest,
          engine: pair.engine,
          package: {
            ...validManifest.package,
            name: pair.packageName,
          },
        }),
        `${pair.engine} -> ${pair.packageName}`,
      ).toBe(true);
    }
    for (const pair of mismatchFixture.pairs) {
      expect(
        validateManifest?.({
          ...validManifest,
          engine: pair.engine,
          package: {
            ...validManifest.package,
            name: pair.packageName,
          },
        }),
        `${pair.engine} -> ${pair.packageName}`,
      ).toBe(false);
    }
  });

  test("rejects unknown critical fields and invalid owner shapes", async () => {
    const ajv = await createValidator();
    const validateRule = ajv.getSchema(
      "https://schemas.clockwork-kitten.dev/crux/rule/1",
    );

    expect(validateRule?.({ ...validRule, undocumentedAuthority: true })).toBe(
      false,
    );
    const ownerlessRule = Object.fromEntries(
      Object.entries(validRule).filter(([key]) => key !== "owner"),
    );
    expect(validateRule?.(ownerlessRule)).toBe(false);
    expect(validateRule?.({ ...validRule, owner: ["canon", "crucible"] })).toBe(
      false,
    );
  });

  test("permits additive data only under the explicit extensions map", async () => {
    const ajv = await createValidator();
    const validateRule = ajv.getSchema(
      "https://schemas.clockwork-kitten.dev/crux/rule/1",
    );

    expect(
      validateRule?.({
        ...validRule,
        extensions: {
          "example.experimental": {
            enabled: true,
          },
        },
      }),
    ).toBe(true);
  });
});
