#!/usr/bin/env bun
import { globSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";
import { ConfigError, resolveConfig } from "../config/resolve.ts";
import { formatIssues, lintFiles } from "../lint/markdown.ts";

/** Directory names never descended into when expanding globs. */
export const IGNORE_DIRS = new Set(["node_modules", ".git", ".standards"]);

/** Default glob when the user passes no positional patterns. */
export const DEFAULT_GLOBS = ["**/*.md"] as const;

const USAGE = "usage: conform check [globs...] [--config <path>]";

/** Parsed arguments for `conform check`. */
export type CheckArgs = {
	globs: string[];
	configPath: string | undefined;
};

/**
 * Parse the arguments to `conform check`. Positional args are globs (defaulting
 * to `**\/*.md`); `--config`/`-c` selects a config file. Throws on unknown flags
 * or a missing `--config` value.
 */
export function parseCheckArgs(argv: string[]): CheckArgs {
	const globs: string[] = [];
	let configPath: string | undefined;
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index] as string;
		if (arg === "--config" || arg === "-c") {
			const next = argv[index + 1];
			if (next === undefined) {
				throw new Error(`${arg} requires a path`);
			}
			configPath = next;
			index += 1;
		} else if (arg.startsWith("--config=")) {
			configPath = arg.slice("--config=".length);
		} else if (arg.startsWith("-")) {
			throw new Error(`unknown option: ${arg}`);
		} else {
			globs.push(arg);
		}
	}
	return {
		globs: globs.length > 0 ? globs : [...DEFAULT_GLOBS],
		configPath,
	};
}

/** Expand globs relative to `cwd`, dropping ignored directories. Sorted, unique. */
export function expandGlobs(globs: string[], cwd: string): string[] {
	const found = new Set<string>();
	for (const pattern of globs) {
		for (const relative of globSync(pattern, { cwd })) {
			const normalized = relative.split("\\").join("/");
			const segments = normalized.split("/");
			if (segments.some((segment) => IGNORE_DIRS.has(segment))) {
				continue;
			}
			found.add(normalized);
		}
	}
	return [...found].sort();
}

/** Run `conform check`; returns a process exit code. */
export async function runCheck(argv: string[], cwd: string): Promise<number> {
	let args: CheckArgs;
	try {
		args = parseCheckArgs(argv);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		console.error(USAGE);
		return 2;
	}

	let resolved;
	try {
		resolved = await resolveConfig({ cwd, configPath: args.configPath });
	} catch (error) {
		if (error instanceof ConfigError) {
			console.error(error.message);
			return 2;
		}
		throw error;
	}

	const files = expandGlobs(args.globs, cwd);
	// markdownlint reads files relative to process.cwd(); pass absolute paths so
	// a caller-supplied cwd is honored, then relativize findings for display.
	const absolute = files.map((file) => join(cwd, file));
	const issues = (await lintFiles(absolute, resolved.markdownlint)).map((issue) => ({
		...issue,
		file: relative(cwd, issue.file),
	}));

	console.error(`conform check · markdown lint · ${resolved.source}`);
	if (issues.length > 0) {
		console.error(formatIssues(issues));
		console.error(`\n${issues.length} issue(s) across ${files.length} file(s)`);
		return 1;
	}
	console.error(`${files.length} file(s) conformant`);
	return 0;
}

async function main(): Promise<number> {
	const [subcommand, ...rest] = process.argv.slice(2);
	if (subcommand !== "check") {
		console.error(USAGE);
		return 2;
	}
	return runCheck(rest, process.cwd());
}

// Only run when executed directly (e.g. `bun src/cli/main.ts`), not when
// imported by tests. `import.meta.main` is a Bun/Node entrypoint signal.
if ((import.meta as { main?: boolean }).main) {
	main()
		.then((code) => {
			process.exitCode = code;
		})
		.catch((error: unknown) => {
			console.error(error);
			process.exitCode = 1;
		});
}
