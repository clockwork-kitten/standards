import { describe, expect, it } from "vitest";

import { resolveCodeConfig } from "./resolve.ts";
import { defineConfig } from "./types.ts";

describe("defineConfig", () => {
  it("returns its argument unchanged", () => {
    const config = { code: { tsconfig: "packages/x/tsconfig.json" } };
    expect(defineConfig(config)).toBe(config);
  });
});

describe("resolveCodeConfig", () => {
  it("returns undefined when no code block is declared", () => {
    expect(resolveCodeConfig({})).toBeUndefined();
  });

  it("enables every tool and defaults the tsconfig for a bare block", () => {
    expect(resolveCodeConfig({ code: {} })).toEqual({
      bedrock: false,
      eslint: true,
      knip: true,
      prettier: true,
      tsconfig: "tsconfig.json",
      typecheck: true,
    });
  });

  it("honors per-tool disables and a custom tsconfig", () => {
    expect(
      resolveCodeConfig({
        code: { knip: false, tsconfig: "packages/x/tsconfig.json" },
      }),
    ).toEqual({
      bedrock: false,
      eslint: true,
      knip: false,
      prettier: true,
      tsconfig: "packages/x/tsconfig.json",
      typecheck: true,
    });
  });

  it("defaults bedrock to `src` when enabled with `true`", () => {
    expect(resolveCodeConfig({ code: { bedrock: true } })?.bedrock).toEqual([
      "src",
    ]);
  });

  it("uses explicit bedrock patterns as-is, and treats an empty array as off", () => {
    expect(
      resolveCodeConfig({ code: { bedrock: ["src", "scripts"] } })?.bedrock,
    ).toEqual(["src", "scripts"]);
    expect(resolveCodeConfig({ code: { bedrock: [] } })?.bedrock).toBe(false);
  });
});
