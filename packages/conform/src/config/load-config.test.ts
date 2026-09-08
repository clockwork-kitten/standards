import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ConfigError,
  discoverConfigPath,
  loadConfigFile,
  resolveConfig,
} from "./resolve.ts";

const SCRATCH_ROOT = join(process.cwd(), ".test-runs", "load-config");
let sequence = 0;
let dir: string;

beforeEach(() => {
  sequence += 1;
  dir = join(SCRATCH_ROOT, String(sequence));
  rmSync(dir, { force: true, recursive: true });
  mkdirSync(dir, { recursive: true });
});

afterEach(() => {
  rmSync(SCRATCH_ROOT, { force: true, recursive: true });
});

describe("discoverConfigPath", () => {
  it("returns undefined when no config file exists", () => {
    expect(discoverConfigPath(dir)).toBeUndefined();
  });

  it("prefers conform.config.ts over conform.config.jsonc", () => {
    writeFileSync(join(dir, "conform.config.jsonc"), "{}");
    writeFileSync(join(dir, "conform.config.ts"), "export default {}");
    expect(discoverConfigPath(dir)).toBe(join(dir, "conform.config.ts"));
  });
});

describe("loadConfigFile", () => {
  it("parses JSONC with comments and trailing commas", async () => {
    const path = join(dir, "conform.config.jsonc");
    writeFileSync(
      path,
      '{\n  // a comment\n  "code": { "tsconfig": "packages/x/tsconfig.json" },\n}',
    );
    expect(await loadConfigFile(path)).toEqual({
      code: { tsconfig: "packages/x/tsconfig.json" },
    });
  });

  it("imports a TypeScript config's default export", async () => {
    const path = join(dir, "conform.config.ts");
    writeFileSync(
      path,
      'export default { code: { tsconfig: "packages/x/tsconfig.json" } };',
    );
    expect(await loadConfigFile(path)).toEqual({
      code: { tsconfig: "packages/x/tsconfig.json" },
    });
  });

  it("throws ConfigError on malformed JSONC", async () => {
    const path = join(dir, "conform.config.jsonc");
    writeFileSync(path, "{ not valid");
    await expect(loadConfigFile(path)).rejects.toBeInstanceOf(ConfigError);
  });

  it("throws ConfigError when the config is not an object", async () => {
    const path = join(dir, "conform.config.json");
    writeFileSync(path, "[1, 2, 3]");
    await expect(loadConfigFile(path)).rejects.toBeInstanceOf(ConfigError);
  });
});

describe("resolveConfig", () => {
  it("returns no code track when no config file exists", async () => {
    const resolved = await resolveConfig({ cwd: dir });
    expect(resolved).toEqual({
      code: undefined,
      source: "no config file found",
    });
  });

  it("resolves a discovered code config", async () => {
    writeFileSync(
      join(dir, "conform.config.jsonc"),
      '{ "code": { "tsconfig": "packages/conform/tsconfig.json" } }',
    );
    const resolved = await resolveConfig({ cwd: dir });
    expect(resolved.code?.tsconfig).toBe("packages/conform/tsconfig.json");
    expect(resolved.source).toBe(join(dir, "conform.config.jsonc"));
  });

  it("honors an explicit relative configPath", async () => {
    writeFileSync(join(dir, "custom.jsonc"), '{ "code": { "knip": false } }');
    const resolved = await resolveConfig({
      configPath: "custom.jsonc",
      cwd: dir,
    });
    expect(resolved.code?.knip).toBe(false);
  });
});
