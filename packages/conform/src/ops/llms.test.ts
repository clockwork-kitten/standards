import { describe, expect, it } from "vitest";
import type { ResolvedLlmsConfig } from "../config/resolve.ts";
import { extractDocMeta, generateLlms, renderLlms, type DocMeta } from "./llms.ts";

describe("extractDocMeta", () => {
	it("takes the first h1 and the first following paragraph", () => {
		const meta = extractDocMeta("# Title\n\nThe summary line.\n\nMore body.\n", "fallback.md");
		expect(meta).toEqual({ title: "Title", description: "The summary line." });
	});

	it("flattens links and inline formatting in the description", () => {
		const meta = extractDocMeta("# T\n\nSee **bold** and [the docs](x.md) and `code`.\n", "f.md");
		expect(meta.description).toBe("See bold and the docs and code.");
	});

	it("skips non-paragraph blocks between the heading and the first paragraph", () => {
		const meta = extractDocMeta("# T\n\n> a quote\n\n| a | b |\n| - | - |\n\nReal prose here.\n", "f.md");
		expect(meta.description).toBe("Real prose here.");
	});

	it("collapses whitespace across wrapped lines", () => {
		const meta = extractDocMeta("# T\n\nline one\nwrapped   onto  two\n", "f.md");
		expect(meta.description).toBe("line one wrapped onto two");
	});

	it("falls back to the filename and empty description without an h1", () => {
		expect(extractDocMeta("no heading here\n", "readme.md")).toEqual({
			title: "readme.md",
			description: "",
		});
	});
});

const config: ResolvedLlmsConfig = {
	project: "Proj",
	summary: "A summary.",
	output: "llms.txt",
	sections: [
		{ title: "Top level", prefix: "", shallow: true },
		{ title: "Docs", prefix: "docs/", shallow: false },
	],
};

describe("renderLlms", () => {
	it("renders title, summary, and one section per group with first-match placement", () => {
		const docs: DocMeta[] = [
			{ path: "README.md", title: "Readme", description: "root doc" },
			{ path: "docs/a.md", title: "A", description: "" },
			{ path: "docs/deep/b.md", title: "B", description: "nested" },
		];
		expect(renderLlms(docs, config)).toBe(
			[
				"# Proj",
				"",
				"> A summary.",
				"",
				"## Top level",
				"",
				"- [Readme](README.md): root doc",
				"",
				"## Docs",
				"",
				"- [A](docs/a.md)",
				"- [B](docs/deep/b.md): nested",
			].join("\n") + "\n",
		);
	});

	it("omits empty sections and documents matching no section", () => {
		const narrow: ResolvedLlmsConfig = { ...config, sections: [{ title: "Docs", prefix: "docs/", shallow: false }] };
		const out = renderLlms([{ path: "README.md", title: "R", description: "" }], narrow);
		expect(out).toBe("# Proj\n\n> A summary.\n");
	});
});

describe("generateLlms", () => {
	it("sorts files and reads each via the injected reader", () => {
		const files = ["docs/b.md", "README.md", "docs/a.md"];
		const contents: Record<string, string> = {
			"README.md": "# Home\n\nThe root.\n",
			"docs/a.md": "# Alpha\n\nFirst doc.\n",
			"docs/b.md": "# Beta\n\nSecond doc.\n",
		};
		const out = generateLlms(files, config, (path) => contents[path] ?? "");
		expect(out).toContain("- [Home](README.md): The root.");
		// docs sorted: a before b
		expect(out.indexOf("docs/a.md")).toBeLessThan(out.indexOf("docs/b.md"));
	});
});
