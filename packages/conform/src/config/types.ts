import type { Configuration } from "markdownlint";

/**
 * Configuration for the code-conformance track. Each tool defaults to enabled
 * when the `code` block is present, so a bare `code: {}` runs the full baseline;
 * set a flag to `false` to skip that tool. The tools discover their own configs
 * (`eslint.config.js`, the `prettier` field, `knip.*`, the tsconfig), so this
 * block only decides *which* run, not how they are configured.
 */
export type CodeConfig = {
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
 * Carries markdown-lint settings, reference-checker settings, and the optional
 * `llms.txt` generator config; structural document schemas are added in later
 * engine slices.
 */
export type ConformConfig = {
  /**
   * Code-conformance track settings. Its presence opts a repo into `conform
   * check`/`fix` running ESLint, Prettier, knip, and the TypeScript typecheck;
   * omit it entirely and those tools never run (docs-only repos).
   */
  code?: CodeConfig;
  /**
   * Whether to layer this config on top of the bundled studio baseline.
   * Defaults to `true` (deep-merge over the baseline). Set to `false` to use
   * only the settings declared here.
   */
  extends?: boolean;
  /** `llms.txt` generator settings (per-repo; required to run `conform llms`). */
  llms?: LlmsConfig;
  /** markdownlint rule overrides, deep-merged over the studio baseline. */
  markdownlint?: MarkdownlintConfig;
  /** Internal cross-reference checker settings. */
  references?: ReferencesConfig;
};

/**
 * Configuration for `conform llms`, which generates an `llms.txt` doc index
 * (https://llmstxt.org/). All fields are per-repo, so this block only makes
 * sense in a repo's own `conform.config.*`.
 */
export type LlmsConfig = {
  /** Output path relative to the repo root. Defaults to `llms.txt`. */
  output?: string;
  /** Project title rendered as the `# ` heading. */
  project: string;
  /** Ordered sections; a document joins the first whose prefix it matches. */
  sections: LlmsSection[];
  /** One-line summary rendered as the `> ` blockquote. */
  summary: string;
};

/** One section of the generated `llms.txt`, matched by path prefix. */
export type LlmsSection = {
  /**
   * Repo-relative posix path prefix a document must start with to join this
   * section. Defaults to `""` (match any path). Documents join the first
   * section they match, so order sections most-specific-last if prefixes nest.
   */
  prefix?: string;
  /**
   * When true, only documents *directly* under `prefix` match — a document
   * with any further `/` in its path is left for a later section. Use this to
   * keep a top-level group from swallowing nested docs.
   */
  shallow?: boolean;
  /** Heading rendered for this group (the `##` line). */
  title: string;
};

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
 * Identity helper giving repo authors type-checking and editor completion when
 * writing a `conform.config.ts`.
 */
export function defineConfig(config: ConformConfig): ConformConfig {
  return config;
}
