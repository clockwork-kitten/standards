import { expect, test } from "bun:test";

import type { EngineManifest, RuleRecord } from "../types/index.js";

const release = {
  date: "2026-11-22",
  version: "1.0.0",
} as const;

const baseRule = {
  aspect: "content",
  checkKind: "static",
  domains: ["documentation.markdown"],
  fileClass: "documentation",
  implementation: {
    adapterRequirements: [],
    capabilities: ["markdown-parser"],
  },
  introduced: release,
  owner: "canon",
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
  vectors: [
    {
      engine: "canon",
      expectedOutcome: "pass",
      kind: "positive",
      vectorId: "markdown-format-positive",
    },
  ],
} satisfies Pick<
  RuleRecord,
  | "aspect"
  | "checkKind"
  | "domains"
  | "fileClass"
  | "implementation"
  | "introduced"
  | "owner"
  | "rationale"
  | "remediation"
  | "ruleId"
  | "schemaVersion"
  | "selectors"
  | "summary"
  | "suppressionFormIds"
  | "title"
  | "vectors"
>;

const validWarnRule: RuleRecord = {
  ...baseRule,
  defaultSeverity: "warning",
  fix: {
    kind: "bounded",
    maxPasses: 2,
    writableFileClasses: ["documentation"],
  },
  lifecycle: "warn",
  promotion: {
    condition: "All owner vectors pass.",
    falsePositiveCeiling: 0,
  },
  topInvariant: false,
};

const validRemovedRule: RuleRecord = {
  ...baseRule,
  defaultSeverity: "info",
  deprecated: release,
  fix: {
    kind: "none",
    maxPasses: 0,
    writableFileClasses: [],
  },
  lifecycle: "removed",
  removed: release,
  topInvariant: false,
};

const validCanonManifest: EngineManifest = {
  capabilities: ["markdown-parser"],
  commandClasses: ["static"],
  compatibleSchemaMajors: {
    policy: [1],
    profile: [1],
    result: [1],
    rule: [1],
    suppression: [1],
  },
  engine: "canon",
  fixerFileClasses: [],
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
  vectorCoverageIds: ["markdown-format-positive"],
};

// @ts-expect-error removed rules require removal metadata
const invalidRemovedRule: RuleRecord = {
  ...validRemovedRule,
  removed: undefined,
};

// @ts-expect-error removed rules cannot remain errors or top invariants
const invalidRemovedState: RuleRecord = {
  ...validRemovedRule,
  defaultSeverity: "error",
  topInvariant: true,
};

// @ts-expect-error engine manifests cannot claim another engine package
const invalidCanonManifest: EngineManifest = {
  ...validCanonManifest,
  package: {
    ...validCanonManifest.package,
    name: "@clockwork-kitten/conform",
  },
};

const invalidNoFix: RuleRecord = {
  ...validWarnRule,
  // @ts-expect-error non-fixing rules have exactly zero passes
  fix: {
    kind: "none",
    maxPasses: 1,
    writableFileClasses: [],
  },
};

const invalidBoundedFix: RuleRecord = {
  ...validWarnRule,
  // @ts-expect-error bounded fixes require a writable file class
  fix: {
    kind: "bounded",
    maxPasses: 1,
    writableFileClasses: [],
  },
};

void invalidBoundedFix;
void invalidCanonManifest;
void invalidNoFix;
void invalidRemovedRule;
void invalidRemovedState;
void validRemovedRule;
void validWarnRule;

test("valid declaration fixtures retain their lifecycle discriminants", () => {
  expect(validWarnRule.lifecycle).toBe("warn");
  expect(validRemovedRule.lifecycle).toBe("removed");
  expect(validCanonManifest.package.name).toBe("@clockwork-kitten/canon");
});
