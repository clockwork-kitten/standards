import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  CompatibilityBundle,
  ConformResult,
  EngineResult,
  PolicyLock,
} from "../types/index.js";

import {
  validateCompatibilityBundle,
  validateConformResult,
  validateEngineResult,
  validateLockAgainstBundle,
} from "./support/contract-validation.js";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA_DIRECTORY = join(PACKAGE_ROOT, "schemas");
const FIXTURE_DIRECTORY = fileURLToPath(
  new URL("fixtures/contracts", import.meta.url),
);
const SCHEMA_FILES = [
  "rule.schema.json",
  "bundle.schema.json",
  "lock.schema.json",
  "engine-result.schema.json",
  "conform-result.schema.json",
] as const;

type Case = {
  expectedError: string;
  mutation: string;
  name: string;
};

type PositiveFixture = {
  bundle: CompatibilityBundle;
  conformResult: ConformResult;
  engineResult: EngineResult;
  fixtureRevision: number;
  lock: PolicyLock;
};

type RelationalFixture = {
  bundleCases: Case[];
  conformResultCases: Case[];
  engineResultCases: Case[];
  fixtureRevision: number;
  lockCases: Case[];
};

type UnsupportedFixture = {
  fixtureRevision: number;
  observations: {
    environment: EngineResult["environment"];
    name: string;
  }[];
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

async function createValidator(): Promise<Ajv2020> {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const schemaFile of SCHEMA_FILES) {
    ajv.addSchema(await loadJson(join(SCHEMA_DIRECTORY, schemaFile)));
  }
  return ajv;
}

function finding(
  overrides: Partial<EngineResult["findings"][number]> = {},
): EngineResult["findings"][number] {
  return {
    disposition: "active",
    effectiveSeverity: "warning",
    evidence: {
      byteLength: 8,
      identity: "stable evidence",
      redactions: [],
      summary: "Evidence",
      truncated: false,
    },
    fingerprint: {
      occurrenceOrdinal: 1,
      value: "7".repeat(64),
      version: 1,
    },
    fixStatus: "not-fixable",
    kind: "policy",
    lifecycle: "warn",
    location: {
      path: "src/example.ts",
      structuralAnchor: "example",
    },
    owner: "crucible",
    remediation: "Resolve the fixture finding.",
    ruleId: "crux/code/example",
    state: "active",
    ...overrides,
  };
}

function forbiddenFindingState(
  findingClass:
    | "compatibility"
    | "engine-failure"
    | "incomplete"
    | "integrity"
    | "protected-review"
    | "unsupported",
  disposition:
    "baselined" | "disabled-by-override" | "excepted" | "not-enforced",
): EngineResult["findings"][number]["state"] {
  switch (findingClass) {
    case "engine-failure":
    case "incomplete":
    case "unsupported": {
      return findingClass;
    }
    default: {
      return disposition;
    }
  }
}

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function mutateBundle(
  source: CompatibilityBundle,
  mutation: string,
): CompatibilityBundle {
  const bundle = clone(source);
  switch (mutation) {
    case "missing-capability": {
      bundle.capabilities = bundle.capabilities.filter(
        (capability) => capability !== "typecheck",
      );
      break;
    }
    case "missing-node-major": {
      bundle.environment.nodeMajors = [24];
      break;
    }
    case "missing-operating-system": {
      bundle.environment.operatingSystems = ["linux"];
      break;
    }
    case "missing-package-manager-lock": {
      bundle.environment.packageManagerLocks = ["package-lock.json"];
      break;
    }
    case "missing-profile": {
      bundle.profiles = ["static"];
      break;
    }
    case "result-current-mismatch": {
      bundle.resultMajorSupport.current = 3;
      break;
    }
    case "result-previous-mismatch": {
      bundle.resultMajorSupport.previous.major = 5;
      break;
    }
    default: {
      throw new Error(`Unknown bundle mutation: ${mutation}`);
    }
  }
  return bundle;
}

function mutateConformResult(
  source: ConformResult,
  engineSource: EngineResult,
  mutation: string,
): ConformResult {
  const result = clone(source);
  switch (mutation) {
    case "engine-completion": {
      const engineResult = clone(engineSource);
      engineResult.environment.operatingSystem = "windows";
      engineResult.completionState = "unsupported";
      engineResult.classification = "fail";
      result.engineResults = [engineResult];
      break;
    }
    case "engine-metadata": {
      const engineResult = clone(engineSource);
      engineResult.runId = "other-run";
      result.engineResults = [engineResult];
      break;
    }
    case "engine-order": {
      const canon = clone(engineSource);
      const crucible = clone(engineSource);
      crucible.engine.name = "crucible";
      crucible.engine.package = "@clockwork-kitten/crucible";
      result.engineResults = [crucible, canon];
      break;
    }
    case "missing-engine-finding": {
      result.engineResults = [withValidWarning(engineSource)];
      break;
    }
    default: {
      throw new Error(`Unknown conform-result mutation: ${mutation}`);
    }
  }
  return result;
}

function mutateEngineResult(
  source: EngineResult,
  mutation: string,
): EngineResult {
  const result = clone(source);
  const fixtureFinding = finding();
  if (mutation.startsWith("forbidden-disposition:")) {
    const [, findingClass, disposition] = mutation.split(":") as [
      string,
      (
        | "compatibility"
        | "engine-failure"
        | "incomplete"
        | "integrity"
        | "protected-review"
        | "unsupported"
      ),
      "baselined" | "disabled-by-override" | "excepted" | "not-enforced",
    ];
    const findingKinds = new Set([
      "compatibility",
      "integrity",
      "protected-review",
    ]);
    result.findings = [
      finding({
        disposition,
        kind: findingKinds.has(findingClass) ? findingClass : "policy",
        matchedRecord:
          disposition === "baselined"
            ? { kind: "baseline", recordId: "baseline-1" }
            : disposition === "excepted"
              ? { kind: "exception", recordId: "exception-1" }
              : undefined,
        state: forbiddenFindingState(findingClass, disposition),
      }),
    ];
    if (findingClass === "protected-review") {
      result.repository.baseRevision = "b".repeat(40);
    }
    return result;
  }
  switch (mutation) {
    case "classification": {
      result.completionState = "unsupported";
      break;
    }
    case "counts": {
      result.counts.total = 99;
      break;
    }
    case "disposition-state": {
      result.findings = [
        finding({
          disposition: "baselined",
          matchedRecord: { kind: "baseline", recordId: "baseline-1" },
        }),
      ];
      break;
    }
    case "failure-classification": {
      result.findings = [
        finding({
          effectiveSeverity: "error",
          state: "integrity-failure",
        }),
      ];
      break;
    }
    case "finding-order": {
      result.findings = [
        fixtureFinding,
        finding({
          effectiveSeverity: "error",
          fingerprint: {
            occurrenceOrdinal: 1,
            value: "8".repeat(64),
            version: 1,
          },
          kind: "integrity",
          ruleId: "crux/integrity/example",
        }),
      ];
      break;
    }
    case "missing-base": {
      result.scope = { kind: "change", paths: ["src/example.ts"] };
      break;
    }
    case "missing-baseline-reference": {
      result.findings = [
        finding({ disposition: "baselined", state: "baselined" }),
      ];
      break;
    }
    case "missing-exception-reference": {
      result.findings = [
        finding({ disposition: "excepted", state: "excepted" }),
      ];
      break;
    }
    case "review-classification": {
      result.findings = [finding({ kind: "protected-review" })];
      result.repository.baseRevision = "b".repeat(40);
      break;
    }
    case "unexpected-matched-record": {
      result.findings = [
        finding({
          matchedRecord: { kind: "baseline", recordId: "baseline-1" },
        }),
      ];
      break;
    }
    default: {
      throw new Error(`Unknown engine-result mutation: ${mutation}`);
    }
  }
  return result;
}

function mutateLock(source: PolicyLock, mutation: string): PolicyLock {
  const lock = clone(source);
  switch (mutation) {
    case "absolute-input": {
      lock.effectivePolicyInputs[0]!.inputId =
        "/Users/example/repository/.conform/policy.jsonc";
      break;
    }
    case "capability": {
      lock.capabilities = lock.capabilities.filter(
        (capability) => capability !== "typecheck",
      );
      break;
    }
    case "component-integrity": {
      lock.components.canon.package.integrity = "sha512-Yg==";
      break;
    }
    case "component-manifest": {
      lock.components.canon.manifestHash = "9".repeat(64);
      break;
    }
    case "component-registry": {
      lock.components.canon.package.registryUrl =
        "https://example.invalid/canon";
      break;
    }
    case "component-version": {
      lock.components.canon.package.version = "99.0.0";
      break;
    }
    case "environment": {
      (lock.environment as unknown as { nodeMajor: number }).nodeMajor = 22;
      break;
    }
    case "extra-tool": {
      const extraTool = clone(lock.components.tools[0]);
      if (extraTool === undefined) {
        throw new Error("Expected the positive fixture to contain a tool");
      }
      extraTool.componentId = "eslint";
      extraTool.package.name = "eslint";
      lock.components.tools.push(extraTool);
      break;
    }
    case "hostname-field": {
      (
        lock as PolicyLock & {
          hostname: string;
        }
      ).hostname = "builder-01";
      break;
    }
    case "installation-input": {
      lock.effectivePolicyInputs[0]!.inputId = "node_modules/layout";
      break;
    }
    case "missing-tool": {
      lock.components.tools = [];
      break;
    }
    case "policy-package": {
      lock.policyPackage.version = "99.0.0";
      break;
    }
    case "schema-major": {
      lock.schemaMajors.result = 99;
      break;
    }
    default: {
      throw new Error(`Unknown lock mutation: ${mutation}`);
    }
  }
  return lock;
}

function withClassifiedFinding(
  source: EngineResult,
  classifiedFinding: EngineResult["findings"][number],
  classification: EngineResult["classification"],
): EngineResult {
  const result = clone(source);
  result.findings = [classifiedFinding];
  result.counts = {
    error: classifiedFinding.effectiveSeverity === "error" ? 1 : 0,
    failing: classification === "fail" ? 1 : 0,
    info: classifiedFinding.effectiveSeverity === "info" ? 1 : 0,
    reviewRequired: classification === "pass-review-required" ? 1 : 0,
    total: 1,
    warning: classifiedFinding.effectiveSeverity === "warning" ? 1 : 0,
  };
  result.classification = classification;
  if (classifiedFinding.kind === "protected-review") {
    result.repository.baseRevision = "b".repeat(40);
  }
  return result;
}

function withValidWarning(result: EngineResult): EngineResult {
  const engineResult = clone(result);
  engineResult.findings = [finding()];
  engineResult.counts = {
    error: 0,
    failing: 0,
    info: 0,
    reviewRequired: 0,
    total: 1,
    warning: 1,
  };
  return engineResult;
}

describe("development-only lock and result reconciliation", () => {
  test("accepts the exact bundle, lock, and canonical results", async () => {
    const positive = await loadJson<PositiveFixture>(
      join(FIXTURE_DIRECTORY, "positive.json"),
    );

    expect(validateCompatibilityBundle(positive.bundle)).toEqual({
      errors: [],
      valid: true,
    });
    expect(validateLockAgainstBundle(positive.bundle, positive.lock)).toEqual({
      errors: [],
      valid: true,
    });
    expect(
      validateEngineResult(positive.engineResult, positive.bundle),
    ).toEqual({ errors: [], valid: true });
    expect(
      validateConformResult(positive.conformResult, positive.bundle),
    ).toEqual({ errors: [], valid: true });
  });

  test("rejects every relational negative fixture", async () => {
    const positive = await loadJson<PositiveFixture>(
      join(FIXTURE_DIRECTORY, "positive.json"),
    );
    const fixture = await loadJson<RelationalFixture>(
      join(FIXTURE_DIRECTORY, "relational-negative.json"),
    );

    expect(fixture.fixtureRevision).toBe(1);
    for (const fixtureCase of fixture.bundleCases) {
      const result = validateCompatibilityBundle(
        mutateBundle(positive.bundle, fixtureCase.mutation),
      );
      expect(result.valid, fixtureCase.name).toBe(false);
      expect(result.errors.join("\n"), fixtureCase.name).toContain(
        fixtureCase.expectedError,
      );
    }
    for (const fixtureCase of fixture.lockCases) {
      const result = validateLockAgainstBundle(
        positive.bundle,
        mutateLock(positive.lock, fixtureCase.mutation),
      );
      expect(result.valid, fixtureCase.name).toBe(false);
      expect(result.errors.join("\n"), fixtureCase.name).toContain(
        fixtureCase.expectedError,
      );
    }
    for (const fixtureCase of fixture.engineResultCases) {
      const result = validateEngineResult(
        mutateEngineResult(positive.engineResult, fixtureCase.mutation),
        positive.bundle,
      );
      expect(result.valid, fixtureCase.name).toBe(false);
      expect(result.errors.join("\n"), fixtureCase.name).toContain(
        fixtureCase.expectedError,
      );
      if (fixtureCase.mutation.startsWith("forbidden-disposition:")) {
        expect(result.errors.join("\n"), fixtureCase.name).toContain(
          "classification",
        );
      }
    }
    for (const fixtureCase of fixture.conformResultCases) {
      const result = validateConformResult(
        mutateConformResult(
          positive.conformResult,
          positive.engineResult,
          fixtureCase.mutation,
        ),
        positive.bundle,
      );
      expect(result.valid, fixtureCase.name).toBe(false);
      expect(result.errors.join("\n"), fixtureCase.name).toContain(
        fixtureCase.expectedError,
      );
    }
  });

  test("accepts canonical fail results for unsupported observations", async () => {
    const ajv = await createValidator();
    const positive = await loadJson<PositiveFixture>(
      join(FIXTURE_DIRECTORY, "positive.json"),
    );
    const unsupported = await loadJson<UnsupportedFixture>(
      join(FIXTURE_DIRECTORY, "unsupported-results.json"),
    );
    const validateSchema = ajv.getSchema(
      "https://schemas.clockwork-kitten.dev/crux/engine-result/1",
    );

    expect(unsupported.fixtureRevision).toBe(1);
    for (const observation of unsupported.observations) {
      const result = clone(positive.engineResult);
      result.environment = observation.environment;
      result.completionState = "unsupported";
      result.classification = "fail";
      expect(
        validateSchema?.(result),
        `${observation.name}: ${JSON.stringify(validateSchema?.errors)}`,
      ).toBe(true);
      expect(
        validateEngineResult(result, positive.bundle),
        observation.name,
      ).toEqual({ errors: [], valid: true });
    }
  });

  test("classifies mandatory failure and review findings positively", async () => {
    const positive = await loadJson<PositiveFixture>(
      join(FIXTURE_DIRECTORY, "positive.json"),
    );
    const cases = [
      {
        classification: "fail",
        name: "integrity",
        value: finding({ kind: "integrity" }),
      },
      {
        classification: "fail",
        name: "compatibility",
        value: finding({ kind: "compatibility" }),
      },
      {
        classification: "fail",
        name: "unsupported",
        value: finding({ state: "unsupported" }),
      },
      {
        classification: "fail",
        name: "incomplete",
        value: finding({ state: "incomplete" }),
      },
      {
        classification: "fail",
        name: "engine failure",
        value: finding({ state: "engine-failure" }),
      },
      {
        classification: "pass-review-required",
        name: "protected review",
        value: finding({ kind: "protected-review" }),
      },
    ] as const;

    for (const fixtureCase of cases) {
      expect(
        validateEngineResult(
          withClassifiedFinding(
            positive.engineResult,
            fixtureCase.value,
            fixtureCase.classification,
          ),
          positive.bundle,
        ),
        fixtureCase.name,
      ).toEqual({ errors: [], valid: true });
    }
  });
});
