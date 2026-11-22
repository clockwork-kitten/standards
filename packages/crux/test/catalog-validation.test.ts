import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type CatalogFixture,
  type ManifestFixture,
  validateCatalogTransition,
  validateManifestReconciliation,
} from "../scripts/catalog-validation.ts";

const FIXTURE_DIRECTORY = fileURLToPath(
  new URL("fixtures/ac1", import.meta.url),
);
const MANIFEST_FIXTURE_DIRECTORY = fileURLToPath(
  new URL("fixtures/manifest-reconciliation", import.meta.url),
);

describe("AC1 ownership, identity, and lifecycle fixtures", () => {
  test("produce their exact expected verdicts", async () => {
    const directoryEntries = await readdir(FIXTURE_DIRECTORY);
    const fixtureNames = directoryEntries
      .filter((path) => path.endsWith(".json"))
      .toSorted();

    expect(fixtureNames).toEqual([
      "duplicate-id.json",
      "illegal-transition.json",
      "multiple-owners.json",
      "overlapping-ownership.json",
      "reused-id.json",
      "valid-transition.json",
      "zero-owner.json",
    ]);

    for (const fixtureName of fixtureNames) {
      const fixture = JSON.parse(
        await readFile(join(FIXTURE_DIRECTORY, fixtureName), "utf8"),
      ) as CatalogFixture;

      expect(fixture.fixtureRevision, fixture.name).toBe(1);
      expect(
        validateCatalogTransition(fixture.previous, fixture.current),
        fixture.name,
      ).toEqual(fixture.expectedErrors.toSorted());
    }
  });
});

describe("engine manifest reconciliation fixtures", () => {
  test("produce their exact expected verdicts", async () => {
    const directoryEntries = await readdir(MANIFEST_FIXTURE_DIRECTORY);
    const fixtureNames = directoryEntries
      .filter((path) => path.endsWith(".json"))
      .toSorted();

    expect(fixtureNames).toEqual([
      "missing-coverage.json",
      "unknown-claims.json",
      "valid-complete.json",
      "wrong-owner.json",
    ]);

    for (const fixtureName of fixtureNames) {
      const fixture = JSON.parse(
        await readFile(join(MANIFEST_FIXTURE_DIRECTORY, fixtureName), "utf8"),
      ) as ManifestFixture;

      expect(fixture.fixtureRevision, fixture.name).toBe(1);
      expect(
        validateManifestReconciliation(fixture.rules, fixture.manifest),
        fixture.name,
      ).toEqual(fixture.expectedErrors.toSorted());
    }
  });
});
