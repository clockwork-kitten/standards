import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The shipped config is a plain `.js` flat-config module with no type declarations;
// consumers import it the same way from their `eslint.config.js`.
// @ts-expect-error - JS config module ships no types
import astroConfig from "../../configs/eslint.astro.js";

/**
 * Dogfood for the shipped Astro overlay. `standards` has no `.astro` source of its
 * own, so we validate the config the way a consumer would exercise it: run ESLint's
 * flat-config API with `configs/eslint.astro.js` against two fixtures and assert the
 * parser wires up and the a11y overlay actually reports. This proves the reuse
 * baseline works end to end without turning this repo into an Astro project.
 */
const fixturesDir = fileURLToPath(
  new URL("__fixtures__/astro/", import.meta.url),
);

async function lintFixture(name: string): Promise<ESLint.LintResult> {
  const results = await makeEslint().lintFiles([`${fixturesDir}${name}`]);
  const result = results[0];
  if (!result) {
    throw new Error(`no lint result for ${name}`);
  }
  return result;
}

function makeEslint(): ESLint {
  return new ESLint({
    baseConfig: astroConfig,
    cwd: fixturesDir,
    // Use only the shipped overlay; ignore any ambient project config.
    overrideConfigFile: true,
  });
}

describe("eslint.astro config", () => {
  it("parses a conformant .astro file with no findings", async () => {
    const result = await lintFixture("Clean.astro");

    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it("flags an accessibility violation in a bad .astro file", async () => {
    const result = await lintFixture("Bad.astro");

    expect(result.errorCount).toBeGreaterThan(0);
    // The a11y overlay is active and the astro parser resolved the template.
    expect(result.messages.map((message) => message.ruleId)).toContain(
      "astro/jsx-a11y/alt-text",
    );
  });
});
