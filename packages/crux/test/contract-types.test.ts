import { expect, test } from "bun:test";

import type {
  CompatibilityBundle,
  ConformResult,
  DerivedContext,
  EngineResult,
  PolicyLock,
} from "../types/index.js";

const hash = "0".repeat(64);
const integrity = "sha512-YQ==";
const packageRecord = {
  integrity,
  name: "@clockwork-kitten/crux",
  registryUrl: "https://registry.npmjs.org/@clockwork-kitten/crux",
  version: "1.0.0",
} as const;
const component = {
  capabilities: [] as string[],
  componentId: "crux",
  // eslint-disable-next-line unicorn/no-null -- The JSON contract requires an explicit null for components without manifests.
  manifestHash: null,
  package: packageRecord,
  role: "policy",
  verdictProducing: false,
} as const;
const components: CompatibilityBundle["components"] = {
  canon: {
    ...component,
    componentId: "canon",
    manifestHash: hash,
    package: {
      ...packageRecord,
      name: "@clockwork-kitten/canon",
    },
    role: "engine",
    verdictProducing: true,
  },
  conform: {
    ...component,
    componentId: "conform",
    manifestHash: hash,
    package: {
      ...packageRecord,
      name: "@clockwork-kitten/conform",
    },
    role: "orchestrator",
    verdictProducing: true,
  },
  crucible: {
    ...component,
    componentId: "crucible",
    manifestHash: hash,
    package: {
      ...packageRecord,
      name: "@clockwork-kitten/crucible",
    },
    role: "engine",
    verdictProducing: true,
  },
  crux: component,
  tools: [],
};
const counts = {
  error: 0,
  failing: 0,
  info: 0,
  reviewRequired: 0,
  total: 0,
  warning: 0,
} as const;
const resultBase = {
  bundleId: "conform-1.0.0",
  classification: "pass",
  command: "check",
  completionState: "complete",
  counts,
  effectivePolicyHash: hash,
  environment: {
    nodeMajor: 24,
    operatingSystem: "linux",
    packageManagerLock: "package-lock.json",
    verdictRuntime: "node",
  },
  findings: [] as EngineResult["findings"],
  policyPackage: packageRecord,
  profile: "ci",
  repository: {
    revision: "a".repeat(40),
  },
  runId: "run-001",
  schemaVersion: "1.0.0",
  scope: {
    kind: "repository",
    paths: [] as string[],
  },
} as const;

const bundle: CompatibilityBundle = {
  bundleId: "conform-1.0.0",
  capabilities: [],
  components,
  environment: {
    nodeMajors: [24, 26],
    operatingSystems: ["darwin", "linux"],
    packageManagerLocks: ["bun.lock", "package-lock.json"],
    verdictRuntime: "node",
  },
  resultMajorSupport: {
    current: 2,
    previous: {
      major: 1,
      minimumConformMinorReleases: 1,
      minimumDays: 90,
    },
  },
  schemaMajors: {
    lock: 1,
    policy: 1,
    result: 1,
  },
  schemaVersion: "1.0.0",
};

const lock: PolicyLock = {
  bundleId: bundle.bundleId,
  capabilities: [],
  components,
  effectivePolicyHash: hash,
  effectivePolicyInputs: [],
  environment: {
    nodeMajor: 24,
    operatingSystem: "linux",
    packageManagerLock: "package-lock.json",
    verdictRuntime: "node",
  },
  policyPackage: packageRecord,
  repository: {
    declaredShape: "typescript-package",
    profile: "ci",
  },
  schemaMajors: bundle.schemaMajors,
  schemaVersion: "1.0.0",
};

const engineResult: EngineResult = {
  ...resultBase,
  engine: {
    integrity,
    manifestHash: hash,
    name: "canon",
    package: "@clockwork-kitten/canon",
    version: "1.0.0",
  },
};

const conformResult: ConformResult = {
  ...resultBase,
  conform: {
    integrity,
    manifestHash: hash,
    name: "conform",
    package: "@clockwork-kitten/conform",
    version: "1.0.0",
  },
  contractFindings: [],
  engineResults: [engineResult],
};

const context: DerivedContext = {
  architectureReferences: [],
  bundleId: bundle.bundleId,
  canonicalResultPath: ".conform/result.json",
  commands: [],
  contextHash: hash,
  exceptions: [],
  glossary: [],
  policy: {
    effectivePolicyHash: hash,
    policyId: "studio",
    policyVersion: "1.0.0",
  },
  profiles: ["ci"],
  rules: {
    active: [],
    disabled: [],
    notEnforced: [],
  },
  schemaVersion: "1.0.0",
  topInvariants: [],
};

const invalidRuntime: EngineResult = {
  ...engineResult,
  environment: {
    ...engineResult.environment,
    // @ts-expect-error Bun is an adopter package manager, not a verdict runtime
    verdictRuntime: "bun",
  },
};

void invalidRuntime;

test("generated declarations agree with valid contract records", () => {
  expect(bundle.environment.nodeMajors).toEqual([24, 26]);
  expect(lock.policyPackage.name).toBe("@clockwork-kitten/crux");
  expect(engineResult.classification).toBe("pass");
  expect(conformResult.engineResults).toHaveLength(1);
  expect(context.canonicalResultPath).toBe(".conform/result.json");
});
