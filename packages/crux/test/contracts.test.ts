import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA_DIRECTORY = join(PACKAGE_ROOT, "schemas");
const CONTRACT_FIXTURE_DIRECTORY = fileURLToPath(
  new URL("fixtures/contracts", import.meta.url),
);
const SCHEMA_FILES = [
  "rule.schema.json",
  "bundle.schema.json",
  "lock.schema.json",
  "engine-result.schema.json",
  "conform-result.schema.json",
  "context.schema.json",
] as const;

type ContractName =
  "bundle" | "conformResult" | "context" | "engineResult" | "lock";

type NegativeFixture = {
  cases: {
    from: ContractName;
    name: string;
    patch: {
      path: (number | string)[];
      value: unknown;
    };
    schemaId: string;
  }[];
  fixtureRevision: number;
};

type PositiveFixture = Record<ContractName, Record<string, unknown>> & {
  fixtureRevision: number;
};

function applyPatch(
  source: Record<string, unknown>,
  path: (number | string)[],
  value: unknown,
): Record<string, unknown> {
  const result = structuredClone(source);
  let target: unknown = result;
  const parentPath = path.slice(0, -1);
  for (const segment of parentPath) {
    if (
      (typeof target !== "object" || target === null) &&
      !Array.isArray(target)
    ) {
      throw new TypeError(`Cannot patch ${path.join(".")}`);
    }
    target = (target as Record<number | string, unknown>)[segment];
  }
  if (typeof target !== "object" || target === null) {
    throw new TypeError(`Cannot patch ${path.join(".")}`);
  }
  const finalSegment = path.at(-1);
  if (finalSegment === undefined) {
    throw new TypeError("Patch path cannot be empty");
  }
  (target as Record<number | string, unknown>)[finalSegment] = value;
  return result;
}

async function createValidator(): Promise<Ajv2020> {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const schemaFile of SCHEMA_FILES) {
    ajv.addSchema(await loadJson(join(SCHEMA_DIRECTORY, schemaFile)));
  }
  return ajv;
}

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

describe("lock, bundle, result, and context contracts", () => {
  test("accept all positive fixtures", async () => {
    const ajv = await createValidator();
    const fixture = await loadJson<PositiveFixture>(
      join(CONTRACT_FIXTURE_DIRECTORY, "positive.json"),
    );
    const schemas: Record<ContractName, string> = {
      bundle: "https://schemas.clockwork-kitten.dev/crux/bundle/1",
      conformResult:
        "https://schemas.clockwork-kitten.dev/crux/conform-result/1",
      context: "https://schemas.clockwork-kitten.dev/crux/context/1",
      engineResult: "https://schemas.clockwork-kitten.dev/crux/engine-result/1",
      lock: "https://schemas.clockwork-kitten.dev/crux/lock/1",
    };

    expect(fixture.fixtureRevision).toBe(1);
    for (const [name, schemaId] of Object.entries(schemas) as [
      ContractName,
      string,
    ][]) {
      const validate = ajv.getSchema(schemaId);
      expect(validate?.(fixture[name]), JSON.stringify(validate?.errors)).toBe(
        true,
      );
    }
  });

  test("reject all negative fixtures including forbidden hash inputs", async () => {
    const ajv = await createValidator();
    const positive = await loadJson<PositiveFixture>(
      join(CONTRACT_FIXTURE_DIRECTORY, "positive.json"),
    );
    const negative = await loadJson<NegativeFixture>(
      join(CONTRACT_FIXTURE_DIRECTORY, "negative.json"),
    );

    expect(negative.fixtureRevision).toBe(1);
    for (const fixtureCase of negative.cases) {
      const artifact = applyPatch(
        positive[fixtureCase.from],
        fixtureCase.patch.path,
        fixtureCase.patch.value,
      );
      expect(
        ajv.getSchema(fixtureCase.schemaId)?.(artifact),
        fixtureCase.name,
      ).toBe(false);
    }
  });
});
