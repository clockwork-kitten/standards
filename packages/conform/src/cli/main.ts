#!/usr/bin/env bun
import process from "node:process";

import { runCodeTrack } from "../code/run.ts";
import { ConfigError, resolveConfig } from "../config/resolve.ts";
import { runDocsTrack } from "../docs/run.ts";

/** Default glob when the user passes no positional patterns. */
export const DEFAULT_GLOBS = ["**/*.md"] as const;

const USAGE =
  "usage: conform check [globs...] [--config <path>] [--no-references] [--no-code] [--reference-ignore <substr>]";

/** Parsed arguments for `conform check`. */
export type CheckArgs = {
  /** Whether to run the code track when the config declares one (default true). */
  code: boolean;
  configPath: string | undefined;
  globs: string[];
  /** Extra ignore substrings forwarded to canon. */
  referenceIgnore: string[];
  /** Whether canon should run the reference checker (default true). */
  references: boolean;
};

type RunCheckDeps = {
  runCode?: typeof runCodeTrack;
  runDocs?: typeof runDocsTrack;
};

/**
 * Parse the arguments to `conform check`. Positional args are globs (defaulting
 * to `**\/*.md`); `--config`/`-c` selects conform's config file; canon discovers
 * its own `canon.config.*`; `--no-references` and repeatable
 * `--reference-ignore` are forwarded to canon; `--no-code` disables the code
 * track. Throws on unknown flags or a missing option value.
 */
export function parseCheckArgs(argv: string[]): CheckArgs {
  const globs: string[] = [];
  let configPath: string | undefined;
  let isReferences = true;
  let isCode = true;
  const referenceIgnore: string[] = [];
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
    } else if (arg === "--no-references") {
      isReferences = false;
    } else if (arg === "--no-code") {
      isCode = false;
    } else if (arg === "--reference-ignore") {
      const next = argv[index + 1];
      if (next === undefined) {
        throw new Error(`${arg} requires a substring`);
      }
      referenceIgnore.push(next);
      index += 1;
    } else if (arg.startsWith("--reference-ignore=")) {
      referenceIgnore.push(arg.slice("--reference-ignore=".length));
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown option: ${arg}`);
    } else {
      globs.push(arg);
    }
  }
  return {
    code: isCode,
    configPath,
    globs: globs.length > 0 ? globs : [...DEFAULT_GLOBS],
    referenceIgnore,
    references: isReferences,
  };
}

/** Run `conform check`; returns a process exit code. */
export async function runCheck(
  argv: string[],
  cwd: string,
  deps: RunCheckDeps = {},
): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return 0;
  }

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
    resolved = await resolveConfig({ configPath: args.configPath, cwd });
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      return 2;
    }
    throw error;
  }

  const runDocs = deps.runDocs ?? runDocsTrack;
  const runCode = deps.runCode ?? runCodeTrack;
  let exitCode = 0;

  const docsCode = await runDocs({
    cwd,
    globs: args.globs,
    llms: true,
    mode: "check",
    referenceIgnore: args.referenceIgnore,
    references: args.references,
  });
  if (docsCode !== 0) {
    exitCode = 1;
  }

  if (args.code && resolved.code) {
    const results = await runCode({
      config: resolved.code,
      cwd,
      mode: "check",
    });
    for (const result of results) {
      if (result.code === 0) {
        continue;
      }
      console.error(`conform check · code · ${result.tool} failed`);
      exitCode = 1;
    }
  }

  return exitCode;
}

const FIX_USAGE =
  "usage: conform fix [globs...] [--config <path>] [--no-code] [--no-llms]";

/** Parsed arguments for `conform fix`. */
export type FixArgs = {
  /** Whether to run the code fixers when the config declares a code track (default true). */
  code: boolean;
  configPath: string | undefined;
  globs: string[];
  /** Whether canon fix should also regenerate the `llms.txt` index (default true). */
  llms: boolean;
};

type RunFixDeps = RunCheckDeps;

/** CLI entrypoint: dispatch `check`/`fix`, else print usage and return 2. */
export async function main(): Promise<number> {
  const [subcommand, ...rest] = process.argv.slice(2);
  if (subcommand === "check") {
    return runCheck(rest, process.cwd());
  }
  if (subcommand === "fix") {
    return runFix(rest, process.cwd());
  }
  if (subcommand !== undefined) {
    console.error(`unknown subcommand: ${subcommand}`);
  }
  printUsage();
  return 2;
}

/**
 * Parse the arguments to `conform fix`. Positional args are globs (defaulting to
 * `**\/*.md`); `--config`/`-c` selects conform's config file; canon discovers
 * its own `canon.config.*`; `--no-code` skips the code fixers; `--no-llms` is
 * forwarded to canon. Throws on unknown flags or a missing option value.
 */
export function parseFixArgs(argv: string[]): FixArgs {
  const globs: string[] = [];
  let configPath: string | undefined;
  let isLlms = true;
  let isCode = true;
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
    } else if (arg === "--no-llms") {
      isLlms = false;
    } else if (arg === "--no-code") {
      isCode = false;
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown option: ${arg}`);
    } else {
      globs.push(arg);
    }
  }
  return {
    code: isCode,
    configPath,
    globs: globs.length > 0 ? globs : [...DEFAULT_GLOBS],
    llms: isLlms,
  };
}

/**
 * Run `conform fix`; returns a process exit code. Canon owns doc fixes and
 * residue reporting; conform returns 2 only on argument/config errors.
 */
export async function runFix(
  argv: string[],
  cwd: string,
  deps: RunFixDeps = {},
): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return 0;
  }

  let args: FixArgs;
  try {
    args = parseFixArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(FIX_USAGE);
    return 2;
  }

  let resolved;
  try {
    resolved = await resolveConfig({ configPath: args.configPath, cwd });
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      return 2;
    }
    throw error;
  }

  const runDocs = deps.runDocs ?? runDocsTrack;
  const runCode = deps.runCode ?? runCodeTrack;

  await runDocs({
    cwd,
    globs: args.globs,
    llms: args.llms,
    mode: "fix",
    referenceIgnore: [],
    references: true,
  });

  if (args.code && resolved.code) {
    await runCode({ config: resolved.code, cwd, mode: "fix" });
  }

  return 0;
}

function printUsage(): void {
  console.error(USAGE);
  console.error(FIX_USAGE);
}

// Only run when executed directly (e.g. `bun src/cli/main.ts`), not when
// imported by tests. `import.meta.main` is a Bun/Node entrypoint signal.
if ((import.meta as { main?: boolean }).main) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
