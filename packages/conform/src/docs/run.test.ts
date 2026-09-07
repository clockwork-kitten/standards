import { describe, expect, it } from "vitest";

import { runDocsTrack } from "./run.ts";

describe("runDocsTrack", () => {
  it("composes canon check args and propagates the exit code", async () => {
    const calls: Array<{ args: string[]; command: string; cwd: string }> = [];
    const logs: string[] = [];
    const code = await runDocsTrack({
      cwd: "/repo",
      globs: ["README.md", "docs/**/*.md"],
      llms: true,
      log: (message) => {
        logs.push(message);
      },
      mode: "check",
      referenceIgnore: ["ops/", "external/"],
      references: false,
      run: (command, args, cwd) => {
        calls.push({ args, command, cwd });
        return Promise.resolve(7);
      },
    });

    expect(code).toBe(7);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe(process.execPath);
    expect(calls[0]?.cwd).toBe("/repo");
    expect(calls[0]?.args.slice(1)).toEqual([
      "check",
      "README.md",
      "docs/**/*.md",
      "--no-references",
      "--reference-ignore",
      "ops/",
      "--reference-ignore",
      "external/",
    ]);
    expect(calls[0]?.args[0]).toMatch(/@clockwork-kitten[/\\]canon/);
    expect(logs).toEqual(["conform check · docs · canon"]);
  });

  it("composes canon fix args with --no-llms", async () => {
    const calls: string[][] = [];
    const code = await runDocsTrack({
      cwd: "/repo",
      globs: ["docs/**/*.md"],
      llms: false,
      log: () => {},
      mode: "fix",
      referenceIgnore: [],
      references: true,
      run: (_command, args) => {
        calls.push(args);
        return Promise.resolve(0);
      },
    });

    expect(code).toBe(0);
    expect(calls[0]?.slice(1)).toEqual(["fix", "docs/**/*.md", "--no-llms"]);
  });
});
