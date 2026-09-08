import { type ParseError, parse as parseJsonc } from "jsonc-parser";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { ConformConfig } from "./types.ts";

/** Raised when a config file exists but cannot be loaded or parsed. */
export class ConfigError extends Error {
  override name = "ConfigError";
}

/** Config filenames tried at a repo root, in precedence order. */
export const CONFIG_FILENAMES = [
  "conform.config.ts",
  "conform.config.mts",
  "conform.config.mjs",
  "conform.config.js",
  "conform.config.jsonc",
  "conform.config.json",
] as const;

/** The code-track settings for a run, with defaults applied. */
export type ResolvedCodeConfig = {
  /** File patterns bedrock normalizes, or `false` when the tool is off. */
  bedrock: false | string[];
  eslint: boolean;
  knip: boolean;
  prettier: boolean;
  tsconfig: string;
  typecheck: boolean;
};

/** The effective configuration for a run, plus where it came from. */
export type ResolvedConfig = {
  /** The code-track settings, or `undefined` when the repo declares no `code` block. */
  code: ResolvedCodeConfig | undefined;
  /** Human-readable description of the config source, for logging. */
  source: string;
};

/** Default tsconfig used by the code-track typecheck. */
export const DEFAULT_TSCONFIG = "tsconfig.json";

/** Default path(s) bedrock normalizes when `code.bedrock` is `true`. */
export const DEFAULT_BEDROCK_FILES = ["src"];

/** Find the first existing config file at `cwd`, or `undefined` if none. */
export function discoverConfigPath(cwd: string): string | undefined {
  for (const name of CONFIG_FILENAMES) {
    const candidate = resolve(cwd, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Load and parse a single conform config file. Throws {@link ConfigError} if the
 * file cannot be imported/parsed or does not export a config object.
 */
export async function loadConfigFile(path: string): Promise<ConformConfig> {
  if (/\.jsonc?$/.test(path)) {
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch (error) {
      throw new ConfigError(`Could not read config file: ${path}`, {
        cause: error,
      });
    }
    const errors: ParseError[] = [];
    const parsed: unknown = parseJsonc(text, errors, {
      allowTrailingComma: true,
    });
    if (errors.length > 0) {
      throw new ConfigError(`Invalid JSONC in config file: ${path}`);
    }
    if (!isConfigModule(parsed)) {
      throw new ConfigError(`Config file must contain an object: ${path}`);
    }
    return parsed;
  }

  let mod: { default?: unknown };
  try {
    mod = (await import(pathToFileURL(path).href)) as { default?: unknown };
  } catch (error) {
    throw new ConfigError(`Could not import config file: ${path}`, {
      cause: error,
    });
  }
  const candidate = mod.default ?? mod;
  if (!isConfigModule(candidate)) {
    throw new ConfigError(`Config file must export a config object: ${path}`);
  }
  return candidate;
}

/**
 * Compute the effective code-track settings, or `undefined` when the config
 * declares no `code` block (docs-only repos). Each tool defaults to enabled, so
 * a bare `code: {}` runs the full baseline.
 */
export function resolveCodeConfig(
  config: ConformConfig,
): ResolvedCodeConfig | undefined {
  const code = config.code;
  if (!code) {
    return undefined;
  }
  return {
    bedrock: resolveBedrock(code.bedrock),
    eslint: code.eslint ?? true,
    knip: code.knip ?? true,
    prettier: code.prettier ?? true,
    tsconfig: code.tsconfig ?? DEFAULT_TSCONFIG,
    typecheck: code.typecheck ?? true,
  };
}

/**
 * Resolve the effective conform config for a run: an explicit `configPath` wins,
 * otherwise the first `conform.config.*` found at `cwd`, otherwise no code track
 * is declared. Documentation config is discovered by canon from `canon.config.*`.
 */
export async function resolveConfig(options: {
  configPath?: string | undefined;
  cwd: string;
}): Promise<ResolvedConfig> {
  const { configPath, cwd } = options;
  const path = configPath
    ? isAbsolute(configPath)
      ? configPath
      : resolve(cwd, configPath)
    : discoverConfigPath(cwd);

  if (!path) {
    return {
      code: undefined,
      source: "no config file found",
    };
  }

  const config = await loadConfigFile(path);
  return {
    code: resolveCodeConfig(config),
    source: path,
  };
}

function isConfigModule(value: unknown): value is ConformConfig {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Normalize the `code.bedrock` option to the resolved file patterns, or `false`
 * when off. `true` uses {@link DEFAULT_BEDROCK_FILES}; an explicit array is used
 * as-is; an empty array is treated as off (nothing to normalize).
 */
function resolveBedrock(
  value: boolean | string[] | undefined,
): false | string[] {
  if (Array.isArray(value)) {
    return value.length > 0 ? value : false;
  }
  return value ? [...DEFAULT_BEDROCK_FILES] : false;
}
