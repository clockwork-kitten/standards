import { defineConfig } from "@clockwork-kitten/conform";

// The standards repo tracks the studio markdownlint baseline exactly, so there
// are no markdownlint overrides here. This file dogfoods config discovery and
// the defineConfig authoring API.
export default defineConfig({
	// The reference checker resolves internal cross-references. These docs also
	// cite governance docs that live in the ops repo (CK-004 etc.), not here, so
	// those backtick paths are marked external and not resolved on disk.
	references: {
		ignore: ["docs/DECISIONS.md", "docs/oss-policy.md", "ops/docs/"],
	},
	// `conform llms` generates llms.txt (https://llmstxt.org/) — the engine
	// dogfooding its own doc-index generator. Sections match by path prefix; a
	// doc joins the first it matches, so the shallow root section is listed first.
	llms: {
		project: "Clockwork Kitten — standards",
		summary:
			"The studio's machine-checkable engineering standards and reusable CI: the conform engine, shared markdownlint baseline, and reusable workflows every clockwork-kitten repo consumes.",
		sections: [
			{ title: "Standards home", prefix: "", shallow: true },
			{ title: "Reference docs", prefix: "docs/" },
			{ title: "Conform engine", prefix: "packages/" },
		],
	},
});
