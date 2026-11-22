import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const VECTOR_PATH = fileURLToPath(
  new URL("../test/fixtures/canonical-json/vectors.json", import.meta.url),
);

function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value)
      .toSorted()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("RFC 8785 input must be valid JSON");
  }
  return serialized;
}

function projectArtifactHashInput(artifact, source) {
  switch (artifact) {
    case "context": {
      return select(source, [
        "bundleId",
        "policy",
        "rules",
        "canonicalResultPath",
      ]);
    }
    case "effective-policy": {
      return select(source, ["effectivePolicyInputs"]);
    }
    case "fingerprint": {
      return select(source, [
        "ruleId",
        "path",
        "structuralAnchor",
        "evidenceIdentity",
        "occurrenceOrdinal",
      ]);
    }
    case "policy": {
      return select(source, ["policyId", "policyVersion", "rules"]);
    }
    default: {
      throw new TypeError(`Unknown artifact vector: ${artifact}`);
    }
  }
}

function select(source, keys) {
  return Object.fromEntries(keys.map((key) => [key, source[key]]));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const fixture = JSON.parse(await readFile(VECTOR_PATH, "utf8"));
assert.equal(fixture.fixtureRevision, 2);
assert.equal(fixture.algorithm, "RFC 8785");
assert.equal(fixture.hash, "SHA-256");
assert.deepEqual(fixture.targetRuntimes, [
  "node-24",
  "node-26",
  "bun-development",
]);
assert.ok(fixture.provenance.length >= 2);

for (const vector of fixture.rfcVectors) {
  const canonical = canonicalize(vector.input);
  assert.equal(canonical, vector.canonical, vector.name);
  assert.equal(sha256(canonical), vector.sha256, vector.name);
}

for (const vector of fixture.artifactVectors) {
  const input = projectArtifactHashInput(vector.artifact, vector.input);
  const variant = projectArtifactHashInput(
    vector.artifact,
    vector.excludedVariant,
  );
  const canonical = canonicalize(input);
  assert.deepEqual(variant, input, `${vector.name}: excluded fields leaked`);
  assert.equal(canonical, vector.canonical, vector.name);
  assert.equal(sha256(canonical), vector.sha256, vector.name);
}

console.log(
  `verified ${fixture.rfcVectors.length + fixture.artifactVectors.length} RFC 8785 vectors with ${globalThis.Bun === undefined ? process.release.name : "bun"} ${process.version}`,
);
