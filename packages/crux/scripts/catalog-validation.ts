const LIFECYCLE_TRANSITIONS = {
  deprecated: new Set(["deprecated", "removed"]),
  error: new Set(["deprecated", "error"]),
  proposed: new Set(["proposed", "warn"]),
  removed: new Set(["removed"]),
  warn: new Set(["deprecated", "error", "warn"]),
} as const;

export type CatalogFixture = {
  current: RuleIdentity[];
  expectedErrors: string[];
  fixtureRevision: number;
  name: string;
  previous: RuleIdentity[];
};

export type RuleIdentity = {
  aspect: string;
  checkKind: "executing" | "static";
  domains: string[];
  fileClass: string;
  lifecycle: Lifecycle;
  owner?: Engine | Engine[];
  ruleId: string;
};

type Engine = "canon" | "conform" | "crucible";

type Lifecycle = keyof typeof LIFECYCLE_TRANSITIONS;

export function validateCatalogTransition(
  previous: RuleIdentity[],
  current: RuleIdentity[],
): string[] {
  return [
    ...duplicateIds(previous, "previous"),
    ...duplicateIds(current, "current"),
    ...ownerErrors(current),
    ...overlapErrors(current),
    ...lifecycleErrors(previous, current),
  ].toSorted();
}

function duplicateIds(rules: RuleIdentity[], release: string): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const rule of rules) {
    if (seen.has(rule.ruleId)) {
      duplicates.add(rule.ruleId);
    }
    seen.add(rule.ruleId);
  }

  return [...duplicates]
    .toSorted()
    .map((ruleId) => `${release} catalog has duplicate rule ID: ${ruleId}`);
}

function lifecycleErrors(
  previous: RuleIdentity[],
  current: RuleIdentity[],
): string[] {
  const currentById = new Map(current.map((rule) => [rule.ruleId, rule]));

  return previous.flatMap((previousRule) => {
    const currentRule = currentById.get(previousRule.ruleId);
    if (currentRule === undefined) {
      return [
        `permanent rule ID missing from current catalog: ${previousRule.ruleId}`,
      ];
    }
    if (
      previousRule.lifecycle === "removed" &&
      currentRule.lifecycle !== "removed"
    ) {
      return [`removed rule ID was reused: ${previousRule.ruleId}`];
    }
    if (
      !LIFECYCLE_TRANSITIONS[previousRule.lifecycle].has(currentRule.lifecycle)
    ) {
      return [
        `illegal lifecycle transition for ${previousRule.ruleId}: ${previousRule.lifecycle} -> ${currentRule.lifecycle}`,
      ];
    }
    return [];
  });
}

function overlapErrors(rules: RuleIdentity[]): string[] {
  const errors: string[] = [];

  for (const [index, left] of rules.entries()) {
    const subsequentRules = rules.slice(index + 1);
    for (const right of subsequentRules) {
      const isSameTuple =
        left.fileClass === right.fileClass &&
        left.aspect === right.aspect &&
        left.checkKind === right.checkKind;
      const sharedDomain = left.domains.some((domain) =>
        right.domains.includes(domain),
      );
      const leftOwner = Array.isArray(left.owner) ? left.owner[0] : left.owner;
      const rightOwner = Array.isArray(right.owner)
        ? right.owner[0]
        : right.owner;

      if (
        isSameTuple &&
        sharedDomain &&
        leftOwner !== undefined &&
        rightOwner !== undefined &&
        leftOwner !== rightOwner
      ) {
        errors.push(
          `rules ${left.ruleId} and ${right.ruleId} overlap ownership tuple with different owners`,
        );
      }
    }
  }

  return errors;
}

function ownerErrors(rules: RuleIdentity[]): string[] {
  return rules.flatMap((rule) => {
    if (rule.owner === undefined) {
      return [`rule ${rule.ruleId} has zero owners`];
    }
    if (Array.isArray(rule.owner)) {
      return rule.owner.length === 1
        ? []
        : [`rule ${rule.ruleId} has multiple owners`];
    }
    return [];
  });
}
