import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseJsonc, type ParseError } from "jsonc-parser";
import { STUDIO_MARKDOWNLINT_BASELINE } from "./baseline.ts";
import { deepMerge, isPlainObject, type PlainObject } from "./merge.ts";
import type { ConformConfig, MarkdownlintConfig, ReferencesConfig } from "./types.ts";

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

/** The reference-checker settings for a run, with defaults applied. */
export type ResolvedReferencesConfig = Required<ReferencesConfig>;

/** The effective configuration for a run, plus where it came from. */
export type ResolvedConfig = {
	markdownlint: MarkdownlintConfig;
	references: ResolvedReferencesConfig;
	/** Human-readable description of the config source, for logging. */
	source: string;
};

/**
 * Compute the effective markdownlint config from a loaded conform config.
 *
 * Unless `extends` is `false`, the config's `markdownlint` overrides are
 * deep-merged over the studio baseline so a repo can adjust one rule without
 * re-declaring the whole baseline. This is pure — the linter and, later, the
 * structural operations consume exactly this object.
 */
export function resolveMarkdownlintConfig(config: ConformConfig): MarkdownlintConfig {
	const overrides = (config.markdownlint ?? {}) as PlainObject;
	if (config.extends === false) {
		return { ...overrides } as MarkdownlintConfig;
	}
	return deepMerge(STUDIO_MARKDOWNLINT_BASELINE as PlainObject, overrides) as MarkdownlintConfig;
}

/**
 * Compute the effective reference-checker settings from a loaded conform config.
 * The checker has no studio baseline, so this only fills defaults; `ignore`
 * defaults to empty (resolve every internal reference).
 */
export function resolveReferencesConfig(config: ConformConfig): ResolvedReferencesConfig {
	return { ignore: [...(config.references?.ignore ?? [])] };
}

function isConfigModule(value: unknown): value is ConformConfig {
	return isPlainObject(value);
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
		} catch (cause) {
			throw new ConfigError(`Could not read config file: ${path}`, { cause });
		}
		const errors: ParseError[] = [];
		const parsed: unknown = parseJsonc(text, errors, { allowTrailingComma: true });
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
	} catch (cause) {
		throw new ConfigError(`Could not import config file: ${path}`, { cause });
	}
	const candidate = mod.default ?? mod;
	if (!isConfigModule(candidate)) {
		throw new ConfigError(`Config file must export a config object: ${path}`);
	}
	return candidate;
}

/**
 * Find the first existing config file at `cwd`, or `undefined` if none.
 */
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
 * Resolve the effective config for a run: an explicit `configPath` wins,
 * otherwise the first `conform.config.*` found at `cwd`, otherwise the bundled
 * studio baseline. Throws {@link ConfigError} only when a config file is present
 * but broken.
 */
export async function resolveConfig(options: {
	cwd: string;
	configPath?: string | undefined;
}): Promise<ResolvedConfig> {
	const { cwd, configPath } = options;
	const path = configPath
		? isAbsolute(configPath)
			? configPath
			: resolve(cwd, configPath)
		: discoverConfigPath(cwd);

	if (!path) {
		return {
			markdownlint: { ...STUDIO_MARKDOWNLINT_BASELINE },
			references: { ignore: [] },
			source: "studio baseline (no config file found)",
		};
	}

	const config = await loadConfigFile(path);
	return {
		markdownlint: resolveMarkdownlintConfig(config),
		references: resolveReferencesConfig(config),
		source: path,
	};
}
