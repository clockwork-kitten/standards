import { defineConfig } from "@clockwork-kitten/conform";

// The standards repo tracks the studio markdownlint baseline exactly, so there
// are no overrides here. This file exists to dogfood config discovery and the
// defineConfig authoring API — proving the zero-override case resolves to the
// bundled baseline.
export default defineConfig({});
