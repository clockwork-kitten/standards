import process from "node:process";

import { resolveBin, runProcess, type RunProcess } from "../code/run.ts";

/** Doc-conformance mode delegated to canon. */
export type DocsMode = "check" | "fix";

/** Options for {@link runDocsTrack}. */
export type RunDocsOptions = {
  cwd: string;
  /** Positional globs passed through to canon without pre-expansion. */
  globs: string[];
  /** Whether canon fix should regenerate llms.txt; false adds `--no-llms`. */
  llms: boolean;
  /** Per-line logger; defaults to `console.error`. */
  log?: (message: string) => void;
  mode: DocsMode;
  /** Extra reference-ignore substrings forwarded to canon check. */
  referenceIgnore: string[];
  /** Whether canon check should validate references; false adds `--no-references`. */
  references: boolean;
  /** Subprocess runner; defaults to {@link runProcess}. Injected for tests. */
  run?: RunProcess;
};

/**
 * Run the documentation-conformance track by shelling out to canon. Canon owns
 * markdown linting, references, and llms.txt, with its own config discovery.
 */
export async function runDocsTrack(options: RunDocsOptions): Promise<number> {
  const { cwd, globs, llms, mode, referenceIgnore, references } = options;
  const log = options.log ?? ((message: string) => console.error(message));
  const run = options.run ?? runProcess;
  const canonBin = resolveBin("@clockwork-kitten/canon", "canon");
  const args = docsArgs({ globs, llms, mode, referenceIgnore, references });

  log(`conform ${mode} · docs · canon`);
  return run(process.execPath, [canonBin, ...args], cwd);
}

function docsArgs(
  options: Pick<
    RunDocsOptions,
    "globs" | "llms" | "mode" | "referenceIgnore" | "references"
  >,
): string[] {
  if (options.mode === "fix") {
    return ["fix", ...options.globs, ...(options.llms ? [] : ["--no-llms"])];
  }

  return [
    "check",
    ...options.globs,
    ...(options.references ? [] : ["--no-references"]),
    ...options.referenceIgnore.flatMap((substring) => [
      "--reference-ignore",
      substring,
    ]),
  ];
}
