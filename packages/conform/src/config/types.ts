import type { Configuration } from "markdownlint";

/**
 * The markdownlint rule configuration a conform config can carry. Mirrors the
 * shape of a `.markdownlint.jsonc` file (see the studio baseline).
 */
export type MarkdownlintConfig = Configuration;

/**
 * A `conform` configuration, as authored in `conform.config.ts` or
 * `conform.config.jsonc` at a repo root.
 *
 * Slice 1 carries only markdown-lint settings; structural document schemas and
 * hygiene settings are added in later engine slices.
 */
export type ConformConfig = {
	/**
	 * Whether to layer this config on top of the bundled studio baseline.
	 * Defaults to `true` (deep-merge over the baseline). Set to `false` to use
	 * only the settings declared here.
	 */
	extends?: boolean;
	/** markdownlint rule overrides, deep-merged over the studio baseline. */
	markdownlint?: MarkdownlintConfig;
};

/**
 * Identity helper giving repo authors type-checking and editor completion when
 * writing a `conform.config.ts`.
 */
export function defineConfig(config: ConformConfig): ConformConfig {
	return config;
}
