import type {
  Baseline,
  ExceptionLedger,
  RepositoryPolicy,
  RuleRecord,
} from "../types/index.js";

const APPLICABLE_LIFECYCLES = new Set(["deprecated", "error", "warn"]);

type PolicyRuleReference = Pick<RuleRecord, "lifecycle" | "owner" | "ruleId">;

type RuleReference = {
  artifact: "baseline" | "exception" | "override";
  owner?: PolicyRuleReference["owner"];
  ruleId: string;
};

export function validateArtifactPolicyReferences(
  rules: readonly PolicyRuleReference[],
  baseline: Baseline,
  exceptions: ExceptionLedger,
  repositoryPolicy: RepositoryPolicy,
): string[] {
  const rulesById = new Map(rules.map((rule) => [rule.ruleId, rule]));
  const references: RuleReference[] = [
    ...baseline.entries.map(({ record }) => ({
      artifact: "baseline" as const,
      ruleId: record.ruleId,
    })),
    ...exceptions.entries.map((entry) => ({
      artifact: "exception" as const,
      owner: entry.ruleOwner,
      ruleId: entry.ruleId,
    })),
    ...repositoryPolicy.severityOverrides.map((override) => ({
      artifact: "override" as const,
      owner: override.owner,
      ruleId: override.ruleId,
    })),
  ];

  return references
    .flatMap((reference) => {
      const rule = rulesById.get(reference.ruleId);
      if (rule === undefined) {
        return [
          `${reference.artifact} references unknown rule: ${reference.ruleId}`,
        ];
      }
      if (rule.lifecycle === "removed") {
        return [
          `${reference.artifact} references removed rule: ${reference.ruleId}`,
        ];
      }
      if (!APPLICABLE_LIFECYCLES.has(rule.lifecycle)) {
        return [
          `${reference.artifact} references non-applicable ${rule.lifecycle} rule: ${reference.ruleId}`,
        ];
      }
      if (reference.owner !== undefined && reference.owner !== rule.owner) {
        return [
          `${reference.artifact} claims owner ${reference.owner} for ${reference.ruleId}; policy owner is ${rule.owner}`,
        ];
      }
      return [];
    })
    .toSorted();
}

export function validateBaselineIntegrity(
  baseline: Baseline,
  currentFingerprintVersion: string,
): string[] {
  const errors = [
    ...fingerprintErrors(baseline, currentFingerprintVersion),
    ...migrationErrors(baseline, currentFingerprintVersion),
  ];

  return errors.toSorted();
}

function fingerprintErrors(
  baseline: Baseline,
  currentFingerprintVersion: string,
): string[] {
  const errors: string[] = [];
  const seenKeys = new Set<string>();

  if (baseline.fingerprintVersion !== currentFingerprintVersion) {
    errors.push(
      `baseline fingerprint version is not current: ${baseline.fingerprintVersion} != ${currentFingerprintVersion}`,
    );
  }

  for (const { record } of baseline.entries) {
    if (record.fingerprintVersion !== baseline.fingerprintVersion) {
      errors.push(
        `entry fingerprint version does not match baseline for ${occurrenceKey(record)}: ${record.fingerprintVersion} != ${baseline.fingerprintVersion}`,
      );
    }

    const key = occurrenceKey(record);
    if (seenKeys.has(key)) {
      errors.push(`duplicate baseline occurrence identity: ${key}`);
    }
    seenKeys.add(key);
  }

  return errors;
}

function migrationErrors(
  baseline: Baseline,
  currentFingerprintVersion: string,
): string[] {
  if (baseline.migrations.length === 0) {
    return [];
  }

  const errors: string[] = [];
  const migrationsBySource = new Map<
    string,
    (typeof baseline.migrations)[number]
  >();
  const incomingCounts = new Map<string, number>();
  const migrationIds = new Set<string>();

  for (const migration of baseline.migrations) {
    if (migrationIds.has(migration.migrationId)) {
      errors.push(
        `duplicate fingerprint migration ID: ${migration.migrationId}`,
      );
    }
    migrationIds.add(migration.migrationId);

    if (migrationsBySource.has(migration.fromFingerprintVersion)) {
      errors.push(
        `conflicting fingerprint migrations from version: ${migration.fromFingerprintVersion}`,
      );
    } else {
      migrationsBySource.set(migration.fromFingerprintVersion, migration);
    }

    incomingCounts.set(
      migration.toFingerprintVersion,
      (incomingCounts.get(migration.toFingerprintVersion) ?? 0) + 1,
    );

    if (migration.bundleId !== baseline.bundleId) {
      errors.push(
        `fingerprint migration ${migration.migrationId} has bundle ${migration.bundleId}; baseline bundle is ${baseline.bundleId}`,
      );
    }
    if (migration.fromFingerprintVersion === migration.toFingerprintVersion) {
      errors.push(
        `fingerprint migration ${migration.migrationId} does not change version`,
      );
    }
    if (migration.beforeCount !== migration.afterCount) {
      errors.push(
        `fingerprint migration ${migration.migrationId} changes occurrence total: ${migration.beforeCount} -> ${migration.afterCount}`,
      );
    }
  }

  for (const [version, count] of incomingCounts) {
    if (count > 1) {
      errors.push(`conflicting fingerprint migrations to version: ${version}`);
    }
  }

  const starts = migrationsBySource
    .keys()
    .filter((version) => !incomingCounts.has(version))
    .toArray();
  if (starts.length !== 1) {
    errors.push(
      `fingerprint migration history must have one starting version; found ${starts.length}`,
    );
    return errors;
  }

  const visited = new Set<string>();
  let version = starts[0]!;
  let previousAfterCount: number | undefined;

  while (version !== currentFingerprintVersion) {
    const migration = migrationsBySource.get(version);
    if (migration === undefined) {
      errors.push(
        `fingerprint migration chain stops before current version: ${version}`,
      );
      return errors;
    }
    if (visited.has(version)) {
      errors.push(
        `fingerprint migration chain contains a cycle at: ${version}`,
      );
      return errors;
    }
    visited.add(version);

    if (
      previousAfterCount !== undefined &&
      migration.beforeCount !== previousAfterCount
    ) {
      errors.push(
        `fingerprint migration chain count mismatch at ${version}: ${previousAfterCount} != ${migration.beforeCount}`,
      );
    }
    previousAfterCount = migration.afterCount;
    version = migration.toFingerprintVersion;
  }

  if (visited.size !== baseline.migrations.length) {
    errors.push(
      `fingerprint migration history is disconnected: used ${visited.size} of ${baseline.migrations.length} records`,
    );
  }

  const baselineCount = baseline.entries.reduce(
    (total, { record }) => total + record.count,
    0,
  );
  if (previousAfterCount !== baselineCount) {
    errors.push(
      `fingerprint migration final count does not match baseline occurrences: ${previousAfterCount ?? 0} != ${baselineCount}`,
    );
  }

  return errors;
}

function occurrenceKey(record: Baseline["entries"][number]["record"]): string {
  return `${record.ruleId}:${record.path}:${record.fingerprint}`;
}
