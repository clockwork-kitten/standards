import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildCharacterizationGoldens,
  CHARACTERIZATION_DIR,
  characterizationHash,
  findGoldenDrift,
  GOLDEN_FILENAMES,
  stableSerialize,
  verifyCharacterizationProvenance,
} from "./generate.ts";

function committedGoldens(): Record<string, unknown> {
  return Object.fromEntries(
    GOLDEN_FILENAMES.map((filename) => [
      filename,
      JSON.parse(
        readFileSync(join(CHARACTERIZATION_DIR, filename), "utf8"),
      ) as unknown,
    ]),
  );
}

describe("pre-split Conform characterization", () => {
  it("normalizes reversed nested object-key insertion order", () => {
    const left = { a: { c: 3, d: 4 }, z: [{ a: 1, b: 2 }] };
    const right = Object.fromEntries([
      [
        "z",
        [
          Object.fromEntries([
            ["b", 2],
            ["a", 1],
          ]),
        ],
      ],
      [
        "a",
        Object.fromEntries([
          ["d", 4],
          ["c", 3],
        ]),
      ],
    ]);

    expect(stableSerialize(left)).toBe(stableSerialize(right));
    expect(characterizationHash(left)).toBe(characterizationHash(right));
  });

  it("preserves contractually meaningful array order and reports its drift", () => {
    const left = { tools: ["eslint", "prettier"] };
    const right = { tools: ["prettier", "eslint"] };

    expect(stableSerialize(left)).not.toBe(stableSerialize(right));
    expect(characterizationHash(left)).not.toBe(characterizationHash(right));
    expect(findGoldenDrift({ ordering: left }, { ordering: right })).toEqual([
      "ordering",
    ]);
  });

  it("fails deterministically when source provenance does not match", () => {
    expect(() =>
      verifyCharacterizationProvenance({
        "src/config/resolve.ts": "0".repeat(64),
      }),
    ).toThrowError(
      /^P02 provenance mismatch for "src\/config\/resolve\.ts": expected 0{64}, received [a-f0-9]{64}$/,
    );
  });

  it("commits exactly the machine-readable golden filename set", () => {
    expect(readdirSync(CHARACTERIZATION_DIR).toSorted()).toEqual([
      ...GOLDEN_FILENAMES,
    ]);
  });

  it("reproduces every committed golden with no drift", async () => {
    const generated = await buildCharacterizationGoldens();
    expect(findGoldenDrift(committedGoldens(), generated)).toEqual([]);
  });

  it("reports the exact changed golden when normalized behavior drifts", async () => {
    const generated = await buildCharacterizationGoldens();
    const changed = structuredClone(generated);
    changed["tool-ordering.json"].normalized = { changed: true };

    expect(findGoldenDrift(generated, changed)).toEqual(["tool-ordering.json"]);
  });

  it("keeps migration authority in P01 references rather than copied dispositions", async () => {
    const generated = await buildCharacterizationGoldens();
    for (const golden of Object.values(generated)) {
      expect(golden.p01References.length).toBeGreaterThan(0);
      expect(JSON.stringify(golden)).not.toMatch(
        /"(canonicalId|difference|migration|rationale|target)":/,
      );
    }
  });
});
