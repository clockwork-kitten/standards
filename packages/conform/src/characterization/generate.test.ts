import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildCharacterizationGoldens,
  CHARACTERIZATION_DIR,
  characterizationHash,
  findGoldenDrift,
  GOLDEN_FILENAMES,
  stableSerialize,
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
  it("normalizes object keys deterministically without reordering arrays", () => {
    const left = { a: { c: 3, d: 4 }, z: [{ a: 1, b: 2 }] };
    const right = { a: { c: 3, d: 4 }, z: [{ a: 1, b: 2 }] };

    expect(stableSerialize(left)).toBe(stableSerialize(right));
    expect(characterizationHash(left)).toBe(characterizationHash(right));
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
