import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseCheckArgs, parseFixArgs } from "../cli/main.ts";
import { toolArgs } from "../code/run.ts";
import { CONFIG_FILENAMES, resolveCodeConfig } from "../config/resolve.ts";

const PACKAGE_ROOT = join(process.cwd());
const INVENTORY_DIR = join(PACKAGE_ROOT, "inventory");

type Inventory = {
  commands: Array<{ command: string }>;
  configArtifacts: Array<{ id: string }>;
  configSurfaces: Array<{ kind: string; name: string; value?: unknown }>;
  consumers: Array<{ id: string }>;
  defaults: Array<{ name: string; value: unknown }>;
  exports: Array<{ name: string; public: boolean; surface: string }>;
  flags: Array<{ command: string; flag: string }>;
  openOrStaleAdoptionPrs: { migration: { kind: string } };
  toolAdapters: Array<{
    args: { check: string[]; fix?: string[] };
    tool: string;
  }>;
  workflows: Array<{ id: string; inputs?: string[] }>;
};

type MigratableItem = {
  diagnosticOnly: boolean;
  migration: { kind: string };
};

function inventory(): Inventory {
  return readJsonFile(join(INVENTORY_DIR, "legacy-conform.json")) as Inventory;
}

function inventoryFlagSet(command: string): Set<string> {
  return new Set(
    inventory()
      .flags.filter((entry) => entry.command === command)
      .map((entry) => entry.flag),
  );
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function rootNamedExports(indexSource: string): string[] {
  const matches = indexSource.matchAll(/export \{([^}]*)\} from/g).toArray();
  const names = matches.flatMap((match) =>
    (match[1] ?? "")
      .split(",")
      .map((part) => part.replaceAll(/\btype\b/g, "").trim())
      .filter((part) => part.length > 0),
  );
  return [...new Set(names)].toSorted();
}

function sourceFlagSet(
  source: string,
  startMarker: string,
  endMarker: string,
): Set<string> {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      `could not locate marker range: ${startMarker}..${endMarker}`,
    );
  }
  const segment = source.slice(start, end);
  const literals = segment
    .matchAll(/"(--[a-z-]+=?|-[a-z])"/g)
    .map((match) => match[1])
    .filter((flag): flag is string => flag !== undefined)
    .toArray();
  return new Set(literals);
}

function workflowInputNames(workflowSource: string): string[] {
  const lines = workflowSource.split("\n");
  const start = lines.findIndex((line) => line.trim() === "inputs:");
  const end = lines.findIndex(
    (line, index) => index > start && line.trim() === "permissions:",
  );
  if (start === -1 || end === -1) {
    throw new Error("could not find workflow inputs block");
  }
  const inputLines = lines.slice(start + 1, end);
  return inputLines
    .filter((line) => /^ {6}[a-z0-9-]+:$/.test(line))
    .map((line) => line.trim().slice(0, -1))
    .toSorted();
}

describe("legacy conform inventory", () => {
  it("ships schema, inventory, and completeness manifests", () => {
    const files = readdirSync(INVENTORY_DIR).toSorted();
    expect(files).toEqual([
      "completeness.json",
      "legacy-conform.json",
      "legacy-conform.schema.json",
    ]);
  });

  it("maps every inventoried surface to destination/difference/drop", () => {
    const data = inventory() as Inventory & {
      commands: MigratableItem[];
      configArtifacts: MigratableItem[];
      configSurfaces: MigratableItem[];
      consumers: MigratableItem[];
      defaults: MigratableItem[];
      exports: MigratableItem[];
      flags: MigratableItem[];
      openOrStaleAdoptionPrs: { migration: { kind: string } };
      toolAdapters: MigratableItem[];
      workflows: MigratableItem[];
    };
    const categories = [
      "commands",
      "flags",
      "exports",
      "defaults",
      "toolAdapters",
      "configSurfaces",
      "configArtifacts",
      "workflows",
      "consumers",
    ] as const;
    for (const category of categories) {
      const items: MigratableItem[] = data[category];
      for (const item of items) {
        expect(item.diagnosticOnly).toBe(true);
        expect(["destination", "intentional-difference", "dropped"]).toContain(
          item.migration.kind,
        );
      }
    }
    expect(["destination", "intentional-difference", "dropped"]).toContain(
      data.openOrStaleAdoptionPrs.migration.kind,
    );
  });

  it("tracks command and flag surfaces from CLI source", () => {
    const cliSource = readFileSync(
      join(PACKAGE_ROOT, "src/cli/main.ts"),
      "utf8",
    );
    const checkFlags = new Set([
      ...sourceFlagSet(
        cliSource,
        "export function parseCheckArgs",
        "export async function runCheck",
      ),
      ...sourceFlagSet(
        cliSource,
        "export async function runCheck",
        "const FIX_USAGE",
      ),
    ]);
    const fixFlags = new Set([
      ...sourceFlagSet(
        cliSource,
        "export function parseFixArgs",
        "export async function runFix",
      ),
      ...sourceFlagSet(
        cliSource,
        "export async function runFix",
        "function printUsage",
      ),
    ]);

    expect(new Set(inventory().commands.map((entry) => entry.command))).toEqual(
      new Set(["check", "fix"]),
    );
    expect(inventoryFlagSet("check")).toEqual(checkFlags);
    expect(inventoryFlagSet("fix")).toEqual(fixFlags);
  });

  it("tracks CLI and config defaults from runtime behavior", () => {
    const defaults = new Map(
      inventory().defaults.map((entry) => [entry.name, entry.value]),
    );
    expect(defaults.get("cli.check.globs")).toEqual(parseCheckArgs([]).globs);
    expect(defaults.get("cli.fix.globs")).toEqual(parseFixArgs([]).globs);
    expect(defaults.get("cli.check.references")).toBe(
      parseCheckArgs([]).references,
    );
    expect(defaults.get("cli.check.code")).toBe(parseCheckArgs([]).code);
    expect(defaults.get("cli.fix.llms")).toBe(parseFixArgs([]).llms);
    expect(defaults.get("cli.fix.code")).toBe(parseFixArgs([]).code);
    expect(defaults.get("config.default.tsconfig")).toBe(
      resolveCodeConfig({ code: {} })?.tsconfig,
    );
    expect(defaults.get("config.default.bedrockWhenTrue")).toEqual(
      resolveCodeConfig({ code: { bedrock: true } })?.bedrock,
    );
  });

  it("tracks config filename precedence", () => {
    const filenames = inventory()
      .configSurfaces.filter((entry) => entry.kind === "discovery-filename")
      .map((entry) => entry.name);
    expect(filenames).toEqual([...CONFIG_FILENAMES]);
  });

  it("tracks package export map and root named exports", () => {
    const packageJson = readJsonFile(join(PACKAGE_ROOT, "package.json")) as {
      exports: Record<string, string>;
    };
    const packageExportNames = Object.keys(packageJson.exports).toSorted();
    const indexSource = readFileSync(
      join(PACKAGE_ROOT, "src/index.ts"),
      "utf8",
    );
    const namedExportNames = rootNamedExports(indexSource);

    const inventoryPackageExports = inventory()
      .exports.filter((entry) => entry.surface === "package-subpath")
      .map((entry) => entry.name)
      .toSorted();
    const inventoryNamedExports = inventory()
      .exports.filter(
        (entry) => entry.surface === "root-named-export" && entry.public,
      )
      .map((entry) => entry.name)
      .toSorted();

    expect(inventoryPackageExports).toEqual(packageExportNames);
    expect(inventoryNamedExports).toEqual(namedExportNames);
  });

  it("tracks tool adapters from runner argv behavior", () => {
    const adapterByTool = new Map(
      inventory().toolAdapters.map((entry) => [entry.tool, entry.args]),
    );

    expect(adapterByTool.get("bedrock")?.check).toEqual(
      toolArgs(
        "bedrock",
        {
          bedrock: ["src"],
          eslint: true,
          knip: true,
          prettier: true,
          tsconfig: "tsconfig.json",
          typecheck: true,
        },
        "check",
      ),
    );
    expect(adapterByTool.get("eslint")?.fix).toEqual(
      toolArgs(
        "eslint",
        {
          bedrock: false,
          eslint: true,
          knip: true,
          prettier: true,
          tsconfig: "tsconfig.json",
          typecheck: true,
        },
        "fix",
      ),
    );
    expect(adapterByTool.get("typecheck")?.check).toEqual(
      toolArgs(
        "typecheck",
        {
          bedrock: false,
          eslint: true,
          knip: true,
          prettier: true,
          tsconfig: "tsconfig.json",
          typecheck: true,
        },
        "check",
      ),
    );
  });

  it("tracks markdown-conformance workflow inputs", () => {
    const workflowSource = readFileSync(
      join(PACKAGE_ROOT, "../../.github/workflows/markdown-conformance.yml"),
      "utf8",
    );
    const inventoryWorkflow = inventory().workflows.find(
      (entry) => entry.id === "workflow.markdown-conformance",
    );
    expect(inventoryWorkflow?.inputs?.toSorted()).toEqual(
      workflowInputNames(workflowSource),
    );
  });

  it("tracks current fixture files", () => {
    const fixtureFiles = readdirSync(
      join(PACKAGE_ROOT, "src/code/__fixtures__/astro"),
    ).toSorted();
    const completeness = readJsonFile(
      join(INVENTORY_DIR, "completeness.json"),
    ) as { fixtures: Array<{ path: string }> };
    expect(completeness.fixtures.map((entry) => entry.path).toSorted()).toEqual(
      fixtureFiles.map(
        (name) => `packages/conform/src/code/__fixtures__/astro/${name}`,
      ),
    );
  });
});
