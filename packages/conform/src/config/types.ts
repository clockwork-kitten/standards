/**
 * Configuration for the code-conformance track. Each tool defaults to enabled
 * when the `code` block is present, so a bare `code: {}` runs the full baseline;
 * set a flag to `false` to skip that tool. The tools discover their own configs
 * (`eslint.config.js`, the `prettier` field, `knip.*`, the tsconfig), so this
 * block only decides *which* run, not how they are configured.
 */
export type CodeConfig = {
  /**
   * Run `clockwork-kitten/bedrock` semantic normalization (`--report` in check,
   * `--fix` in fix). Off by default — bedrock is maximalist and opt-in. `true`
   * runs it over `src`; pass an array of paths/globs to scope it. Requires
   * bedrock to be installed alongside the engine.
   */
  bedrock?: boolean | string[];
  /** Run ESLint (flat config auto-discovered). Defaults to `true`. */
  eslint?: boolean;
  /** Run knip dead-code / unused-dependency analysis. Defaults to `true`. */
  knip?: boolean;
  /** Run Prettier (`--check` in `check`, `--write` in `fix`). Defaults to `true`. */
  prettier?: boolean;
  /** tsconfig for the `tsc --noEmit` typecheck. Defaults to `tsconfig.json`. */
  tsconfig?: string;
  /** Run the TypeScript typecheck (`tsc --noEmit`). Defaults to `true`. */
  typecheck?: boolean;
};

/**
 * A `conform` configuration, as authored in `conform.config.ts` or
 * `conform.config.jsonc` at a repo root.
 *
 * Conform is a thin orchestrator: `conform check` / `conform fix` delegate the
 * documentation track to canon (configured by `canon.config.*`) and optionally
 * run the code-conformance track configured here.
 */
export type ConformConfig = {
  /**
   * Code-conformance track settings. Its presence opts a repo into `conform
   * check`/`fix` running ESLint, Prettier, knip, and the TypeScript typecheck;
   * omit it entirely and those tools never run (docs-only repos).
   */
  code?: CodeConfig;
};

/**
 * Identity helper giving repo authors type-checking and editor completion when
 * writing a `conform.config.ts`.
 */
export function defineConfig(config: ConformConfig): ConformConfig {
  return config;
}
