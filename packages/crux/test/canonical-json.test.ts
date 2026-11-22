import { CryptoHasher } from "bun";
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const VECTOR_PATH = fileURLToPath(
  new URL("fixtures/canonical-json/vectors.json", import.meta.url),
);

type JsonValue =
  boolean | JsonValue[] | null | number | string | { [key: string]: JsonValue };

type VectorFixture = {
  algorithm: "RFC 8785";
  fixtureRevision: number;
  hash: "SHA-256";
  targetRuntimes: string[];
  vectors: {
    canonical: string;
    input: JsonValue;
    name: string;
    sha256: string;
  }[];
};

function canonicalize(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value)
      .toSorted()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalize(value[key] as JsonValue)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

describe("RFC 8785 canonical JSON vectors", () => {
  test("produce stable canonical bytes and SHA-256 hashes", async () => {
    const fixture = JSON.parse(
      await readFile(VECTOR_PATH, "utf8"),
    ) as VectorFixture;

    expect(fixture.fixtureRevision).toBe(1);
    expect(fixture.algorithm).toBe("RFC 8785");
    expect(fixture.hash).toBe("SHA-256");
    expect(fixture.targetRuntimes).toEqual([
      "node-24",
      "node-26",
      "bun-development",
    ]);
    for (const vector of fixture.vectors) {
      const canonical = canonicalize(vector.input);
      expect(canonical, vector.name).toBe(vector.canonical);
      expect(
        new CryptoHasher("sha256").update(canonical).digest("hex"),
        vector.name,
      ).toBe(vector.sha256);
    }
  });
});
