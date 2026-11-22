import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { parseCheckArgs, parseFixArgs } from "../cli/main.ts";
import { resolveBin, runCodeTrack, toolArgs } from "../code/run.ts";
import {
  CONFIG_FILENAMES,
  resolveCodeConfig,
  resolveConfig,
} from "../config/resolve.ts";
import { runDocsTrack } from "../docs/run.ts";

const PACKAGE_ROOT = join(process.cwd());
const INVENTORY_DIR = join(PACKAGE_ROOT, "inventory");
const CONFIG_DIR = join(PACKAGE_ROOT, "configs");
const requireFromPackage = createRequire(join(PACKAGE_ROOT, "package.json"));

type ArtifactRecord = InventoryItem & {
  contentSummary: unknown;
  dependencyVersions: Record<string, string>;
  effectiveHash: string;
  id: string;
  itemDispositions: Array<{ key: string; migration: { kind: MigrationKind } }>;
  path: string;
};
type Completeness = {
  consumerAndSearchEvidence?: {
    consumerCutoverIssues?: Array<{ repository: string; url: string }>;
  };
  counts: Record<string, number>;
  exportEvidence: {
    packageExports: string[];
    rootNamedExportCount: number;
  };
  fixtures: Array<{ path: string }>;
};

type Inventory = {
  commands: Array<InventoryItem & { command: string }>;
  configArtifacts: ArtifactRecord[];
  configSurfaces: Array<InventoryItem & { kind: string; name: string }>;
  consumers: InventoryItem[];
  defaults: Array<InventoryItem & { name: string; value: unknown }>;
  exports: Array<
    InventoryItem & { name: string; public: boolean; surface: string }
  >;
  flags: Array<InventoryItem & { command: string; flag: string }>;
  openOrStaleAdoptionPrs: { migration: { kind: MigrationKind } };
  toolAdapters: Array<
    InventoryItem & {
      args: {
        check?: string[];
        checkTemplate?: string[];
        fix?: string[];
        fixTemplate?: string[];
      };
      bin: { name: string; package: string };
      tool: string;
    }
  >;
  workflows: Array<InventoryItem & { id: string; inputs?: string[] }>;
};

type InventoryItem = {
  diagnosticOnly: boolean;
  id: string;
  migration: { kind: MigrationKind };
};

type MigrationKind = "destination" | "dropped" | "intentional-difference";

function completeness(): Completeness {
  return readJsonFile(join(INVENTORY_DIR, "completeness.json")) as Completeness;
}

function hasPackage(name: string): boolean {
  const paths = requireFromPackage.resolve.paths(name) ?? [];
  for (const base of paths) {
    const candidate = join(base, ...name.split("/"), "package.json");
    if (existsSync(candidate)) {
      return true;
    }
  }
  return false;
}

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

function jsonNull(): null {
  return JSON.parse("null") as null;
}

function normalizedHash(value: unknown): string {
  const normalized = stableNormalize(value);
  const payload = JSON.stringify(normalized);
  return createHash("sha256").update(payload).digest("hex");
}

function packageVersion(name: string): string {
  const paths = requireFromPackage.resolve.paths(name) ?? [];
  let packageJsonPath: string | undefined;
  for (const base of paths) {
    const candidate = join(base, ...name.split("/"), "package.json");
    if (existsSync(candidate)) {
      packageJsonPath = candidate;
      break;
    }
  }
  if (!packageJsonPath) {
    throw new Error(`could not resolve package.json for ${name}`);
  }
  const packageJson = readJsonFile(packageJsonPath) as { version: string };
  return packageJson.version;
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

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableNormalize(entry));
  }
  if (value && typeof value === "object") {
    const sortedEntries = Object.entries(value).toSorted(([a], [b]) =>
      a.localeCompare(b),
    );
    return Object.fromEntries(
      sortedEntries.map(([key, entryValue]) => [
        key,
        stableNormalize(entryValue),
      ]),
    );
  }
  return value;
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

  it("validates the inventory with draft-2020-12 schema", () => {
    const schema = readJsonFile(
      join(INVENTORY_DIR, "legacy-conform.schema.json"),
    ) as object;
    const data = inventory() as object;

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const isValid = ajv.validate(schema, data);
    expect(isValid, JSON.stringify(ajv.errors, undefined, 2)).toBe(true);
  });

  it("enforces unique IDs globally across every inventory category", () => {
    const data = inventory();
    const categories = [
      data.commands,
      data.flags,
      data.exports,
      data.defaults,
      data.toolAdapters,
      data.configSurfaces,
      data.configArtifacts,
      data.workflows,
      data.consumers,
    ];
    const allIds = categories.flatMap((entries) =>
      entries.map((entry) => entry.id),
    );
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("maps every inventoried surface to destination/difference/drop", () => {
    const data = inventory() as Inventory & {
      commands: InventoryItem[];
      configArtifacts: InventoryItem[];
      configSurfaces: InventoryItem[];
      consumers: InventoryItem[];
      defaults: InventoryItem[];
      exports: InventoryItem[];
      flags: InventoryItem[];
      toolAdapters: InventoryItem[];
      workflows: InventoryItem[];
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
      const items: InventoryItem[] = data[category];
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

  it("keeps completeness counts source-derived and truthful", () => {
    const data = inventory();
    const evidence = completeness();
    expect(evidence.counts.commands).toBe(data.commands.length);
    expect(evidence.counts.flags).toBe(data.flags.length);
    expect(evidence.counts.exports).toBe(data.exports.length);
    expect(evidence.counts.defaults).toBe(data.defaults.length);
    expect(evidence.counts.toolAdapters).toBe(data.toolAdapters.length);
    expect(evidence.counts.configSurfaces).toBe(data.configSurfaces.length);
    expect(evidence.counts.configArtifacts).toBe(data.configArtifacts.length);
    expect(evidence.counts.workflows).toBe(data.workflows.length);
    expect(evidence.counts.consumers).toBe(data.consumers.length);
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

  it("tracks defaults from runtime behavior, including omitted defaults", async () => {
    const defaults = new Map(
      inventory().defaults.map((entry) => [entry.name, entry.value]),
    );
    const docsOnlyDir = mkdtempSync(join(tmpdir(), "conform-inventory-"));
    const docsOnlyResolved = await resolveConfig({ cwd: docsOnlyDir });
    rmSync(docsOnlyDir, { force: true, recursive: true });

    expect(defaults.get("cli.check.globs")).toEqual(parseCheckArgs([]).globs);
    expect(defaults.get("cli.fix.globs")).toEqual(parseFixArgs([]).globs);
    expect(defaults.get("cli.check.references")).toBe(
      parseCheckArgs([]).references,
    );
    expect(defaults.get("cli.check.code")).toBe(parseCheckArgs([]).code);
    expect(defaults.get("cli.check.referenceIgnore")).toEqual([]);
    expect(defaults.get("cli.fix.llms")).toBe(parseFixArgs([]).llms);
    expect(defaults.get("cli.fix.code")).toBe(parseFixArgs([]).code);
    expect(defaults.get("config.default.docsOnlyCode")).toBe(
      docsOnlyResolved.code ?? jsonNull(),
    );
    expect(defaults.get("config.default.docsOnlySource")).toBe(
      docsOnlyResolved.source,
    );
    expect(defaults.get("config.default.noCodeBlock")).toBe(
      resolveCodeConfig({}) ?? jsonNull(),
    );
    expect(defaults.get("config.default.tsconfig")).toBe(
      resolveCodeConfig({ code: {} })?.tsconfig,
    );
    expect(defaults.get("config.default.bedrockFalse")).toEqual(
      resolveCodeConfig({ code: { bedrock: false } })?.bedrock,
    );
    expect(defaults.get("config.default.bedrockEmptyArray")).toEqual(
      resolveCodeConfig({ code: { bedrock: [] } })?.bedrock,
    );
    expect(defaults.get("config.default.bedrockWhenTrue")).toEqual(
      resolveCodeConfig({ code: { bedrock: true } })?.bedrock,
    );
    expect(defaults.get("config.default.eslint")).toBe(
      resolveCodeConfig({ code: {} })?.eslint,
    );
    expect(defaults.get("config.default.knip")).toBe(
      resolveCodeConfig({ code: {} })?.knip,
    );
    expect(defaults.get("config.default.prettier")).toBe(
      resolveCodeConfig({ code: {} })?.prettier,
    );
    expect(defaults.get("config.default.typecheck")).toBe(
      resolveCodeConfig({ code: {} })?.typecheck,
    );
  });

  it("tracks config filename precedence and config-surface count", () => {
    const filenames = inventory()
      .configSurfaces.filter((entry) => entry.kind === "discovery-filename")
      .map((entry) => entry.name);
    expect(filenames).toEqual([...CONFIG_FILENAMES]);
    expect(completeness().counts.configSurfaces).toBe(
      inventory().configSurfaces.length,
    );
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
    expect(completeness().exportEvidence.rootNamedExportCount).toBe(
      namedExportNames.length,
    );
  });

  it("tracks all adapters from injected runner behavior and forwarding", async () => {
    const allEnabled = {
      bedrock: ["src"],
      eslint: true,
      knip: true,
      prettier: true,
      tsconfig: "tsconfig.json",
      typecheck: true,
    };
    const adaptersByTool = new Map(
      inventory().toolAdapters.map((entry) => [entry.tool, entry]),
    );
    const inventoryToolSet = new Set(
      inventory().toolAdapters.map((entry) => entry.tool),
    );
    expect(inventoryToolSet).toEqual(
      new Set(["bedrock", "canon", "eslint", "knip", "prettier", "typecheck"]),
    );
    const fakeBedrockDir = join(PACKAGE_ROOT, "node_modules/bedrock");
    const isCreatedFakeBedrock = !hasPackage("bedrock");
    if (isCreatedFakeBedrock) {
      mkdirSync(join(fakeBedrockDir, "bin"), { recursive: true });
      writeFileSync(
        join(fakeBedrockDir, "package.json"),
        JSON.stringify(
          {
            bin: {
              bedrock: "bin/bedrock.js",
            },
            name: "bedrock",
            version: "0.0.0-test",
          },
          undefined,
          2,
        ),
      );
      writeFileSync(join(fakeBedrockDir, "bin/bedrock.js"), "// test stub\n");
    }

    try {
      const checkLogs: string[] = [];
      const checkInvocations: Array<{
        args: string[];
        command: string;
        cwd: string;
      }> = [];
      const checkResults = await runCodeTrack({
        config: allEnabled,
        cwd: "/repo",
        log: (message) => {
          checkLogs.push(message);
        },
        mode: "check",
        run: (command, args, cwd) => {
          checkInvocations.push({ args, command, cwd });
          return Promise.resolve(0);
        },
      });
      expect(checkResults.map((entry) => entry.tool)).toEqual([
        "bedrock",
        "eslint",
        "prettier",
        "knip",
        "typecheck",
      ]);
      expect(
        checkInvocations.every((entry) => entry.command === process.execPath),
      ).toBe(true);
      expect(checkLogs).toEqual([
        "conform check · code · bedrock",
        "conform check · code · eslint",
        "conform check · code · prettier",
        "conform check · code · knip",
        "conform check · code · typecheck",
      ]);

      const checkTools = [
        "bedrock",
        "eslint",
        "prettier",
        "knip",
        "typecheck",
      ] as const;
      for (const [index, tool] of checkTools.entries()) {
        const adapter = adaptersByTool.get(tool);
        expect(adapter).toBeDefined();
        expect(adapter?.args.check).toEqual(
          toolArgs(tool, allEnabled, "check"),
        );
        expect(checkInvocations[index]?.args.slice(1)).toEqual(
          adapter?.args.check,
        );
        expect(checkInvocations[index]?.args[0]).toBe(
          resolveBin(adapter?.bin.package ?? "", adapter?.bin.name ?? ""),
        );
      }
      const bedrockAdapter = adaptersByTool.get("bedrock");
      expect(bedrockAdapter?.args.check).toEqual(
        toolArgs("bedrock", allEnabled, "check"),
      );
      expect(bedrockAdapter?.args.fix).toEqual(
        toolArgs("bedrock", allEnabled, "fix"),
      );

      const fixLogs: string[] = [];
      const fixInvocations: Array<{
        args: string[];
        command: string;
        cwd: string;
      }> = [];
      await runCodeTrack({
        config: allEnabled,
        cwd: "/repo",
        log: (message) => {
          fixLogs.push(message);
        },
        mode: "fix",
        run: (command, args, cwd) => {
          fixInvocations.push({ args, command, cwd });
          return Promise.resolve(0);
        },
      });
      expect(fixLogs).toEqual([
        "conform fix · code · bedrock",
        "conform fix · code · eslint",
        "conform fix · code · prettier",
      ]);
      expect(fixInvocations.map((entry) => entry.args.slice(1))).toEqual([
        adaptersByTool.get("bedrock")?.args.fix,
        adaptersByTool.get("eslint")?.args.fix,
        adaptersByTool.get("prettier")?.args.fix,
      ]);
      expect(fixInvocations.map((entry) => entry.args[0])).toEqual([
        resolveBin("bedrock", "bedrock"),
        resolveBin("eslint", "eslint"),
        resolveBin("prettier", "prettier"),
      ]);
    } finally {
      if (isCreatedFakeBedrock) {
        rmSync(fakeBedrockDir, { force: true, recursive: true });
      }
    }

    const docsAdapter = adaptersByTool.get("canon");
    if (!hasPackage("@clockwork-kitten/canon")) {
      expect(docsAdapter?.bin).toEqual({
        name: "canon",
        package: "@clockwork-kitten/canon",
      });
      expect(docsAdapter?.args.checkTemplate).toEqual([
        "check",
        "<globs...>",
        "[--no-references]",
        "[--reference-ignore <substring>]",
      ]);
      expect(docsAdapter?.args.fixTemplate).toEqual([
        "fix",
        "<globs...>",
        "[--no-llms]",
      ]);
      return;
    }

    const docsCheckCalls: string[][] = [];
    await runDocsTrack({
      cwd: "/repo",
      globs: ["README.md", "docs/**/*.md"],
      llms: true,
      mode: "check",
      referenceIgnore: ["ops/", "vendor/"],
      references: false,
      run: (_command, args) => {
        docsCheckCalls.push(args);
        return Promise.resolve(0);
      },
    });
    expect(docsCheckCalls[0]?.slice(1)).toEqual([
      "check",
      "README.md",
      "docs/**/*.md",
      "--no-references",
      "--reference-ignore",
      "ops/",
      "--reference-ignore",
      "vendor/",
    ]);
    expect(docsAdapter?.args.checkTemplate).toEqual([
      "check",
      "<globs...>",
      "[--no-references]",
      "[--reference-ignore <substring>]",
    ]);

    const docsFixCalls: string[][] = [];
    await runDocsTrack({
      cwd: "/repo",
      globs: ["docs/**/*.md"],
      llms: false,
      mode: "fix",
      referenceIgnore: [],
      references: true,
      run: (_command, args) => {
        docsFixCalls.push(args);
        return Promise.resolve(0);
      },
    });
    expect(docsFixCalls[0]?.slice(1)).toEqual([
      "fix",
      "docs/**/*.md",
      "--no-llms",
    ]);
    expect(docsAdapter?.args.fixTemplate).toEqual([
      "fix",
      "<globs...>",
      "[--no-llms]",
    ]);

    const customTypecheckArgs = toolArgs(
      "typecheck",
      { ...allEnabled, tsconfig: "packages/conform/tsconfig.json" },
      "check",
    );
    expect(customTypecheckArgs).toEqual([
      "--noEmit",
      "--project",
      "packages/conform/tsconfig.json",
    ]);
  });

  it("captures config artifacts with normalized values, hashes, versions, and item dispositions", async () => {
    const artifactById = new Map(
      inventory().configArtifacts.map((entry) => [entry.id, entry]),
    );

    const eslintBase = (await import(
      pathToFileURL(join(CONFIG_DIR, "eslint.base.js")).href
    )) as {
      default: Array<{
        ignores?: string[];
        languageOptions?: unknown;
        rules?: Record<string, unknown>;
      }>;
    };
    const eslintBaseLocalOverride = eslintBase.default.findLast(
      (entry) => entry.languageOptions && entry.rules,
    );
    const eslintBaseRules = eslintBaseLocalOverride?.rules ?? {};
    const eslintBaseIgnores =
      eslintBase.default.find((entry) => entry.ignores)?.ignores ?? [];
    const eslintPresetRefs = [
      "...tseslint.configs.recommended",
      "unicorn.configs.recommended",
      "security.configs.recommended",
      'depend.configs["flat/recommended"]',
      'perfectionist.configs["recommended-natural"]',
    ];
    const eslintSummary = {
      explicitRules: eslintBaseRules,
      ignores: eslintBaseIgnores,
      presets: eslintPresetRefs,
    };
    const eslintArtifact = artifactById.get("artifact.config.eslint.base");
    expect(eslintArtifact?.contentSummary).toEqual(eslintSummary);
    expect(eslintArtifact?.effectiveHash).toBe(normalizedHash(eslintSummary));
    expect(eslintArtifact?.dependencyVersions).toEqual({
      "eslint-plugin-depend": packageVersion("eslint-plugin-depend"),
      "eslint-plugin-perfectionist": packageVersion(
        "eslint-plugin-perfectionist",
      ),
      "eslint-plugin-security": packageVersion("eslint-plugin-security"),
      "eslint-plugin-unicorn": packageVersion("eslint-plugin-unicorn"),
      globals: packageVersion("globals"),
      "typescript-eslint": packageVersion("typescript-eslint"),
    });
    expect(eslintArtifact?.itemDispositions.length).toBeGreaterThan(0);
    const eslintDispositionKeys = (
      eslintArtifact?.itemDispositions.map((entry) => entry.key) ?? []
    ).toSorted();
    const expectedRuleDispositionKeys = Object.keys(eslintBaseRules)
      .map((key) => `rule:${key}`)
      .toSorted();
    const expectedPresetDispositionKeys = eslintPresetRefs
      .map((key) => `preset:${key}`)
      .toSorted();
    expect(
      eslintDispositionKeys.filter((key) => key.startsWith("rule:")),
    ).toEqual(expectedRuleDispositionKeys);
    expect(
      eslintDispositionKeys.filter((key) => key.startsWith("preset:")),
    ).toEqual(expectedPresetDispositionKeys);

    const prettierBaseSummary = readJsonFile(
      join(CONFIG_DIR, "prettier.base.json"),
    );
    const prettierBaseArtifact = artifactById.get(
      "artifact.config.prettier.base",
    );
    expect(prettierBaseArtifact?.contentSummary).toEqual(prettierBaseSummary);
    expect(prettierBaseArtifact?.effectiveHash).toBe(
      normalizedHash(prettierBaseSummary),
    );
    expect(prettierBaseArtifact?.dependencyVersions).toEqual({
      prettier: packageVersion("prettier"),
    });

    const prettierAstroSummary = readJsonFile(
      join(CONFIG_DIR, "prettier.astro.json"),
    );
    const prettierAstroArtifact = artifactById.get(
      "artifact.config.prettier.astro",
    );
    expect(prettierAstroArtifact?.contentSummary).toEqual(prettierAstroSummary);
    expect(prettierAstroArtifact?.effectiveHash).toBe(
      normalizedHash(prettierAstroSummary),
    );
    expect(prettierAstroArtifact?.dependencyVersions).toEqual({
      prettier: packageVersion("prettier"),
      "prettier-plugin-astro": packageVersion("prettier-plugin-astro"),
    });

    const knipSummary = readJsonFile(join(CONFIG_DIR, "knip.base.json"));
    const knipArtifact = artifactById.get("artifact.config.knip.base");
    expect(knipArtifact?.contentSummary).toEqual(knipSummary);
    expect(knipArtifact?.effectiveHash).toBe(normalizedHash(knipSummary));
    expect(knipArtifact?.dependencyVersions).toEqual({
      knip: packageVersion("knip"),
    });

    const tsconfigSummary = readJsonFile(
      join(CONFIG_DIR, "tsconfig.base.json"),
    );
    const tsconfigArtifact = artifactById.get("artifact.config.tsconfig.base");
    expect(tsconfigArtifact?.contentSummary).toEqual(tsconfigSummary);
    expect(tsconfigArtifact?.effectiveHash).toBe(
      normalizedHash(tsconfigSummary),
    );
    expect(tsconfigArtifact?.dependencyVersions).toEqual({
      typescript: packageVersion("typescript"),
    });

    const astroSource = readFileSync(
      join(CONFIG_DIR, "eslint.astro.js"),
      "utf8",
    );
    const astroSummary = {
      presets: astroSource
        .matchAll(/astro\.configs\["([^"]+)"\]/g)
        .map((match) => match[1])
        .filter((entry): entry is string => entry !== undefined)
        .toArray(),
    };
    const astroArtifact = artifactById.get("artifact.config.eslint.astro");
    expect(astroArtifact?.contentSummary).toEqual(astroSummary);
    expect(astroArtifact?.effectiveHash).toBe(normalizedHash(astroSummary));
    expect(astroArtifact?.dependencyVersions).toEqual({
      "eslint-plugin-astro": packageVersion("eslint-plugin-astro"),
    });

    expect(
      inventory().configArtifacts.every(
        (artifact) => artifact.itemDispositions.length > 0,
      ),
    ).toBe(true);
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

  it("records reproducible org-wide stale PR evidence and authority-known dispositions", () => {
    const adoptionEvidence = inventory().openOrStaleAdoptionPrs as unknown as {
      pullRequests: Array<{
        number: number;
        relevance: string;
        repository: string;
        stale: boolean;
        url: string;
      }>;
      queries: Array<{
        query: string;
        resultUrls: string[];
        totalCount: number;
      }>;
      staleDefinition: { staleAfterDays: number };
    };
    expect(adoptionEvidence.staleDefinition.staleAfterDays).toBe(30);
    expect(
      adoptionEvidence.queries.every((query) =>
        query.query.includes("org:clockwork-kitten"),
      ),
    ).toBe(true);
    expect(
      adoptionEvidence.queries.every(
        (query) => query.resultUrls.length <= query.totalCount,
      ),
    ).toBe(true);

    const authorityByRelevance = new Map(
      adoptionEvidence.pullRequests.map((entry) => [entry.relevance, entry]),
    );
    expect(authorityByRelevance.get("authority-known-canon-6")).toMatchObject({
      number: 6,
      repository: "clockwork-kitten/canon",
      stale: true,
      url: "https://github.com/clockwork-kitten/canon/pull/6",
    });
    expect(
      authorityByRelevance.get("authority-known-home-adoption"),
    ).toMatchObject({
      number: 4,
      repository: "clockwork-kitten/ops",
      stale: false,
      url: "https://github.com/clockwork-kitten/ops/pull/4",
    });
  });

  it("tracks current fixture files", () => {
    const fixtureFiles = readdirSync(
      join(PACKAGE_ROOT, "src/code/__fixtures__/astro"),
    ).toSorted();
    expect(
      completeness()
        .fixtures.map((entry) => entry.path)
        .toSorted(),
    ).toEqual(
      fixtureFiles.map(
        (name) => `packages/conform/src/code/__fixtures__/astro/${name}`,
      ),
    );
  });

  it("tracks separate repo-local cutover issue per discovered external consumer", () => {
    const consumerById = new Map(
      inventory().consumers.map((entry) => [entry.id, entry]),
    );
    const opsConsumer = consumerById.get("consumer.ops") as
      (InventoryItem & { followUpIssue?: string; name: string }) | undefined;
    const incubatorConsumer = consumerById.get("consumer.incubator") as
      (InventoryItem & { followUpIssue?: string; name: string }) | undefined;

    expect(opsConsumer?.name).toBe("clockwork-kitten/ops");
    expect(incubatorConsumer?.name).toBe("clockwork-kitten/incubator");
    expect(opsConsumer?.followUpIssue).toMatch(
      /^https:\/\/github\.com\/clockwork-kitten\/ops\/issues\/\d+$/,
    );
    expect(incubatorConsumer?.followUpIssue).toMatch(
      /^https:\/\/github\.com\/clockwork-kitten\/incubator\/issues\/\d+$/,
    );
    expect(opsConsumer?.followUpIssue).not.toBe(
      incubatorConsumer?.followUpIssue,
    );

    const cutoverIssues =
      completeness().consumerAndSearchEvidence?.consumerCutoverIssues ?? [];
    expect(cutoverIssues).toEqual(
      expect.arrayContaining([
        {
          repository: "clockwork-kitten/ops",
          url: opsConsumer?.followUpIssue,
        },
        {
          repository: "clockwork-kitten/incubator",
          url: incubatorConsumer?.followUpIssue,
        },
      ]),
    );
  });
});
