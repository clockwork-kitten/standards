export type LegacyIdentity = {
  id: string;
  kind: "command" | "config-key" | "rule" | "suppression";
};

export type MigrationDispositionEntry = {
  legacy: LegacyIdentity;
};

export type MigrationValidationError =
  | {
      code: "duplicate-disposition";
      identity: string;
    }
  | {
      code: "missing-disposition";
      identity: string;
    }
  | {
      code: "unknown-disposition";
      identity: string;
    };

export function validateMigrationDispositions(
  inventory: readonly LegacyIdentity[],
  entries: readonly MigrationDispositionEntry[],
): MigrationValidationError[] {
  const inventoryKeys = new Set(
    inventory.map((identity) => identityKey(identity)),
  );
  const dispositionCounts = new Map<string, number>();

  for (const entry of entries) {
    const key = identityKey(entry.legacy);
    dispositionCounts.set(key, (dispositionCounts.get(key) ?? 0) + 1);
  }

  const errors: MigrationValidationError[] = [];
  for (const [identity, count] of dispositionCounts) {
    if (!inventoryKeys.has(identity)) {
      errors.push({ code: "unknown-disposition", identity });
    }
    if (count > 1) {
      errors.push({ code: "duplicate-disposition", identity });
    }
  }
  for (const identity of inventoryKeys) {
    if (!dispositionCounts.has(identity)) {
      errors.push({ code: "missing-disposition", identity });
    }
  }

  return errors.toSorted((left, right) => {
    return (
      left.identity.localeCompare(right.identity) ||
      left.code.localeCompare(right.code)
    );
  });
}

function identityKey(identity: LegacyIdentity): string {
  return `${identity.kind}:${identity.id}`;
}
