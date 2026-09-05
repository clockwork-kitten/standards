import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expandGlobs, parseCheckArgs, runCheck } from "./main.ts";

describe("parseCheckArgs", () => {
	it("defaults to **/*.md with no config", () => {
		expect(parseCheckArgs([])).toEqual({
			globs: ["**/*.md"],
			configPath: undefined,
			references: true,
			referenceIgnore: [],
		});
	});

	it("collects positional globs", () => {
		expect(parseCheckArgs(["docs/**/*.md", "README.md"])).toEqual({
			globs: ["docs/**/*.md", "README.md"],
			configPath: undefined,
			references: true,
			referenceIgnore: [],
		});
	});

	it("parses --config, -c, and --config=", () => {
		expect(parseCheckArgs(["--config", "a.ts"]).configPath).toBe("a.ts");
		expect(parseCheckArgs(["-c", "b.ts"]).configPath).toBe("b.ts");
		expect(parseCheckArgs(["--config=c.ts"]).configPath).toBe("c.ts");
	});

	it("parses --no-references and repeatable --reference-ignore", () => {
		expect(parseCheckArgs(["--no-references"]).references).toBe(false);
		expect(parseCheckArgs(["--reference-ignore", "ops/", "--reference-ignore=docs/x.md"]).referenceIgnore).toEqual(
			["ops/", "docs/x.md"],
		);
	});

	it("throws on a missing --config value or unknown flag", () => {
		expect(() => parseCheckArgs(["--config"])).toThrow(/requires a path/);
		expect(() => parseCheckArgs(["--nope"])).toThrow(/unknown option/);
		expect(() => parseCheckArgs(["--reference-ignore"])).toThrow(/requires a substring/);
	});
});

describe("expandGlobs", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "conform-glob-"));
		writeFileSync(join(dir, "a.md"), "# A\n");
		mkdirSync(join(dir, "sub"));
		writeFileSync(join(dir, "sub", "b.md"), "# B\n");
		mkdirSync(join(dir, "node_modules"));
		writeFileSync(join(dir, "node_modules", "c.md"), "# C\n");
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("finds markdown recursively and skips ignored dirs", () => {
		expect(expandGlobs(["**/*.md"], dir)).toEqual(["a.md", "sub/b.md"]);
	});

	it("de-duplicates across overlapping patterns", () => {
		expect(expandGlobs(["**/*.md", "a.md"], dir)).toEqual(["a.md", "sub/b.md"]);
	});
});

describe("runCheck", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "conform-run-"));
		vi.spyOn(console, "error").mockImplementation(() => {});
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("returns 0 when all files are conformant", async () => {
		writeFileSync(join(dir, "ok.md"), "# Title\n\nGood.\n");
		expect(await runCheck(["**/*.md"], dir)).toBe(0);
	});

	it("returns 1 when a file violates a rule", async () => {
		writeFileSync(join(dir, "bad.md"), "no heading\n");
		expect(await runCheck(["**/*.md"], dir)).toBe(1);
	});

	it("returns 2 on a malformed config file", async () => {
		writeFileSync(join(dir, "ok.md"), "# Title\n\nGood.\n");
		writeFileSync(join(dir, "conform.config.jsonc"), "{ broken");
		expect(await runCheck(["**/*.md"], dir)).toBe(2);
	});

	it("returns 2 on bad arguments", async () => {
		expect(await runCheck(["--config"], dir)).toBe(2);
	});

	it("applies a repo config override (extends:false loosens rules)", async () => {
		// MD041 (first-line-heading) would fire, but the repo config disables it.
		writeFileSync(join(dir, "no-h1.md"), "Just a paragraph, no heading.\n");
		writeFileSync(
			join(dir, "conform.config.jsonc"),
			'{ "extends": false, "markdownlint": { "default": true, "MD041": false, "MD047": false } }',
		);
		expect(await runCheck(["**/*.md"], dir)).toBe(0);
	});

	it("returns 1 on a broken internal link, 0 once --no-references is set", async () => {
		writeFileSync(join(dir, "index.md"), "# Index\n\nSee [gone](missing.md).\n");
		expect(await runCheck(["**/*.md"], dir)).toBe(1);
		expect(await runCheck(["**/*.md", "--no-references"], dir)).toBe(0);
	});

	it("resolves a valid internal link", async () => {
		writeFileSync(join(dir, "index.md"), "# Index\n\nSee [target](target.md).\n");
		writeFileSync(join(dir, "target.md"), "# Target\n\nHere.\n");
		expect(await runCheck(["**/*.md"], dir)).toBe(0);
	});

	it("honors --reference-ignore for a cross-repo backtick path", async () => {
		writeFileSync(join(dir, "index.md"), "# Index\n\nSee `other/repo.md` elsewhere.\n");
		expect(await runCheck(["**/*.md"], dir)).toBe(1);
		expect(await runCheck(["**/*.md", "--reference-ignore", "other/"], dir)).toBe(0);
	});
});
