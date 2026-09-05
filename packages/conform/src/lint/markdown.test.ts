import { describe, expect, it } from "vitest";
import { STUDIO_MARKDOWNLINT_BASELINE } from "../config/baseline.ts";
import { formatIssues, lintContent } from "./markdown.ts";

describe("lintContent", () => {
	it("reports no issues for conformant markdown", async () => {
		const issues = await lintContent(
			{ "ok.md": "# Title\n\nA conformant paragraph.\n" },
			STUDIO_MARKDOWNLINT_BASELINE,
		);
		expect(issues).toEqual([]);
	});

	it("flags a missing top-level heading", async () => {
		const issues = await lintContent(
			{ "bad.md": "no heading here\n" },
			STUDIO_MARKDOWNLINT_BASELINE,
		);
		const rules = issues.map((issue) => issue.rule);
		expect(rules).toContain("MD041/first-line-heading");
		expect(issues[0]?.file).toBe("bad.md");
	});

	it("respects config overrides — MD013 off means long lines pass", async () => {
		const longLine = `# Title\n\n${"word ".repeat(40).trim()}\n`;
		const withBaseline = await lintContent({ "a.md": longLine }, STUDIO_MARKDOWNLINT_BASELINE);
		expect(withBaseline.some((issue) => issue.rule.startsWith("MD013"))).toBe(false);

		const withMd013 = await lintContent({ "a.md": longLine }, { default: true, MD013: true });
		expect(withMd013.some((issue) => issue.rule.startsWith("MD013"))).toBe(true);
	});

	it("sorts issues by file then line", async () => {
		const issues = await lintContent(
			{ "z.md": "#x\n", "a.md": "#y\n" },
			STUDIO_MARKDOWNLINT_BASELINE,
		);
		const files = issues.map((issue) => issue.file);
		expect(files).toEqual([...files].sort());
	});
});

describe("formatIssues", () => {
	it("returns an empty string for no issues", () => {
		expect(formatIssues([])).toBe("");
	});

	it("renders file:line rule description with optional detail", () => {
		const line = formatIssues([
			{ file: "a.md", line: 3, rule: "MD012/no-multiple-blanks", description: "Multiple blanks", detail: "Expected: 1" },
		]);
		expect(line).toBe("a.md:3 MD012/no-multiple-blanks Multiple blanks [Expected: 1]");
	});
});
