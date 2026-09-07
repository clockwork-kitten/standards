import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CodeToolResult } from "../code/run.ts";
import type { RunDocsOptions } from "../docs/run.ts";

import {
  main,
  parseCheckArgs,
  parseFixArgs,
  runCheck,
  runFix,
} from "./main.ts";

const SCRATCH_ROOT = join(process.cwd(), ".test-runs", "cli-main");
let sequence = 0;

function makeScratchDir(): string {
  sequence += 1;
  const dir = join(SCRATCH_ROOT, String(sequence));
  rmSync(dir, { force: true, recursive: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("parseCheckArgs", () => {
  it("defaults to **/*.md with no config", () => {
    expect(parseCheckArgs([])).toEqual({
      code: true,
      configPath: undefined,
      globs: ["**/*.md"],
      referenceIgnore: [],
      references: true,
    });
  });

  it("collects positional globs", () => {
    expect(parseCheckArgs(["docs/**/*.md", "README.md"])).toEqual({
      code: true,
      configPath: undefined,
      globs: ["docs/**/*.md", "README.md"],
      referenceIgnore: [],
      references: true,
    });
  });

  it("parses --config, -c, and --config=", () => {
    expect(parseCheckArgs(["--config", "a.ts"]).configPath).toBe("a.ts");
    expect(parseCheckArgs(["-c", "b.ts"]).configPath).toBe("b.ts");
    expect(parseCheckArgs(["--config=c.ts"]).configPath).toBe("c.ts");
  });

  it("parses --no-code, --no-references, and repeatable --reference-ignore", () => {
    expect(
      parseCheckArgs([
        "--no-code",
        "--no-references",
        "--reference-ignore",
        "ops/",
        "--reference-ignore=docs/x.md",
      ]),
    ).toMatchObject({
      code: false,
      referenceIgnore: ["ops/", "docs/x.md"],
      references: false,
    });
  });

  it("throws on a missing option value or unknown flag", () => {
    expect(() => parseCheckArgs(["--config"])).toThrow(/requires a path/);
    expect(() => parseCheckArgs(["--nope"])).toThrow(/unknown option/);
    expect(() => parseCheckArgs(["--reference-ignore"])).toThrow(
      /requires a substring/,
    );
  });
});

describe("runCheck", () => {
  let dir: string;
  let docsCalls: RunDocsOptions[];
  let codeResults: CodeToolResult[];
  let codeCalls: Array<{
    cwd: string;
    mode: "check" | "fix";
    tsconfig: string;
  }>;

  beforeEach(() => {
    dir = makeScratchDir();
    docsCalls = [];
    codeResults = [];
    codeCalls = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(SCRATCH_ROOT, { force: true, recursive: true });
  });

  it("runs docs and code tracks and returns 0 when both pass", async () => {
    writeFileSync(
      join(dir, "conform.config.jsonc"),
      '{ "code": { "tsconfig": "packages/conform/tsconfig.json" } }',
    );

    const exitCode = await runCheck(["README.md"], dir, {
      runCode: ({ config, cwd, mode }) => {
        codeCalls.push({ cwd, mode, tsconfig: config.tsconfig });
        return Promise.resolve(codeResults);
      },
      runDocs: (options) => {
        docsCalls.push(options);
        return Promise.resolve(0);
      },
    });

    expect(exitCode).toBe(0);
    expect(docsCalls).toHaveLength(1);
    expect(docsCalls[0]).toMatchObject({
      cwd: dir,
      globs: ["README.md"],
      llms: true,
      mode: "check",
      referenceIgnore: [],
      references: true,
    });
    expect(codeCalls).toEqual([
      { cwd: dir, mode: "check", tsconfig: "packages/conform/tsconfig.json" },
    ]);
  });

  it("returns 1 when canon check fails", async () => {
    expect(
      await runCheck([], dir, {
        runCode: () => Promise.resolve([]),
        runDocs: () => Promise.resolve(1),
      }),
    ).toBe(1);
  });

  it("returns 1 when any code tool fails", async () => {
    writeFileSync(join(dir, "conform.config.jsonc"), '{ "code": {} }');
    expect(
      await runCheck([], dir, {
        runCode: () => Promise.resolve([{ code: 1, tool: "knip" }]),
        runDocs: () => Promise.resolve(0),
      }),
    ).toBe(1);
  });

  it("passes reference flags through to canon", async () => {
    await runCheck(
      [
        "docs/**/*.md",
        "--no-references",
        "--reference-ignore",
        "ops/",
        "--reference-ignore=vendor/",
      ],
      dir,
      {
        runDocs: (options) => {
          docsCalls.push(options);
          return Promise.resolve(0);
        },
      },
    );

    expect(docsCalls[0]).toMatchObject({
      globs: ["docs/**/*.md"],
      referenceIgnore: ["ops/", "vendor/"],
      references: false,
    });
  });

  it("skips code when --no-code is set", async () => {
    writeFileSync(join(dir, "conform.config.jsonc"), '{ "code": {} }');
    await runCheck(["--no-code"], dir, {
      runCode: ({ config, cwd, mode }) => {
        codeCalls.push({ cwd, mode, tsconfig: config.tsconfig });
        return Promise.resolve([]);
      },
      runDocs: () => Promise.resolve(0),
    });
    expect(codeCalls).toEqual([]);
  });

  it("returns 2 on malformed config files and bad arguments", async () => {
    writeFileSync(join(dir, "conform.config.jsonc"), "{ broken");
    expect(await runCheck([], dir, { runDocs: () => Promise.resolve(0) })).toBe(
      2,
    );
    expect(await runCheck(["--config"], dir)).toBe(2);
  });
});

describe("parseFixArgs", () => {
  it("defaults to **/*.md, no config, llms on", () => {
    expect(parseFixArgs([])).toEqual({
      code: true,
      configPath: undefined,
      globs: ["**/*.md"],
      llms: true,
    });
  });

  it("parses globs, --config, --no-code, and --no-llms", () => {
    expect(
      parseFixArgs([
        "docs/**/*.md",
        "--config",
        "c.ts",
        "--no-code",
        "--no-llms",
      ]),
    ).toEqual({
      code: false,
      configPath: "c.ts",
      globs: ["docs/**/*.md"],
      llms: false,
    });
  });

  it("throws on a missing --config value or unknown flag", () => {
    expect(() => parseFixArgs(["--config"])).toThrow(/requires a path/);
    expect(() => parseFixArgs(["--nope"])).toThrow(/unknown option/);
  });
});

describe("runFix", () => {
  let dir: string;
  let docsCalls: RunDocsOptions[];
  let codeCalls: Array<{
    cwd: string;
    mode: "check" | "fix";
    tsconfig: string;
  }>;

  beforeEach(() => {
    dir = makeScratchDir();
    docsCalls = [];
    codeCalls = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(SCRATCH_ROOT, { force: true, recursive: true });
  });

  it("runs canon fix, then code fixers when a code config exists", async () => {
    writeFileSync(
      join(dir, "conform.config.jsonc"),
      '{ "code": { "tsconfig": "packages/conform/tsconfig.json" } }',
    );

    expect(
      await runFix(["docs/**/*.md", "--no-llms"], dir, {
        runCode: ({ config, cwd, mode }) => {
          codeCalls.push({ cwd, mode, tsconfig: config.tsconfig });
          return Promise.resolve([{ code: 1, tool: "eslint" }]);
        },
        runDocs: (options) => {
          docsCalls.push(options);
          return Promise.resolve(1);
        },
      }),
    ).toBe(0);

    expect(docsCalls[0]).toMatchObject({
      cwd: dir,
      globs: ["docs/**/*.md"],
      llms: false,
      mode: "fix",
      referenceIgnore: [],
      references: true,
    });
    expect(codeCalls).toEqual([
      { cwd: dir, mode: "fix", tsconfig: "packages/conform/tsconfig.json" },
    ]);
  });

  it("skips code fixers with --no-code", async () => {
    writeFileSync(join(dir, "conform.config.jsonc"), '{ "code": {} }');
    expect(
      await runFix(["--no-code"], dir, {
        runCode: ({ config, cwd, mode }) => {
          codeCalls.push({ cwd, mode, tsconfig: config.tsconfig });
          return Promise.resolve([]);
        },
        runDocs: (options) => {
          docsCalls.push(options);
          return Promise.resolve(0);
        },
      }),
    ).toBe(0);
    expect(codeCalls).toEqual([]);
    expect(docsCalls).toHaveLength(1);
  });

  it("returns 2 on malformed config files and bad arguments", async () => {
    writeFileSync(join(dir, "conform.config.jsonc"), "{ broken");
    expect(await runFix([], dir, { runDocs: () => Promise.resolve(0) })).toBe(
      2,
    );
    expect(await runFix(["--config"], dir)).toBe(2);
  });
});

describe("--help", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints usage and returns 0 for runCheck", async () => {
    expect(await runCheck(["--help"], process.cwd())).toBe(0);
    expect(await runCheck(["-h"], process.cwd())).toBe(0);
    expect(console.error).toHaveBeenCalled();
  });

  it("prints usage and returns 0 for runFix", async () => {
    expect(await runFix(["--help"], process.cwd())).toBe(0);
    expect(await runFix(["-h"], process.cwd())).toBe(0);
  });
});

describe("main", () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it("returns 2 and reports an unknown subcommand", async () => {
    process.argv = ["bun", "main.ts", "bogus"];
    expect(await main()).toBe(2);
    expect(console.error).toHaveBeenCalledWith("unknown subcommand: bogus");
  });

  it("returns 2 and prints usage when no subcommand is given", async () => {
    process.argv = ["bun", "main.ts"];
    expect(await main()).toBe(2);
    expect(console.error).toHaveBeenCalled();
  });
});
