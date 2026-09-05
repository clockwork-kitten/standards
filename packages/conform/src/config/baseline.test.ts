import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseJsonc } from "jsonc-parser";
import { describe, expect, it } from "vitest";
import { STUDIO_MARKDOWNLINT_BASELINE } from "./baseline.ts";

/**
 * The engine baseline is the in-code source of truth; the repo-root
 * `.markdownlint.jsonc` mirrors it for the v0.1 reusable workflow. This test
 * fails if the two ever drift, so there is exactly one studio standard.
 */
describe("studio markdownlint baseline", () => {
	it("matches the repo-root .markdownlint.jsonc mirror", () => {
		const rootConfigPath = fileURLToPath(new URL("../../../../.markdownlint.jsonc", import.meta.url));
		const mirror: unknown = parseJsonc(readFileSync(rootConfigPath, "utf8"));
		expect(mirror).toEqual(STUDIO_MARKDOWNLINT_BASELINE);
	});
});
