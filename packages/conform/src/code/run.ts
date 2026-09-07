import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import process from "node:process";

import type { ResolvedCodeConfig } from "../config/resolve.ts";

const require = createRequire(import.meta.url);

/** The tools the code track can run. */
export type CodeTool = "eslint" | "knip" | "prettier" | "typecheck";

/** Outcome of a single tool invocation. */
export type CodeToolResult = {
  /** Process exit code; `0` is a pass. */
  code: number;
  tool: CodeTool;
};

/**
 * Spawn a subprocess and resolve with its exit code. Injected so tests can
 * assert the composed command without running the real toolchain.
 */
export type RunProcess = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<number>;

/** Default {@link RunProcess}: run under the current runtime, inheriting stdio. */
export const runProcess: RunProcess = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

/** Package + bin-entry name each tool is invoked through. */
const TOOL_BIN: Record<CodeTool, readonly [pkg: string, bin: string]> = {
  eslint: ["eslint", "eslint"],
  // knip ships a bun-native entry; prefer it since the engine runs under Bun.
  knip: ["knip", "knip-bun"],
  prettier: ["prettier", "prettier"],
  typecheck: ["typescript", "tsc"],
};

/** Options for {@link runCodeTrack}. */
export type RunCodeOptions = {
  config: ResolvedCodeConfig;
  cwd: string;
  /** Per-line logger; defaults to `console.error`. */
  log?: (message: string) => void;
  mode: "check" | "fix";
  /** Subprocess runner; defaults to {@link runProcess}. Injected for tests. */
  run?: RunProcess;
};

/** The tools that run, in order, for a given mode and config. */
export function enabledTools(
  config: ResolvedCodeConfig,
  mode: "check" | "fix",
): CodeTool[] {
  const tools: CodeTool[] = [];
  if (config.eslint) {
    tools.push("eslint");
  }
  if (config.prettier) {
    tools.push("prettier");
  }
  // knip and typecheck are check-only gates; fix runs the fixers alone.
  if (mode === "check" && config.knip) {
    tools.push("knip");
  }
  if (mode === "check" && config.typecheck) {
    tools.push("typecheck");
  }
  return tools;
}

/**
 * Resolve the absolute path to a package's bin script from conform's own
 * dependencies, so the pinned toolchain is used regardless of the consumer's
 * install layout.
 */
export function resolveBin(pkg: string, binName: string): string {
  const dir = packageDir(pkg);
  const manifest = JSON.parse(
    readFileSync(join(dir, "package.json"), "utf8"),
  ) as {
    bin?: Record<string, string> | string;
  };
  const bin = manifest.bin;
  const entry = typeof bin === "string" ? bin : bin?.[binName];
  if (!entry) {
    throw new Error(`Cannot resolve bin "${binName}" for package "${pkg}"`);
  }
  return join(dir, entry);
}

/**
 * Run the code-conformance track by shelling out to each enabled tool. Every
 * tool discovers its own config (`eslint.config.js`, the `prettier` field,
 * `knip.*`, the tsconfig), so this composes the pinned toolchain without
 * re-implementing it. Returns one result per tool; the caller aggregates the
 * exit code.
 */
export async function runCodeTrack(
  options: RunCodeOptions,
): Promise<CodeToolResult[]> {
  const { config, cwd, mode } = options;
  const run = options.run ?? runProcess;
  const log = options.log ?? ((message: string) => console.error(message));

  const results: CodeToolResult[] = [];
  for (const tool of enabledTools(config, mode)) {
    const [pkg, binName] = TOOL_BIN[tool];
    const bin = resolveBin(pkg, binName);
    const args = toolArgs(tool, config, mode);
    log(`conform ${mode} · code · ${tool}`);
    const code = await run(process.execPath, [bin, ...args], cwd);
    results.push({ code, tool });
  }
  return results;
}

/**
 * Build the argv (after the runtime and bin path) for a tool. `eslint` and
 * `prettier` differ between check and fix; `knip` and `typecheck` are gates with
 * no safe autofix, so they only ever run in check mode.
 */
export function toolArgs(
  tool: CodeTool,
  config: ResolvedCodeConfig,
  mode: "check" | "fix",
): string[] {
  switch (tool) {
    case "eslint": {
      return mode === "fix" ? ["--fix", "."] : ["."];
    }
    case "knip": {
      return [];
    }
    case "prettier": {
      return mode === "fix" ? ["--write", "."] : ["--check", "."];
    }
    case "typecheck": {
      return ["--noEmit", "--project", config.tsconfig];
    }
  }
}

/**
 * Locate a package's install directory by walking conform's own `node_modules`
 * resolution chain. This reads the directory directly rather than
 * `require.resolve("<pkg>/package.json")`, because some packages (e.g. knip)
 * restrict `./package.json` in their `exports` map.
 */
function packageDir(pkg: string): string {
  const paths = require.resolve.paths(pkg) ?? [];
  for (const base of paths) {
    const candidate = join(base, pkg);
    if (existsSync(join(candidate, "package.json"))) {
      return candidate;
    }
  }
  throw new Error(`Cannot locate package "${pkg}"`);
}
