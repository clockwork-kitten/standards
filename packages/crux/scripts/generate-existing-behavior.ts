import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

import {
  CONFORM_INVENTORY_SOURCE,
  CONFORM_LEGACY_REVISION,
  fetchPinnedJson,
} from "./existing-behavior-provenance.js";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHECK_FLAG = "--check";
const SCHEMA_VERSION = "1.0.0";
const POLICY_VERSION = "0.1.0";
const INTRODUCED = { date: "2026-11-22", version: POLICY_VERSION };
const CANON_REVISION = "7717e5baacb514ae6085e4c3bef026a371df7d08";
const BEDROCK_REVISION = "3f7035d1c9b11cef83e30d450e463ee84106d525";
const CONFORM_REVISION = CONFORM_INVENTORY_SOURCE.revision;

type BedrockConsumerInventory = {
  results: {
    classification: string;
    disposition: string;
    path: string;
    queryId: string;
    repository: string;
    revision: string;
  }[];
};
type BedrockInventory = {
  detectors: BedrockInventoryItem[];
  fixers: BedrockInventoryItem[];
  reporterIds: BedrockInventoryItem[];
  rules: (BedrockInventoryItem & { legacyRuleId: string })[];
  surfaces: BedrockInventoryItem[];
};

type BedrockInventoryItem = {
  disposition?: string;
  id: string;
  rationale: string;
};

type CanonInventory = {
  consumers: { repository: string }[];
  pullRequests: {
    number: number;
    rationale: string;
    repository: string;
  }[];
  surfaces: {
    id: string;
    migration: string;
    observed: string;
  }[];
};

type ConformInventory = {
  [section: string]: unknown;
  commands: ConformInventoryItem[];
  configSurfaces: ConformInventoryItem[];
};

type ConformInventoryItem = {
  id?: string;
  migration: {
    difference?: string;
    kind: "destination" | "intentional-difference";
    rationale: string;
    target: string;
  };
  name?: string;
};

type Engine = "canon" | "conform" | "crucible";

type GeneratedVector = {
  engine: Engine;
  expectedOutcome: "fail" | "pass";
  expectedOwners?: Record<string, Engine>;
  fixture: {
    content: string;
    description: string;
    fileClass: "documentation" | "source";
    path: string;
  };
  kind: "boundary" | "negative" | "positive";
  ruleIds: string[];
  sourceInventoryIds: string[];
  vectorId: string;
};

type LegacyKind = "command" | "config-key" | "rule" | "suppression";

type RuleSeed = {
  aspect: string;
  fileClass: "documentation" | "source";
  legacyIds: string[];
  owner: Engine;
  ruleId: string;
  summary: string;
  title: string;
};

type SourceRow = {
  disposition: string;
  inventoryId: string;
  migration?: {
    disposition: "dropped" | "replaced";
    intentionalDifference?: string;
    replacement?: {
      id: string;
      kind: LegacyKind;
      owner: Engine;
    };
    target: string;
  };
  owner?: Engine;
  rationale: string;
  reference?: string;
  ruleId?: string;
  section: string;
  sourceId: string;
};

const RULE_SEEDS: RuleSeed[] = [
  {
    aspect: "markdown-format",
    fileClass: "documentation",
    legacyIds: ["docs.markdown"],
    owner: "canon",
    ruleId: "crux/docs/markdown-format",
    summary: "Documentation follows the canonical Markdown format.",
    title: "Canonical Markdown format",
  },
  {
    aspect: "reference-integrity",
    fileClass: "documentation",
    legacyIds: ["docs.references"],
    owner: "canon",
    ruleId: "crux/docs/reference-integrity",
    summary:
      "Documentation references resolve within the declared repository scope.",
    title: "Documentation reference integrity",
  },
  {
    aspect: "llms-index",
    fileClass: "documentation",
    legacyIds: ["docs.llms"],
    owner: "canon",
    ruleId: "crux/docs/llms-index",
    summary: "The generated llms.txt index matches canonical documentation.",
    title: "Canonical llms.txt index",
  },
  {
    aspect: "strict-equality",
    fileClass: "source",
    legacyIds: ["equality"],
    owner: "crucible",
    ruleId: "crux/code/strict-equality",
    summary: "Source uses strict equality operators.",
    title: "Require strict equality",
  },
  {
    aspect: "explicit-any",
    fileClass: "source",
    legacyIds: ["no-any"],
    owner: "crucible",
    ruleId: "crux/code/no-explicit-any",
    summary: "TypeScript source does not use explicit any.",
    title: "Disallow explicit any",
  },
  {
    aspect: "array-construction",
    fileClass: "source",
    legacyIds: ["no-array-constructor"],
    owner: "crucible",
    ruleId: "crux/code/no-array-constructor",
    summary: "Source uses array literals instead of Array constructors.",
    title: "Disallow Array constructors",
  },
  {
    aspect: "catch-variable-type",
    fileClass: "source",
    legacyIds: ["no-bare-catch"],
    owner: "crucible",
    ruleId: "crux/code/unknown-catch-variable",
    summary: "Catch variables are treated as unknown.",
    title: "Use unknown catch variables",
  },
  {
    aspect: "object-ownership-check",
    fileClass: "source",
    legacyIds: ["no-has-own-property"],
    owner: "crucible",
    ruleId: "crux/code/prefer-object-has-own",
    summary: "Source uses Object.hasOwn for ownership checks.",
    title: "Prefer Object.hasOwn",
  },
  {
    aspect: "array-sort-mutation",
    fileClass: "source",
    legacyIds: ["no-mutating-sort"],
    owner: "crucible",
    ruleId: "crux/code/non-mutating-sort",
    summary: "Source avoids mutating array sort operations.",
    title: "Require non-mutating array sorting",
  },
  {
    aspect: "typescript-namespace",
    fileClass: "source",
    legacyIds: ["no-namespace"],
    owner: "crucible",
    ruleId: "crux/code/no-typescript-namespace",
    summary: "TypeScript source does not declare namespaces.",
    title: "Disallow TypeScript namespaces",
  },
  {
    aspect: "non-null-assertion",
    fileClass: "source",
    legacyIds: ["no-non-null-assertion"],
    owner: "crucible",
    ruleId: "crux/code/no-non-null-assertion",
    summary: "TypeScript source does not use non-null assertions.",
    title: "Disallow non-null assertions",
  },
  {
    aspect: "sparse-array",
    fileClass: "source",
    legacyIds: ["no-sparse-arrays"],
    owner: "crucible",
    ruleId: "crux/code/no-sparse-arrays",
    summary: "Source does not create sparse array literals.",
    title: "Disallow sparse arrays",
  },
  {
    aspect: "var-declaration",
    fileClass: "source",
    legacyIds: ["no-var"],
    owner: "crucible",
    ruleId: "crux/code/no-var",
    summary: "Source does not declare variables with var.",
    title: "Disallow var declarations",
  },
  {
    aspect: "function-return-type",
    fileClass: "source",
    legacyIds: ["require-return-type"],
    owner: "crucible",
    ruleId: "crux/code/explicit-return-type",
    summary: "Exported functions declare explicit return types.",
    title: "Require explicit function return types",
  },
  {
    aspect: "const-declaration",
    fileClass: "source",
    legacyIds: ["var-to-const"],
    owner: "crucible",
    ruleId: "crux/code/prefer-const",
    summary: "Variables that are never reassigned use const.",
    title: "Prefer const declarations",
  },
];

const BEDROCK_RULE_MAP = new Map(
  RULE_SEEDS.flatMap((seed) =>
    seed.legacyIds.map((legacyId) => [legacyId, seed] as const),
  ),
);

const DETECTOR_RULE_MAP = new Map<string, RuleSeed>([
  ["detectAnyType", requiredRule("no-any")],
  ["detectArrayConstructor", requiredRule("no-array-constructor")],
  ["detectBareCatch", requiredRule("no-bare-catch")],
  ["detectMissingReturnType", requiredRule("require-return-type")],
  ["detectNamespace", requiredRule("no-namespace")],
  ["detectNonNullAssertion", requiredRule("no-non-null-assertion")],
]);

const FIXER_RULE_MAP = new Map<string, RuleSeed>([
  ["equalityToStrict", requiredRule("equality")],
  ["transformHasOwnProperty", requiredRule("no-has-own-property")],
  ["transformSort", requiredRule("no-mutating-sort")],
  ["transformSparseArrays", requiredRule("no-sparse-arrays")],
  ["varToConst", requiredRule("var-to-const")],
]);

const FIXTURE_CONTENT = new Map<string, { fail: string; pass: string }>([
  [
    "crux/code/explicit-return-type",
    {
      fail: "export function value() { return 1; }",
      pass: "export function value(): number { return 1; }",
    },
  ],
  [
    "crux/code/no-array-constructor",
    { fail: "const values = new Array();", pass: "const values = [];" },
  ],
  [
    "crux/code/no-explicit-any",
    { fail: "const value: any = 1;", pass: "const value: unknown = 1;" },
  ],
  [
    "crux/code/no-non-null-assertion",
    { fail: "value!.name;", pass: "value?.name;" },
  ],
  [
    "crux/code/no-sparse-arrays",
    { fail: "const values = [1,,3];", pass: "const values = [1, 2, 3];" },
  ],
  [
    "crux/code/no-typescript-namespace",
    { fail: "namespace Example {}", pass: "export const example = {};" },
  ],
  ["crux/code/no-var", { fail: "var value = 1;", pass: "let value = 1;" }],
  [
    "crux/code/non-mutating-sort",
    { fail: "values.sort();", pass: "values.toSorted();" },
  ],
  [
    "crux/code/prefer-const",
    { fail: "let value = 1;", pass: "const value = 1;" },
  ],
  [
    "crux/code/prefer-object-has-own",
    { fail: "value.hasOwnProperty(key);", pass: "Object.hasOwn(value, key);" },
  ],
  ["crux/code/strict-equality", { fail: "a == b;", pass: "a === b;" }],
  [
    "crux/code/unknown-catch-variable",
    {
      fail: "try {} catch (error: any) {}",
      pass: "try {} catch (error: unknown) {}",
    },
  ],
  [
    "crux/docs/llms-index",
    { fail: "# stale\n", pass: "# Project\n\nSummary\n" },
  ],
  ["crux/docs/markdown-format", { fail: "plain text", pass: "# Heading\n" }],
  [
    "crux/docs/reference-integrity",
    { fail: "[missing](missing.md)", pass: "[readme](README.md)" },
  ],
]);

function bedrockRow(
  section: string,
  inventoryId: string,
  value: BedrockInventoryItem,
  mapped?: RuleSeed,
): SourceRow {
  return {
    disposition: mapped === undefined ? "dropped" : "mapped-rule",
    inventoryId,
    owner: mapped?.owner,
    rationale:
      mapped === undefined
        ? value.rationale
        : "The reviewed Bedrock concept maps to one permanent Crucible-owned Crux rule; legacy IDs remain diagnostic-only.",
    reference:
      "https://github.com/clockwork-kitten/bedrock/blob/3f7035d1c9b11cef83e30d450e463ee84106d525/docs/bedrock-disposition.json",
    ruleId: mapped?.ruleId,
    section,
    sourceId: "bedrock",
  };
}

function compareRows(left: SourceRow, right: SourceRow): number {
  return (
    left.sourceId.localeCompare(right.sourceId) ||
    left.section.localeCompare(right.section) ||
    left.inventoryId.localeCompare(right.inventoryId)
  );
}

function createLegacyIdentities(
  conform: ConformInventory,
  bedrock: BedrockInventory,
) {
  const identities: { id: string; kind: LegacyKind }[] = [];
  for (const command of conform.commands) {
    if (command.id === undefined) {
      throw new Error("Conform command row has no identity");
    }
    identities.push({ id: command.id, kind: "command" });
  }
  for (const config of conform.configSurfaces) {
    if (config.id?.startsWith("config.key.")) {
      identities.push({ id: config.id, kind: "config-key" });
    }
  }
  for (const command of [
    "check",
    "fix",
    "llms",
    "add-decision",
    "drain",
    "build",
  ]) {
    identities.push({ id: `canon ${command}`, kind: "command" });
  }
  identities.push({ id: "canon.config.ts", kind: "config-key" });
  for (const rule of bedrock.rules) {
    identities.push({ id: rule.legacyRuleId, kind: "rule" });
  }
  for (const reporter of bedrock.reporterIds) {
    identities.push({ id: reporter.id, kind: "rule" });
  }
  return new Map(
    identities.map((identity) => [`${identity.kind}:${identity.id}`, identity]),
  )
    .values()
    .toArray();
}

function createMigration(
  reconciliation: ReturnType<typeof createReconciliation>,
  bedrock: BedrockInventory,
) {
  const bedrockRules = new Map(
    bedrock.rules.map((rule) => [rule.legacyRuleId, rule]),
  );
  const entries = reconciliation.legacyIdentities.map(
    (legacy: { id: string; kind: LegacyKind }) => {
      if (legacy.kind === "rule") {
        const mapped = BEDROCK_RULE_MAP.get(legacy.id);
        if (mapped !== undefined) {
          return {
            disposition: "replaced",
            legacy,
            rationale:
              "The permanent Crux identity replaces this legacy Bedrock ID for migration diagnostics only; no alias executes the old semantics.",
            replacement: {
              id: mapped.ruleId,
              kind: "rule",
              owner: mapped.owner,
            },
          };
        }
        return {
          disposition: "dropped",
          legacy,
          rationale:
            bedrockRules.get(legacy.id)?.rationale ??
            "The coarse Bedrock reporter identity is retired without an alias.",
        };
      }
      if (legacy.kind === "config-key" && legacy.id.startsWith("config.key.")) {
        const row = reconciliation.rows.find(
          (candidate) =>
            candidate.sourceId === "conform" &&
            candidate.inventoryId === legacy.id,
        );
        if (row?.migration === undefined) {
          throw new Error(
            `Missing reconciled migration decision for ${legacy.id}`,
          );
        }
        if (row.migration.disposition === "dropped") {
          return {
            disposition: "dropped",
            intentionalDifference: row.migration.intentionalDifference,
            legacy,
            rationale: row.rationale,
            target: row.migration.target,
          };
        }
        if (row.migration.replacement === undefined) {
          throw new Error(`Missing reconciled replacement for ${legacy.id}`);
        }
        return {
          disposition: "replaced",
          legacy,
          rationale:
            "This replacement is diagnostic migration data only and never authorizes config translation or compatibility aliases.",
          replacement: row.migration.replacement,
          target: row.migration.target,
        };
      }
      const owner: Engine =
        legacy.id.startsWith("canon ") || legacy.id === "canon.config.ts"
          ? "canon"
          : "conform";
      const replacementId =
        legacy.id === "canon.config.ts"
          ? "canon.config.jsonc"
          : legacy.id.startsWith("config.key.")
            ? legacy.id.replace("config.key.", "repository.")
            : legacy.id;
      return {
        disposition: "replaced",
        legacy,
        rationale:
          "This replacement is diagnostic migration data only and never authorizes command execution, config translation, or compatibility aliases.",
        replacement: { id: replacementId, kind: legacy.kind, owner },
      };
    },
  );
  return {
    entries,
    inventoryRevision: 1,
    schemaVersion: SCHEMA_VERSION,
  };
}

function createPolicy(rules: ReturnType<typeof createRule>[]): unknown {
  return {
    controlledTokens: [],
    extensions: {
      "crux.provenance": {
        authority: "clockwork-kitten/studio-board#96",
        bedrockRevision: BEDROCK_REVISION,
        canonRevision: CANON_REVISION,
        conformLegacyRevision: CONFORM_LEGACY_REVISION,
        conformRevision: CONFORM_REVISION,
      },
    },
    fileClassRules: [
      {
        exclude: ["**/generated/**", "**/vendor/**"],
        fileClass: "documentation",
        include: ["**/*.md", "llms.txt"],
      },
      {
        exclude: ["**/*.test.*", "**/generated/**", "**/vendor/**"],
        fileClass: "source",
        include: ["src/**/*.{js,jsx,ts,tsx}"],
      },
      {
        exclude: ["**/generated/**", "**/vendor/**"],
        fileClass: "test",
        include: ["**/*.test.{js,jsx,ts,tsx}", "test/**"],
      },
      {
        exclude: ["**/generated/**", "**/vendor/**"],
        fileClass: "tool-config",
        include: [
          "*.config.{js,mjs,cjs,ts,mts,cts,json,jsonc}",
          "tsconfig*.json",
        ],
      },
      {
        exclude: ["**/generated/**", "**/vendor/**"],
        fileClass: "repository-metadata",
        include: [".github/**", ".conform/**", "package.json"],
      },
      {
        exclude: ["**/vendor/**"],
        fileClass: "generated",
        include: ["**/generated/**"],
      },
      {
        exclude: [],
        fileClass: "vendored",
        include: ["**/vendor/**", "**/node_modules/**"],
      },
    ],
    policyId: "existing-behavior",
    policyVersion: POLICY_VERSION,
    profiles: [
      {
        agentOutputLimits: {
          neverTruncateIntegrity: true,
          neverTruncateProtectedReview: true,
          ordinaryFindingCount: 50,
          totalBytes: 65_536,
        },
        allowedCheckKinds: ["static"],
        ci: true,
        evidenceLimits: { perFindingBytes: 4096, totalBytes: 65_536 },
        fix: { engineOrder: [], maxPasses: 0, writableFileClasses: {} },
        profileId: "static",
        schemaVersion: SCHEMA_VERSION,
      },
      {
        agentOutputLimits: {
          neverTruncateIntegrity: true,
          neverTruncateProtectedReview: true,
          ordinaryFindingCount: 50,
          totalBytes: 65_536,
        },
        allowedCheckKinds: ["static", "executing"],
        ci: true,
        evidenceLimits: { perFindingBytes: 4096, totalBytes: 65_536 },
        fix: {
          engineOrder: ["conform", "canon", "crucible"],
          maxPasses: 3,
          writableFileClasses: {
            canon: ["documentation"],
            conform: ["repository-metadata"],
            crucible: ["source", "test", "tool-config"],
          },
        },
        profileId: "full",
        schemaVersion: SCHEMA_VERSION,
      },
    ],
    rules,
    schemaVersion: SCHEMA_VERSION,
    studioGlossary: [
      {
        definition:
          "The sole Canon, Crucible, or Conform engine responsible for implementing and reporting a rule.",
        term: "engine owner",
      },
      {
        definition:
          "A one-way migration message for a known legacy input; it never executes or translates legacy semantics.",
        term: "diagnostic replacement",
      },
      {
        definition:
          "The file class, aspect, check kind, and domain combination that admits exactly one engine owner.",
        term: "ownership tuple",
      },
    ],
    suppressions: [],
  };
}

function createReconciliation(
  conform: ConformInventory,
  canon: CanonInventory,
  bedrock: BedrockInventory,
  bedrockConsumers: BedrockConsumerInventory,
) {
  const rows: SourceRow[] = [];
  for (const [section, values] of Object.entries(conform)) {
    if (!Array.isArray(values)) continue;
    for (const value of values as ConformInventoryItem[]) {
      const inventoryId = value.id ?? value.name;
      if (inventoryId === undefined) {
        throw new Error(`Conform ${section} row has no identity`);
      }
      const target = value.migration.target as string;
      const isDifference = value.migration.kind === "intentional-difference";
      const owner = ownerFromTarget(target);
      const replacement =
        section === "configSurfaces" && inventoryId.startsWith("config.key.")
          ? {
              id: inventoryId.replace("config.key.", "repository."),
              kind: "config-key" as const,
              owner,
            }
          : undefined;
      rows.push({
        disposition:
          isDifference && target.includes("Bedrock")
            ? "non-mvp-deferral"
            : isDifference
              ? "intentional-difference"
              : isDiagnosticConformRow(section, inventoryId)
                ? "diagnostic-replacement"
                : "mapped-owner",
        inventoryId,
        migration:
          replacement === undefined
            ? undefined
            : isDifference
              ? {
                  disposition: "dropped",
                  intentionalDifference: value.migration.difference,
                  target,
                }
              : {
                  disposition: "replaced",
                  replacement,
                  target,
                },
        owner,
        rationale: value.migration.rationale,
        reference: `https://github.com/clockwork-kitten/standards/blob/${CONFORM_REVISION}/packages/conform/inventory/legacy-conform.json`,
        section: kebab(section),
        sourceId: "conform",
      });
    }
  }
  for (const surface of canon.surfaces) {
    const rule = RULE_SEEDS.find((seed) => seed.legacyIds.includes(surface.id));
    rows.push({
      disposition:
        rule === undefined
          ? surface.migration.includes("replace") ||
            surface.migration.includes("intentional-gap")
            ? "intentional-difference"
            : "mapped-owner"
          : "mapped-rule",
      inventoryId: surface.id,
      owner: "canon",
      rationale: surface.observed,
      reference:
        "https://github.com/clockwork-kitten/canon/blob/7717e5baacb514ae6085e4c3bef026a371df7d08/test/characterization/canon-v0.1.0/ledger.json",
      ruleId: rule?.ruleId,
      section: "surfaces",
      sourceId: "canon",
    });
  }
  for (const consumer of canon.consumers) {
    rows.push({
      disposition: "non-mvp-deferral",
      inventoryId: consumer.repository,
      rationale:
        "The known consumer requires an explicit repo-local cutover before the legacy line retires.",
      reference:
        "https://github.com/clockwork-kitten/canon/blob/7717e5baacb514ae6085e4c3bef026a371df7d08/test/characterization/canon-v0.1.0/ledger.json",
      section: "consumers",
      sourceId: "canon",
    });
  }
  for (const pullRequest of canon.pullRequests) {
    rows.push({
      disposition: "intentional-difference",
      inventoryId: `${pullRequest.repository}#${pullRequest.number}`,
      rationale: pullRequest.rationale,
      reference: `https://github.com/${pullRequest.repository}/pull/${pullRequest.number}`,
      section: "pull-requests",
      sourceId: "canon",
    });
  }
  for (const rule of bedrock.rules) {
    const mapped = BEDROCK_RULE_MAP.get(rule.legacyRuleId);
    rows.push(bedrockRow("rules", rule.legacyRuleId, rule, mapped));
  }
  for (const reporter of bedrock.reporterIds) {
    rows.push(bedrockRow("reporter-ids", reporter.id, reporter));
  }
  for (const fixer of bedrock.fixers) {
    rows.push(
      bedrockRow("fixers", fixer.id, fixer, FIXER_RULE_MAP.get(fixer.id)),
    );
  }
  for (const detector of bedrock.detectors) {
    rows.push(
      bedrockRow(
        "detectors",
        detector.id,
        detector,
        DETECTOR_RULE_MAP.get(detector.id),
      ),
    );
  }
  for (const surface of bedrock.surfaces) {
    rows.push(bedrockRow("surfaces", surface.id, surface));
  }
  for (const result of bedrockConsumers.results) {
    rows.push({
      disposition:
        result.classification === "functional-consumer"
          ? "non-mvp-deferral"
          : "dropped",
      inventoryId: `${result.queryId}:${result.repository}:${result.path}`,
      rationale: result.disposition,
      reference: `https://github.com/${result.repository}/blob/${result.revision}/${result.path}`,
      section: "results",
      sourceId: "bedrock-consumers",
    });
  }
  const legacyIdentities = createLegacyIdentities(conform, bedrock);
  return {
    legacyIdentities: legacyIdentities.toSorted((left, right) =>
      `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`),
    ),
    revision: 1,
    rows: rows.toSorted(compareRows),
    schemaVersion: SCHEMA_VERSION,
    sources: [
      {
        ...CONFORM_INVENTORY_SOURCE,
        expectedRows: 108,
      },
      {
        artifact: "test/characterization/canon-v0.1.0/ledger.json",
        expectedRows: 11,
        repository: "clockwork-kitten/canon",
        revision: CANON_REVISION,
        sourceId: "canon",
      },
      {
        artifact: "docs/bedrock-disposition.json",
        expectedRows: 181,
        repository: "clockwork-kitten/bedrock",
        revision: BEDROCK_REVISION,
        sourceId: "bedrock",
      },
      {
        artifact: "docs/bedrock-consumers.json",
        expectedRows: 25,
        repository: "clockwork-kitten/bedrock",
        revision: BEDROCK_REVISION,
        sourceId: "bedrock-consumers",
      },
    ],
  };
}

function createRule(seed: RuleSeed) {
  const slug = seed.ruleId.split("/").at(-1);
  if (slug === undefined) {
    throw new Error(`Invalid rule ID: ${seed.ruleId}`);
  }
  return {
    aspect: seed.aspect,
    checkKind: "static" as const,
    defaultSeverity: "info",
    domains:
      seed.owner === "canon"
        ? ["documentation.markdown"]
        : ["source.typescript"],
    extensions: {
      "crux.provenance": {
        legacyIds: seed.legacyIds,
      },
    },
    fileClass: seed.fileClass,
    fix: {
      kind: "none",
      maxPasses: 0,
      writableFileClasses: [],
    },
    implementation: {
      adapterRequirements: [],
      capabilities:
        seed.owner === "canon"
          ? ["markdown-analysis"]
          : ["typescript-analysis"],
    },
    introduced: INTRODUCED,
    lifecycle: "proposed",
    owner: seed.owner,
    promotion: {
      condition:
        "Promote only after the published owner manifest declares this rule and every committed vector passes, including an inverted expected-outcome failure.",
      falsePositiveCeiling: 0,
    },
    rationale: `${seed.summary} This permanent identity preserves the reviewed behavior concept without retaining a legacy runtime alias.`,
    remediation: `Update the ${seed.fileClass} content to satisfy ${seed.title.toLowerCase()}.`,
    ruleId: seed.ruleId,
    schemaVersion: SCHEMA_VERSION,
    selectors: {
      exclude: ["**/generated/**", "**/vendor/**"],
      include:
        seed.fileClass === "documentation"
          ? ["**/*.md", "llms.txt"]
          : ["src/**/*.{js,jsx,ts,tsx}"],
      repositoryShapes: ["typescript-package"],
    },
    summary: seed.summary,
    suppressionFormIds: [],
    title: seed.title,
    topInvariant: false,
    vectors: [
      {
        engine: seed.owner,
        expectedOutcome: "pass",
        kind: "positive",
        vectorId: `${slug}-pass`,
      },
      {
        engine: seed.owner,
        expectedOutcome: "fail",
        kind: "negative",
        vectorId: `${slug}-fail`,
      },
    ],
  };
}

function createVectorCatalogs(rules: ReturnType<typeof createRule>[]) {
  const byEngine = (engine: Engine) => ({
    engine,
    schemaVersion: SCHEMA_VERSION,
    sourceRevision:
      engine === "canon"
        ? CANON_REVISION
        : engine === "crucible"
          ? BEDROCK_REVISION
          : CONFORM_REVISION,
    vectors: rules
      .filter((rule) => rule.owner === engine)
      .flatMap((rule) => {
        const fixture = FIXTURE_CONTENT.get(rule.ruleId);
        if (fixture === undefined) {
          throw new Error(`Missing fixture content for ${rule.ruleId}`);
        }
        const legacyIds = (
          rule.extensions["crux.provenance"] as { legacyIds: string[] }
        ).legacyIds;
        return rule.vectors.map((vector) => ({
          ...vector,
          fixture: {
            content:
              vector.expectedOutcome === "pass" ? fixture.pass : fixture.fail,
            description: `${vector.kind} fixture for ${rule.title}.`,
            fileClass: rule.fileClass,
            path:
              rule.fileClass === "documentation"
                ? `docs/${vector.vectorId}.md`
                : `src/${vector.vectorId}.ts`,
          },
          ruleIds: [rule.ruleId],
          sourceInventoryIds: legacyIds,
        }));
      }) as GeneratedVector[],
  });
  const canon = byEngine("canon");
  const crucible = byEngine("crucible");
  canon.vectors.push({
    engine: "canon",
    expectedOutcome: "pass",
    expectedOwners: { "crux/docs/markdown-format": "canon" },
    fixture: {
      content: "# Example\n\n```ts\nconst value: any = 1;\n```\n",
      description:
        "A Markdown file containing a TypeScript fence remains Canon-owned because embedded content follows the host file class.",
      fileClass: "documentation",
      path: "docs/example.md",
    },
    kind: "boundary",
    ruleIds: ["crux/docs/markdown-format"],
    sourceInventoryIds: ["docs.markdown"],
    vectorId: "documentation-source-boundary",
  });
  crucible.vectors.push({
    engine: "crucible",
    expectedOutcome: "pass",
    expectedOwners: { "crux/code/no-explicit-any": "crucible" },
    fixture: {
      content: "// [missing](missing.md)\nconst value: unknown = 1;\n",
      description:
        "A source comment containing Markdown-like text remains Crucible-owned because the host file class is source.",
      fileClass: "source",
      path: "src/example.ts",
    },
    kind: "boundary",
    ruleIds: ["crux/code/no-explicit-any"],
    sourceInventoryIds: ["no-any"],
    vectorId: "source-documentation-boundary",
  });
  return { canon, conform: byEngine("conform"), crucible };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function isDiagnosticConformRow(section: string, inventoryId: string): boolean {
  return (
    section === "commands" ||
    (section === "configSurfaces" && inventoryId.startsWith("config.key."))
  );
}

function kebab(value: string): string {
  return value.replaceAll(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

async function main(): Promise<void> {
  const [conform, canon, bedrock, bedrockConsumers] = await Promise.all([
    fetchPinnedJson<ConformInventory>(CONFORM_INVENTORY_SOURCE),
    fetchJson<CanonInventory>(
      `https://raw.githubusercontent.com/clockwork-kitten/canon/${CANON_REVISION}/test/characterization/canon-v0.1.0/ledger.json`,
    ),
    fetchJson<BedrockInventory>(
      `https://raw.githubusercontent.com/clockwork-kitten/bedrock/${BEDROCK_REVISION}/docs/bedrock-disposition.json`,
    ),
    fetchJson<BedrockConsumerInventory>(
      `https://raw.githubusercontent.com/clockwork-kitten/bedrock/${BEDROCK_REVISION}/docs/bedrock-consumers.json`,
    ),
  ]);

  const rules = RULE_SEEDS.map((seed) => createRule(seed));
  const catalogs = createVectorCatalogs(rules);
  const reconciliation = createReconciliation(
    conform,
    canon,
    bedrock,
    bedrockConsumers,
  );
  const migration = createMigration(reconciliation, bedrock);
  const outputs = new Map<string, unknown>([
    ["migration/legacy-disposition.json", migration],
    ["policy/existing-behavior.json", createPolicy(rules)],
    ["reconciliation/existing-behavior.json", reconciliation],
    ["vectors/canon.json", catalogs.canon],
    ["vectors/conform.json", catalogs.conform],
    ["vectors/crucible.json", catalogs.crucible],
  ]);

  const stale: string[] = [];
  for (const [relativePath, value] of outputs) {
    const path = join(PACKAGE_ROOT, relativePath);
    const content = await format(JSON.stringify(value), { parser: "json" });
    if (process.argv.includes(CHECK_FLAG)) {
      const committed = await readIfExists(path);
      if (committed !== content) {
        stale.push(relativePath);
      }
    } else {
      await mkdir(join(path, ".."), { recursive: true });
      await writeFile(path, content);
    }
  }
  if (stale.length > 0) {
    throw new Error(`Existing-behavior data is stale: ${stale.join(", ")}`);
  }
}

function ownerFromTarget(target: string): Engine {
  if (target.includes("Canon") || target.includes("docs")) return "canon";
  if (
    target.includes("Crucible") ||
    target.includes("code") ||
    target.includes("tool")
  ) {
    return "crucible";
  }
  return "conform";
}

async function readIfExists(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function requiredRule(legacyId: string): RuleSeed {
  const rule = BEDROCK_RULE_MAP.get(legacyId);
  if (rule === undefined) throw new Error(`Unknown rule mapping: ${legacyId}`);
  return rule;
}

await main();
