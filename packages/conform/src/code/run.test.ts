import { describe, expect, it } from "vitest";

import type { ResolvedCodeConfig } from "../config/resolve.ts";

import { enabledTools, resolveBin, runCodeTrack, toolArgs } from "./run.ts";

const CONFIG: ResolvedCodeConfig = {
  bedrock: false,
  eslint: true,
  knip: true,
  prettier: true,
  tsconfig: "tsconfig.json",
  typecheck: true,
};

const WITH_BEDROCK: ResolvedCodeConfig = { ...CONFIG, bedrock: ["src"] };

describe("toolArgs", () => {
  it("uses --fix / --write for the fixers in fix mode", () => {
    expect(toolArgs("eslint", CONFIG, "fix")).toEqual(["--fix", "."]);
    expect(toolArgs("prettier", CONFIG, "fix")).toEqual(["--write", "."]);
  });

  it("uses lint / --check for the fixers in check mode", () => {
    expect(toolArgs("eslint", CONFIG, "check")).toEqual(["."]);
    expect(toolArgs("prettier", CONFIG, "check")).toEqual(["--check", "."]);
  });

  it("points the typecheck at the configured tsconfig", () => {
    expect(
      toolArgs("typecheck", { ...CONFIG, tsconfig: "a/b.json" }, "check"),
    ).toEqual(["--noEmit", "--project", "a/b.json"]);
  });

  it("passes no positional args to knip", () => {
    expect(toolArgs("knip", CONFIG, "check")).toEqual([]);
  });

  it("passes bedrock its file patterns then the mode flag", () => {
    expect(toolArgs("bedrock", WITH_BEDROCK, "check")).toEqual([
      "src",
      "--report",
    ]);
    expect(toolArgs("bedrock", WITH_BEDROCK, "fix")).toEqual(["src", "--fix"]);
  });
});

describe("enabledTools", () => {
  it("runs all four gates in check mode", () => {
    expect(enabledTools(CONFIG, "check")).toEqual([
      "eslint",
      "prettier",
      "knip",
      "typecheck",
    ]);
  });

  it("runs only the fixers in fix mode", () => {
    expect(enabledTools(CONFIG, "fix")).toEqual(["eslint", "prettier"]);
  });

  it("runs bedrock first, in both modes, when enabled", () => {
    expect(enabledTools(WITH_BEDROCK, "check")).toEqual([
      "bedrock",
      "eslint",
      "prettier",
      "knip",
      "typecheck",
    ]);
    expect(enabledTools(WITH_BEDROCK, "fix")).toEqual([
      "bedrock",
      "eslint",
      "prettier",
    ]);
  });

  it("honors per-tool disables", () => {
    expect(
      enabledTools({ ...CONFIG, knip: false, prettier: false }, "check"),
    ).toEqual(["eslint", "typecheck"]);
  });
});

describe("resolveBin", () => {
  it("resolves a bundled tool's bin to an absolute path", () => {
    const bin = resolveBin("eslint", "eslint");
    expect(bin).toMatch(/eslint[/\\]bin[/\\]eslint\.js$/);
  });

  it("throws when a package has no such bin entry", () => {
    expect(() => resolveBin("eslint", "does-not-exist")).toThrow(
      /Cannot resolve bin/,
    );
  });
});

describe("runCodeTrack", () => {
  it("runs each enabled tool and reports its exit code", async () => {
    const calls: string[][] = [];
    const logs: string[] = [];
    const results = await runCodeTrack({
      config: CONFIG,
      cwd: "/repo",
      log: (message) => {
        logs.push(message);
      },
      mode: "check",
      run: (_command, args, cwd) => {
        calls.push([...args.slice(1), cwd]);
        // Fail knip, pass the rest.
        return Promise.resolve(args.some((a) => a.includes("knip")) ? 1 : 0);
      },
    });

    expect(results.map((r) => r.tool)).toEqual([
      "eslint",
      "prettier",
      "knip",
      "typecheck",
    ]);
    expect(results.find((r) => r.tool === "knip")?.code).toBe(1);
    expect(results.find((r) => r.tool === "eslint")?.code).toBe(0);
    // Every invocation ran in the supplied cwd.
    expect(calls.every((c) => c.at(-1) === "/repo")).toBe(true);
    expect(logs).toHaveLength(4);
  });

  it("runs only the fixers in fix mode", async () => {
    const tools: string[] = [];
    await runCodeTrack({
      config: CONFIG,
      cwd: "/repo",
      log: () => {},
      mode: "fix",
      run: (_command, args) => {
        if (args.some((a) => a.includes("eslint"))) {
          tools.push("eslint");
        }
        if (args.some((a) => a.includes("prettier"))) {
          tools.push("prettier");
        }
        return Promise.resolve(0);
      },
    });
    expect(tools).toEqual(["eslint", "prettier"]);
  });
});
