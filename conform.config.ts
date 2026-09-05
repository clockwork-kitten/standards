import { defineConfig } from "@clockwork-kitten/conform";

// The standards repo tracks the studio markdownlint baseline exactly, so there
// are no markdownlint overrides here. This file dogfoods config discovery and
// the defineConfig authoring API.
//
// The reference checker resolves internal cross-references. These docs also cite
// governance docs that live in the ops repo (CK-004 etc.), not here, so those
// backtick paths are marked external and not resolved on disk.
export default defineConfig({
	references: {
		ignore: ["docs/DECISIONS.md", "docs/oss-policy.md", "ops/docs/"],
	},
});
