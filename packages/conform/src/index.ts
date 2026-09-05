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
	DEFAULT_LLMS_OUTPUT,
	discoverConfigPath,
	loadConfigFile,
	resolveConfig,
	resolveLlmsConfig,
	resolveMarkdownlintConfig,
	resolveReferencesConfig,
	type ResolvedConfig,
	type ResolvedLlmsConfig,
	type ResolvedLlmsSection,
	type ResolvedReferencesConfig,
} from "./config/resolve.ts";
export {
	defineConfig,
	type ConformConfig,
	type LlmsConfig,
	type LlmsSection,
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
export {
	extractDocMeta,
	generateLlms,
	renderLlms,
	type DocMeta,
} from "./ops/llms.ts";
