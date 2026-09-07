/**
 * Public API of the clockwork-kitten conform engine.
 *
 * Exposes config resolution, the markdown-lint runner, the reference checker,
 * the `llms.txt` generator, and the code-track runner that shells out to the
 * shared ESLint/Prettier/knip/TypeScript toolchain.
 */
export {
  type CodeTool,
  type CodeToolResult,
  enabledTools,
  resolveBin,
  type RunCodeOptions,
  runCodeTrack,
  type RunProcess,
  runProcess,
  toolArgs,
} from "./code/run.ts";
export { STUDIO_MARKDOWNLINT_BASELINE } from "./config/baseline.ts";
export { deepMerge, isPlainObject, type PlainObject } from "./config/merge.ts";
export {
  CONFIG_FILENAMES,
  ConfigError,
  DEFAULT_BEDROCK_FILES,
  DEFAULT_LLMS_OUTPUT,
  DEFAULT_TSCONFIG,
  discoverConfigPath,
  loadConfigFile,
  resolveCodeConfig,
  resolveConfig,
  type ResolvedCodeConfig,
  type ResolvedConfig,
  type ResolvedLlmsConfig,
  type ResolvedLlmsSection,
  type ResolvedReferencesConfig,
  resolveLlmsConfig,
  resolveMarkdownlintConfig,
  resolveReferencesConfig,
} from "./config/resolve.ts";
export {
  type CodeConfig,
  type ConformConfig,
  defineConfig,
  type LlmsConfig,
  type LlmsSection,
  type MarkdownlintConfig,
  type ReferencesConfig,
} from "./config/types.ts";
export {
  fixContents,
  type FixResult,
  formatIssues,
  lintContent,
  lintFiles,
  type LintIssue,
} from "./lint/markdown.ts";
export {
  checkReferences,
  type CheckReferencesOptions,
  extractReferences,
  formatReferenceIssues,
  type Reference,
  type ReferenceIssue,
} from "./lint/references.ts";
export {
  type DocMeta,
  extractDocMeta,
  generateLlms,
  renderLlms,
} from "./ops/llms.ts";
