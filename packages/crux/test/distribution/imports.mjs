import assert from "node:assert/strict";

const jsonSubpaths = [
  "schemas/baseline",
  "schemas/bundle",
  "schemas/conform-result",
  "schemas/context",
  "schemas/engine-manifest",
  "schemas/engine-result",
  "schemas/exception",
  "schemas/fingerprint",
  "schemas/inventory-reconciliation",
  "schemas/lock",
  "schemas/migration-disposition",
  "schemas/policy",
  "schemas/profile",
  "schemas/repository-policy",
  "schemas/rule",
  "schemas/suppression-registry",
  "schemas/suppression",
  "schemas/vector-catalog",
  "policy/existing-behavior",
  "vectors/canon",
  "vectors/conform",
  "vectors/crucible",
  "migration/legacy-disposition",
  "reconciliation/existing-behavior",
];

for (const subpath of jsonSubpaths) {
  const loaded = await import(`@clockwork-kitten/crux/${subpath}`, {
    with: { type: "json" },
  });
  assert.equal(typeof loaded.default, "object", subpath);
}

await assert.rejects(
  import("@clockwork-kitten/crux"),
  (error) => error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
);
