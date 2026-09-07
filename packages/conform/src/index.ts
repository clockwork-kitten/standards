/**
 * Public API of the clockwork-kitten conform orchestrator.
 *
 * Exposes config resolution plus the code-track and docs-track runners that
 * shell out to the pinned toolchains. Canon owns documentation conformance via
 * `canon.config.*`; conform coordinates canon with the optional code track.
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
export {
  CONFIG_FILENAMES,
  ConfigError,
  DEFAULT_BEDROCK_FILES,
  DEFAULT_TSCONFIG,
  discoverConfigPath,
  loadConfigFile,
  resolveCodeConfig,
  resolveConfig,
  type ResolvedCodeConfig,
  type ResolvedConfig,
} from "./config/resolve.ts";
export {
  type CodeConfig,
  type ConformConfig,
  defineConfig,
} from "./config/types.ts";
export {
  type DocsMode,
  type RunDocsOptions,
  runDocsTrack,
} from "./docs/run.ts";
