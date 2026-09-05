/**
 * Public API of the clockwork-kitten conform engine.
 *
 * Slice 1 exposes config resolution and the markdown-lint runner. Structural
 * document operations are added in a later slice and will consume the same
 * resolved config object.
 */
export { STUDIO_MARKDOWNLINT_BASELINE } from "./config/baseline.ts";
export { deepMerge, isPlainObject, type PlainObject } from "./config/merge.ts";
export {
	CONFIG_FILENAMES,
	ConfigError,
	discoverConfigPath,
	loadConfigFile,
	resolveConfig,
	resolveMarkdownlintConfig,
	resolveReferencesConfig,
	type ResolvedConfig,
	type ResolvedReferencesConfig,
} from "./config/resolve.ts";
export {
	defineConfig,
	type ConformConfig,
	type MarkdownlintConfig,
	type ReferencesConfig,
} from "./config/types.ts";
export { formatIssues, lintContent, lintFiles, type LintIssue } from "./lint/markdown.ts";
export {
	checkReferences,
	extractReferences,
	formatReferenceIssues,
	type CheckReferencesOptions,
	type Reference,
	type ReferenceIssue,
} from "./lint/references.ts";
