import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expandGlobs, parseCheckArgs, runCheck } from "./main.ts";

describe("parseCheckArgs", () => {
	it("defaults to **/*.md with no config", () => {
		expect(parseCheckArgs([])).toEqual({ globs: ["**/*.md"], configPath: undefined });
	});

	it("collects positional globs", () => {
		expect(parseCheckArgs(["docs/**/*.md", "README.md"])).toEqual({
			globs: ["docs/**/*.md", "README.md"],
			configPath: undefined,
		});
	});

	it("parses --config, -c, and --config=", () => {
		expect(parseCheckArgs(["--config", "a.ts"]).configPath).toBe("a.ts");
		expect(parseCheckArgs(["-c", "b.ts"]).configPath).toBe("b.ts");
		expect(parseCheckArgs(["--config=c.ts"]).configPath).toBe("c.ts");
	});

	it("throws on a missing --config value or unknown flag", () => {
		expect(() => parseCheckArgs(["--config"])).toThrow(/requires a path/);
		expect(() => parseCheckArgs(["--nope"])).toThrow(/unknown option/);
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
});
