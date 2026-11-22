import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA_DIRECTORY = join(PACKAGE_ROOT, "schemas");
const HARNESS_PATH = fileURLToPath(
  new URL("../scripts/verify-canonical-vectors.mjs", import.meta.url),
);
const VECTOR_PATH = fileURLToPath(
  new URL("fixtures/canonical-json/vectors.json", import.meta.url),
);

type ContextMutation = {
  name: string;
  path: (number | string)[];
  value: unknown;
};

type VectorFixture = {
  artifactVectors: {
    artifact: string;
    excludedVariant: Record<string, unknown>;
    includedMutations?: ContextMutation[];
    input: Record<string, unknown>;
  }[];
};

function applyMutation(
  source: Record<string, unknown>,
  mutation: ContextMutation,
): Record<string, unknown> {
  const result = structuredClone(source);
  let target: unknown = result;
  const parentPath = mutation.path.slice(0, -1);
  for (const segment of parentPath) {
    target = (target as Record<number | string, unknown>)[segment];
  }
  (target as Record<number | string, unknown>)[mutation.path.at(-1)!] =
    mutation.value;
  return result;
}

async function runHarness(executable: string): Promise<string> {
  const process = Bun.spawn([executable, HARNESS_PATH], {
    cwd: PACKAGE_ROOT,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
  return stdout;
}

describe("RFC 8785 canonical JSON vectors", () => {
  test("uses a schema-valid complete context and mutations", async () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    for (const schemaFile of [
      "rule.schema.json",
      "bundle.schema.json",
      "engine-result.schema.json",
      "context.schema.json",
    ]) {
      const schemaPath = join(SCHEMA_DIRECTORY, schemaFile);
      const schemaText = await readFile(schemaPath, "utf8");
      ajv.addSchema(JSON.parse(schemaText) as object);
    }
    const fixture = JSON.parse(
      await readFile(VECTOR_PATH, "utf8"),
    ) as VectorFixture;
    const vector = fixture.artifactVectors.find(
      ({ artifact }) => artifact === "context",
    );
    expect(vector).toBeDefined();
    const validate = ajv.getSchema(
      "https://schemas.clockwork-kitten.dev/crux/context/1",
    );
    for (const [name, context] of [
      ["input", vector!.input],
      ["contextHash variant", vector!.excludedVariant],
      ...(vector!.includedMutations ?? []).map((mutation) => [
        mutation.name,
        applyMutation(vector!.input, mutation),
      ]),
    ] as [string, Record<string, unknown>][]) {
      const valid = validate?.(context);
      const validationErrors = JSON.stringify(validate?.errors);
      expect(valid, `${name}: ${validationErrors}`).toBe(true);
    }
  });

  test("pass the runtime-neutral harness under Node and Bun development", async () => {
    const [nodeOutput, bunOutput] = await Promise.all([
      runHarness("node"),
      runHarness("bun"),
    ]);

    expect(nodeOutput).toContain("RFC 8785 vectors with node");
    expect(bunOutput).toContain("RFC 8785 vectors with bun");
  });
});
