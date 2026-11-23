import type {
  CompatibilityBundle,
  ConformResult,
  EngineResult,
  PolicyLock,
} from "../../types/index.js";

const FIRST_BUNDLE_NODE_MAJORS = [24, 26];
const FIRST_BUNDLE_OPERATING_SYSTEMS = ["darwin", "linux"];
const FIRST_BUNDLE_PACKAGE_MANAGER_LOCKS = ["bun.lock", "package-lock.json"];
const FIRST_BUNDLE_PROFILES = ["full", "static"];
const FORBIDDEN_ENVIRONMENT_KEYS = new Set([
  "absolutePath",
  "generatedAt",
  "hostname",
  "installationLayout",
  "installationPath",
  "nodeModulesPath",
  "timestamp",
]);
const FORBIDDEN_INSTALLATION_SEGMENT =
  /(?:^|\/)(?:node_modules|\.pnpm|\.yarn|\.bun)(?:\/|$)/;
const FAILURE_STATES = new Set([
  "compatibility-failure",
  "engine-failure",
  "incomplete",
  "integrity-failure",
  "skipped",
  "unimplemented",
  "unknown",
  "unlocked",
  "unsupported",
]);
const DISPOSITION_STATES = new Set([
  "baselined",
  "disabled-by-override",
  "excepted",
  "not-enforced",
]);
const NON_FAILING_DISPOSITIONS = new Set([
  "baselined",
  "disabled-by-override",
  "excepted",
  "not-enforced",
]);
const SEVERITY_PRIORITY = {
  error: 0,
  info: 2,
  warning: 1,
} as const;

type Finding = EngineResult["findings"][number];
type ResultCounts = EngineResult["counts"];
type ValidationResult = { errors: string[]; valid: boolean };

export function validateCompatibilityBundle(
  bundle: CompatibilityBundle,
): ValidationResult {
  const errors: string[] = [];
  requireEqual(
    errors,
    "resultMajorSupport.current",
    bundle.resultMajorSupport.current,
    bundle.schemaMajors.result,
  );
  const previous = bundle.resultMajorSupport.previous;
  if (bundle.resultMajorSupport.current === 1) {
    if (previous !== undefined) {
      errors.push("resultMajorSupport.previous must be absent for major 1");
    }
  } else if (previous === undefined) {
    errors.push("resultMajorSupport.previous is required after major 1");
  } else {
    requireEqual(
      errors,
      "resultMajorSupport.previous.major",
      previous.major,
      bundle.resultMajorSupport.current - 1,
    );
    if (previous.minimumConformMinorReleases < 1) {
      errors.push(
        "resultMajorSupport.previous.minimumConformMinorReleases is below 1",
      );
    }
    if (previous.minimumDays < 90) {
      errors.push("resultMajorSupport.previous.minimumDays is below 90");
    }
  }
  requireEqual(
    errors,
    "first-bundle Node majors",
    bundle.environment.nodeMajors,
    FIRST_BUNDLE_NODE_MAJORS,
  );
  requireEqual(
    errors,
    "first-bundle operating systems",
    bundle.environment.operatingSystems,
    FIRST_BUNDLE_OPERATING_SYSTEMS,
  );
  requireEqual(
    errors,
    "first-bundle package manager locks",
    bundle.environment.packageManagerLocks,
    FIRST_BUNDLE_PACKAGE_MANAGER_LOCKS,
  );
  requireEqual(
    errors,
    "first-bundle verdict runtime",
    bundle.environment.verdictRuntime,
    "node",
  );
  requireEqual(
    errors,
    "first-bundle profiles",
    bundle.profiles,
    FIRST_BUNDLE_PROFILES,
  );
  requireEqual(
    errors,
    "bundle capabilities",
    bundle.capabilities,
    componentCapabilities(bundle),
  );
  return { errors, valid: errors.length === 0 };
}

export function validateConformResult(
  result: ConformResult,
  bundle?: CompatibilityBundle,
): ValidationResult {
  const errors = validateResultCore(result, bundle);
  for (const [index, engineResult] of result.engineResults.entries()) {
    errors.push(
      ...validateEngineResult(engineResult, bundle).errors.map(
        (error) => `engineResults[${index}]: ${error}`,
      ),
    );
    const commonFields = [
      "bundleId",
      "runId",
      "repository",
      "environment",
      "command",
      "profile",
      "scope",
      "policyPackage",
      "effectivePolicyHash",
    ] as const;
    for (const field of commonFields) {
      requireEqual(
        errors,
        `engineResults[${index}].${field}`,
        engineResult[field],
        result[field],
      );
    }
  }

  const expectedFindings = [
    ...result.engineResults.flatMap((engineResult) => engineResult.findings),
    ...result.contractFindings,
  ].toSorted(compareFindings);
  requireEqual(errors, "aggregate findings", result.findings, expectedFindings);

  const sortedEngineResults = result.engineResults.toSorted((left, right) =>
    left.engine.name.localeCompare(right.engine.name, "en"),
  );
  requireEqual(
    errors,
    "engineResults stable order",
    result.engineResults,
    sortedEngineResults,
  );

  const incompleteEngine = result.engineResults.find(
    (engineResult) => engineResult.completionState !== "complete",
  );
  if (
    incompleteEngine !== undefined &&
    result.completionState !== incompleteEngine.completionState
  ) {
    errors.push("aggregate completion does not preserve engine failure state");
  }
  return { errors, valid: errors.length === 0 };
}

export function validateEngineResult(
  result: EngineResult,
  bundle?: CompatibilityBundle,
): ValidationResult {
  const errors = validateResultCore(result, bundle);
  return { errors, valid: errors.length === 0 };
}

export function validateLockAgainstBundle(
  bundle: CompatibilityBundle,
  lock: PolicyLock,
): ValidationResult {
  const errors = [...validateCompatibilityBundle(bundle).errors];
  requireEqual(errors, "bundleId", lock.bundleId, bundle.bundleId);
  requireEqual(
    errors,
    "policyPackage",
    lock.policyPackage,
    bundle.components.crux.package,
  );
  requireEqual(errors, "components", lock.components, bundle.components);
  requireEqual(errors, "schemaMajors", lock.schemaMajors, bundle.schemaMajors);
  requireEqual(errors, "capabilities", lock.capabilities, bundle.capabilities);

  if (
    !bundle.environment.nodeMajors.includes(lock.environment.nodeMajor) ||
    !bundle.environment.operatingSystems.includes(
      lock.environment.operatingSystem,
    ) ||
    !bundle.environment.packageManagerLocks.includes(
      lock.environment.packageManagerLock,
    ) ||
    lock.environment.verdictRuntime !== bundle.environment.verdictRuntime
  ) {
    errors.push("lock environment is outside the supported bundle tuple");
  }

  const inputIds = lock.effectivePolicyInputs.map((input) => input.inputId);
  requireEqual(
    errors,
    "effectivePolicyInputs order",
    inputIds,
    inputIds.toSorted(),
  );
  for (const inputId of inputIds) {
    if (
      inputId.startsWith("/") ||
      /^[A-Za-z]:/.test(inputId) ||
      FORBIDDEN_INSTALLATION_SEGMENT.test(inputId)
    ) {
      errors.push(`effectivePolicyInputs contains forbidden path: ${inputId}`);
    }
  }
  const forbiddenField = findForbiddenEnvironmentField(lock);
  if (forbiddenField !== undefined) {
    errors.push(`lock contains environment-specific field: ${forbiddenField}`);
  }
  return { errors, valid: errors.length === 0 };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .toSorted(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function compareFindings(left: Finding, right: Finding): number {
  const priority =
    Number(right.kind === "integrity") - Number(left.kind === "integrity") ||
    Number(right.kind === "protected-review") -
      Number(left.kind === "protected-review") ||
    SEVERITY_PRIORITY[left.effectiveSeverity] -
      SEVERITY_PRIORITY[right.effectiveSeverity] ||
    (left.fingerprint.causedBy ?? "").localeCompare(
      right.fingerprint.causedBy ?? "",
      "en",
    ) ||
    Number(right.fixStatus === "available") -
      Number(left.fixStatus === "available") ||
    left.location.path.localeCompare(right.location.path, "en") ||
    (left.location.line ?? 0) - (right.location.line ?? 0) ||
    (left.location.column ?? 0) - (right.location.column ?? 0) ||
    left.ruleId.localeCompare(right.ruleId, "en") ||
    left.fingerprint.value.localeCompare(right.fingerprint.value, "en") ||
    left.fingerprint.occurrenceOrdinal - right.fingerprint.occurrenceOrdinal;
  return priority;
}

function compareJson(left: unknown, right: unknown): number {
  return canonicalJson(left).localeCompare(canonicalJson(right), "en");
}

function componentCapabilities(
  bundle: CompatibilityBundle,
): (number | string)[] {
  const components = [
    bundle.components.crux,
    bundle.components.canon,
    bundle.components.crucible,
    bundle.components.conform,
    ...bundle.components.tools,
  ];
  return sortedUnique(
    components.flatMap((component) => component.capabilities),
  );
}

function deriveClassification(
  completionState: EngineResult["completionState"],
  counts: ResultCounts,
): EngineResult["classification"] {
  if (completionState !== "complete" || counts.failing > 0) {
    return "fail";
  }
  return counts.reviewRequired > 0 ? "pass-review-required" : "pass";
}

function deriveCounts(findings: Finding[]): ResultCounts {
  return {
    error: findings.filter((finding) => finding.effectiveSeverity === "error")
      .length,
    failing: findings.filter((finding) => isFailingFinding(finding)).length,
    info: findings.filter((finding) => finding.effectiveSeverity === "info")
      .length,
    reviewRequired: findings.filter(
      (finding) => finding.kind === "protected-review",
    ).length,
    total: findings.length,
    warning: findings.filter(
      (finding) => finding.effectiveSeverity === "warning",
    ).length,
  };
}

function findForbiddenEnvironmentField(
  value: unknown,
  path = "lock",
): string | undefined {
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      const found = findForbiddenEnvironmentField(entry, `${path}[${index}]`);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_ENVIRONMENT_KEYS.has(key)) {
      return `${path}.${key}`;
    }
    const found = findForbiddenEnvironmentField(entry, `${path}.${key}`);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

function isEqualJson(left: unknown, right: unknown): boolean {
  return compareJson(left, right) === 0;
}

function isFailingFinding(finding: Finding): boolean {
  if (requiresFailingOutcome(finding)) {
    return true;
  }
  if (NON_FAILING_DISPOSITIONS.has(finding.disposition)) {
    return false;
  }
  return (
    finding.kind !== "protected-review" && finding.effectiveSeverity === "error"
  );
}

function isSupportedEnvironment(
  environment: EngineResult["environment"],
  bundle: CompatibilityBundle,
): boolean {
  return (
    bundle.environment.nodeMajors.includes(environment.nodeMajor as 24 | 26) &&
    bundle.environment.operatingSystems.includes(
      environment.operatingSystem as "darwin" | "linux",
    ) &&
    bundle.environment.packageManagerLocks.includes(
      environment.packageManagerLock as "bun.lock" | "package-lock.json",
    ) &&
    environment.verdictRuntime === bundle.environment.verdictRuntime
  );
}

function requireEqual(
  errors: string[],
  label: string,
  actual: unknown,
  expected: unknown,
): void {
  if (!isEqualJson(actual, expected)) {
    errors.push(`${label} does not match`);
  }
}

function requiresFailingOutcome(finding: Finding): boolean {
  return (
    finding.kind === "integrity" ||
    finding.kind === "compatibility" ||
    FAILURE_STATES.has(finding.state)
  );
}

function requiresUnsuppressedOutcome(finding: Finding): boolean {
  return requiresFailingOutcome(finding) || finding.kind === "protected-review";
}

function schemaVersionMajor(schemaVersion: string): number {
  return Number(schemaVersion.slice(0, schemaVersion.indexOf(".")));
}

function sortedUnique(
  values: readonly (number | string)[],
): (number | string)[] {
  return [...new Set(values)].toSorted((left, right) =>
    String(left).localeCompare(String(right), "en"),
  );
}

function validateFinding(finding: Finding, index: number): string[] {
  const errors: string[] = [];
  const matchedRecord = finding.matchedRecord;
  if (
    (finding.kind === "integrity" || finding.kind === "protected-review") &&
    finding.evidence.truncated
  ) {
    errors.push(`findings[${index}] priority finding evidence is truncated`);
  }
  if (
    requiresUnsuppressedOutcome(finding) &&
    NON_FAILING_DISPOSITIONS.has(finding.disposition)
  ) {
    errors.push(
      `findings[${index}] ${finding.kind}/${finding.state} cannot use ${finding.disposition} disposition`,
    );
  }
  if (finding.disposition === "baselined") {
    if (matchedRecord?.kind !== "baseline") {
      errors.push(`findings[${index}] baselined disposition needs baseline`);
    }
  } else if (finding.disposition === "excepted") {
    if (matchedRecord?.kind !== "exception") {
      errors.push(`findings[${index}] excepted disposition needs exception`);
    }
  } else if (matchedRecord !== undefined) {
    errors.push(`findings[${index}] unmatched record is not allowed`);
  }

  if (
    DISPOSITION_STATES.has(finding.disposition) &&
    finding.state !== finding.disposition
  ) {
    errors.push(`findings[${index}] disposition and state disagree`);
  }
  return errors;
}

function validateResultCore(
  result: ConformResult | EngineResult,
  bundle?: CompatibilityBundle,
): string[] {
  const errors = result.findings.flatMap((finding, index) =>
    validateFinding(finding, index),
  );
  const counts = deriveCounts(result.findings);
  requireEqual(errors, "counts", result.counts, counts);

  const classification = deriveClassification(result.completionState, counts);
  requireEqual(errors, "classification", result.classification, classification);

  if (
    (result.scope.kind === "change" ||
      result.findings.some((finding) => finding.kind === "protected-review")) &&
    result.repository.baseRevision === undefined
  ) {
    errors.push("change-relative results require repository.baseRevision");
  }

  const sortedFindings = result.findings.toSorted(compareFindings);
  requireEqual(
    errors,
    "findings stable order",
    result.findings,
    sortedFindings,
  );

  if (bundle !== undefined) {
    requireEqual(
      errors,
      "schemaVersion major",
      schemaVersionMajor(result.schemaVersion),
      bundle.schemaMajors.result,
    );
    requireEqual(
      errors,
      "schemaVersion supported current major",
      schemaVersionMajor(result.schemaVersion),
      bundle.resultMajorSupport.current,
    );
    const isSupported = isSupportedEnvironment(result.environment, bundle);
    if (!isSupported && result.completionState !== "unsupported") {
      errors.push("unsupported observations require unsupported completion");
    }
    if (isSupported && result.completionState === "unsupported") {
      errors.push("supported observations cannot be marked unsupported");
    }
  }
  return errors;
}
