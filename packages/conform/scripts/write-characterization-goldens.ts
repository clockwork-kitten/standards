import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildCharacterizationGoldens,
  CHARACTERIZATION_DIR,
  GOLDEN_FILENAMES,
  stableSerialize,
} from "../src/characterization/generate.ts";

mkdirSync(CHARACTERIZATION_DIR, { recursive: true });
const goldens = await buildCharacterizationGoldens();
for (const filename of GOLDEN_FILENAMES) {
  writeFileSync(
    join(CHARACTERIZATION_DIR, filename),
    stableSerialize(goldens[filename]),
    "utf8",
  );
}
