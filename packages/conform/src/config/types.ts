import type { Configuration } from "markdownlint";

/**
 * The markdownlint rule configuration a conform config can carry. Mirrors the
 * shape of a `.markdownlint.jsonc` file (see the studio baseline).
 */
export type MarkdownlintConfig = Configuration;

/** Configuration for the internal cross-reference checker. */
export type ReferencesConfig = {
	/**
	 * Substrings marking a backtick root-relative path as external/cross-repo:
	 * any `` `path.md` `` containing one is not resolved on disk. Use this for
	 * paths that live in another repo (e.g. `ops/docs/`).
	 */
	ignore?: string[];
};

/**
 * A `conform` configuration, as authored in `conform.config.ts` or
 * `conform.config.jsonc` at a repo root.
 *
 * Carries markdown-lint settings and reference-checker settings; structural
 * document schemas and generators are added in later engine slices.
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
	/** Internal cross-reference checker settings. */
	references?: ReferencesConfig;
};

/**
 * Identity helper giving repo authors type-checking and editor completion when
 * writing a `conform.config.ts`.
 */
export function defineConfig(config: ConformConfig): ConformConfig {
	return config;
}
