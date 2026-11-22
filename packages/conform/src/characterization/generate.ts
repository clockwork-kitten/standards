import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ResolvedCodeConfig } from "../config/resolve.ts";

import eslintAstro from "../../configs/eslint.astro.js";
import eslintBase from "../../configs/eslint.base.js";
import { runCheck, runFix } from "../cli/main.ts";
import { enabledTools, toolArgs } from "../code/run.ts";
import {
  CONFIG_FILENAMES,
  resolveCodeConfig,
  resolveConfig,
} from "../config/resolve.ts";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DENOMINATOR_PATH = join(
  PACKAGE_ROOT,
  "characterization",
  "denominator.json",
);
const INVENTORY_PATH = join(PACKAGE_ROOT, "inventory", "legacy-conform.json");
const requireFromPackage = createRequire(join(PACKAGE_ROOT, "package.json"));

type Golden = {
  intentionalDifferenceReferences?: string[];
  normalized: unknown;
  p01Inventory: {
    legacyHeadSha: string;
    path: "packages/conform/inventory/legacy-conform.json";
  };
  p01References: string[];
  schemaVersion: "1.0.0";
  surface: string;
};

type Inventory = {
  commands: InventoryRecord[];
  configArtifacts: InventoryRecord[];
  configSurfaces: InventoryRecord[];
  defaults: InventoryRecord[];
  provenance: { legacyHeadSha: string };
  toolAdapters: InventoryRecord[];
};

type InventoryRecord = {
  id: string;
  migration: { kind: "destination" | "dropped" | "intentional-difference" };
};

type JsonObject = Record<string, unknown>;

type P02Denominator = {
  goldens: Record<
    string,
    {
      intentionalDifferenceReferences: string[];
      p01References: string[];
    }
  >;
  p01Inventory: {
    legacyHeadSha: string;
    path: "packages/conform/inventory/legacy-conform.json";
  };
  provenance: {
    dependencyVersions: Record<string, string>;
    sourceSha256: Record<string, string>;
  };
  requiredIntentionalDifferenceReferences: string[];
  requiredP01References: string[];
  schemaVersion: "1.0.0";
};

export const CHARACTERIZATION_DIR = join(
  PACKAGE_ROOT,
  "characterization",
  "goldens",
);

export const GOLDEN_FILENAMES = [
  "config-resolution.json",
  "eslint-astro.json",
  "eslint-base.json",
  "execution-candidates.json",
  "exits.json",
  "knip-base.json",
  "prettier-astro.json",
  "prettier-base.json",
  "tool-ordering.json",
  "typescript-base.json",
] as const;

const BASE_CODE_CONFIG = requiredCodeConfig({ code: {} });
const P01_INVENTORY = readJson(INVENTORY_PATH) as Inventory;
const P02_DENOMINATOR = readJson(DENOMINATOR_PATH) as P02Denominator;

/** Build every normalized pre-split characterization artifact in memory. */
export async function buildCharacterizationGoldens(): Promise<
  Record<(typeof GOLDEN_FILENAMES)[number], Golden>
> {
  verifyCharacterizationProvenance();
  const goldens = {
    "config-resolution.json": await characterizeConfigResolution(),
    "eslint-astro.json": characterizeEslint("astro", eslintAstro),
    "eslint-base.json": characterizeEslint("base", eslintBase),
    "execution-candidates.json": characterizeExecutionCandidates(),
    "exits.json": await characterizeExits(),
    "knip-base.json": characterizeJsonConfig(
      "knip.base.json",
      "knip-base",
      "artifact.config.knip.base",
      ["knip"],
    ),
    "prettier-astro.json": characterizeJsonConfig(
      "prettier.astro.json",
      "prettier-astro",
      "artifact.config.prettier.astro",
      ["prettier", "prettier-plugin-astro"],
    ),
    "prettier-base.json": characterizeJsonConfig(
      "prettier.base.json",
      "prettier-base",
      "artifact.config.prettier.base",
      ["prettier"],
    ),
    "tool-ordering.json": await characterizeToolOrdering(),
    "typescript-base.json": characterizeJsonConfig(
      "tsconfig.base.json",
      "typescript-base",
      "artifact.config.tsconfig.base",
      ["typescript"],
    ),
  } satisfies Record<(typeof GOLDEN_FILENAMES)[number], Golden>;

  validateInventoryReferences(goldens);
  return goldens;
}

/** Hash the stable normalized bytes used by drift diagnostics. */
export function characterizationHash(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

/** Return sorted golden names whose normalized bytes differ. */
export function findGoldenDrift(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): string[] {
  return [...new Set([...Object.keys(expected), ...Object.keys(actual)])]
    .filter(
      (name) =>
        stableSerialize(expected[name]) !== stableSerialize(actual[name]),
    )
    .toSorted();
}

/** Serialize JSON with recursively sorted object keys and stable indentation. */
export function stableSerialize(value: unknown): string {
  return `${JSON.stringify(stableNormalize(value), undefined, 2)}\n`;
}

/** Fail when checkout inputs do not match the source revision declared by P02. */
export function verifyCharacterizationProvenance(
  sourceSha256 = P02_DENOMINATOR.provenance.sourceSha256,
): void {
  if (
    P02_DENOMINATOR.p01Inventory.legacyHeadSha !==
    P01_INVENTORY.provenance.legacyHeadSha
  ) {
    throw new Error("P02 provenance does not match the P01 legacy revision");
  }
  for (const [path, expectedHash] of Object.entries(sourceSha256).toSorted()) {
    const actualHash = createHash("sha256")
      .update(readFileSync(join(PACKAGE_ROOT, path)))
      .digest("hex");
    if (actualHash !== expectedHash) {
      throw new Error(
        `P02 provenance mismatch for "${path}": expected ${expectedHash}, received ${actualHash}`,
      );
    }
  }
  const actualVersions = packageVersions(
    Object.keys(P02_DENOMINATOR.provenance.dependencyVersions),
  );
  if (
    stableSerialize(actualVersions) !==
    stableSerialize(P02_DENOMINATOR.provenance.dependencyVersions)
  ) {
    throw new Error(
      "P02 dependency provenance does not match installed inputs",
    );
  }
}

function artifact(
  surface: string,
  p01References: string[],
  normalized: unknown,
  intentionalDifferenceReferences?: string[],
): Golden {
  return {
    ...(intentionalDifferenceReferences && { intentionalDifferenceReferences }),
    normalized,
    p01Inventory: {
      legacyHeadSha: P01_INVENTORY.provenance.legacyHeadSha,
      path: "packages/conform/inventory/legacy-conform.json",
    },
    p01References,
    schemaVersion: "1.0.0",
    surface,
  };
}

function assertExactSet(
  label: string,
  actual: readonly string[],
  expected: readonly string[],
): void {
  const actualSet = [...new Set(actual)].toSorted();
  const expectedSet = [...new Set(expected)].toSorted();
  if (
    actualSet.length !== actual.length ||
    expectedSet.length !== expected.length
  ) {
    throw new Error(`${label} contains duplicate references`);
  }
  if (stableSerialize(actualSet) !== stableSerialize(expectedSet)) {
    throw new Error(
      `${label} mismatch: expected ${JSON.stringify(expectedSet)}, received ${JSON.stringify(actualSet)}`,
    );
  }
}

function candidate(
  p01Reference: string,
  candidateKind: "executing" | "static",
  observedInputs: string[],
): JsonObject {
  return { candidateKind, observedInputs, p01Reference };
}

async function characterizeConfigResolution(): Promise<Golden> {
  const scratch = mkdtempSync(join(tmpdir(), "conform-characterization-"));
  try {
    const noConfig = await resolveConfig({ cwd: scratch });
    writeFileSync(
      join(scratch, "conform.config.ts"),
      "export default { code: { tsconfig: 'typescript-fixture.json' } };",
      "utf8",
    );
    writeFileSync(
      join(scratch, "conform.config.jsonc"),
      '{\n  // JSONC fixture\n  "code": { "tsconfig": "jsonc-fixture.json", },\n}\n',
      "utf8",
    );
    const typescriptDefaultExport = await resolveConfig({
      configPath: "conform.config.ts",
      cwd: scratch,
    });
    const jsonc = await resolveConfig({
      configPath: "conform.config.jsonc",
      cwd: scratch,
    });
    const bare = requiredCodeConfig({ code: {} });
    const custom = requiredCodeConfig({
      code: {
        bedrock: ["src", "scripts"],
        eslint: false,
        knip: false,
        prettier: false,
        tsconfig: "packages/app/tsconfig.json",
        typecheck: false,
      },
    });
    return artifact(
      "configuration-resolution",
      [
        "config.discovery.conform.config.ts",
        "config.discovery.conform.config.mts",
        "config.discovery.conform.config.mjs",
        "config.discovery.conform.config.js",
        "config.discovery.conform.config.jsonc",
        "config.discovery.conform.config.json",
        "config.loader.typescript-default-export",
        "config.loader.jsonc",
        "config.key.code",
        "config.key.code.bedrock",
        "config.key.code.eslint",
        "config.key.code.knip",
        "config.key.code.prettier",
        "config.key.code.tsconfig",
        "config.key.code.typecheck",
        "default.config.default.docsOnlyCode",
        "default.config.default.docsOnlySource",
        "default.config.default.noCodeBlock",
        "default.config.default.tsconfig",
        "default.config.default.bedrockFalse",
        "default.config.default.bedrockEmptyArray",
        "default.config.default.bedrockWhenTrue",
        "default.config.default.eslint",
        "default.config.default.knip",
        "default.config.default.prettier",
        "default.config.default.typecheck",
      ],
      {
        bareCodeBlock: bare,
        bedrockEmptyArray: resolveCodeConfig({ code: { bedrock: [] } }),
        bedrockTrue: resolveCodeConfig({ code: { bedrock: true } }),
        customCodeBlock: custom,
        discoveryPrecedence: CONFIG_FILENAMES,
        loadedConfigForms: {
          jsonc: jsonc.code,
          typescriptDefaultExport: typescriptDefaultExport.code,
        },
        noCodeBlock: resolveCodeConfig({}) ?? jsonNull(),
        noConfig: {
          code: noConfig.code ?? jsonNull(),
          source: noConfig.source,
        },
      },
      [
        "config.key.code.bedrock",
        "default.config.default.bedrockFalse",
        "default.config.default.bedrockEmptyArray",
        "default.config.default.bedrockWhenTrue",
      ],
    );
  } finally {
    rmSync(scratch, { force: true, recursive: true });
  }
}

function characterizeEslint(name: "astro" | "base", config: unknown[]): Golden {
  const inventoryId = `artifact.config.eslint.${name}`;
  const dependencies =
    name === "base"
      ? [
          "eslint",
          "eslint-plugin-depend",
          "eslint-plugin-perfectionist",
          "eslint-plugin-security",
          "eslint-plugin-unicorn",
          "globals",
          "typescript-eslint",
        ]
      : ["eslint", "eslint-plugin-astro", "eslint-plugin-jsx-a11y"];
  return artifact(
    `eslint-${name}`,
    [inventoryId],
    {
      config: config.map((entry, index) => normalizeEslintEntry(entry, index)),
      dependencyVersions: packageVersions(dependencies),
    },
    name === "base" ? [inventoryId] : undefined,
  );
}

function characterizeExecutionCandidates(): Golden {
  return artifact(
    "static-executing-candidates",
    [
      "artifact.config.eslint.base",
      "artifact.config.eslint.astro",
      "artifact.config.prettier.base",
      "artifact.config.prettier.astro",
      "artifact.config.knip.base",
      "artifact.config.tsconfig.base",
      "adapter.code.bedrock",
      "adapter.code.eslint",
      "adapter.code.knip",
      "adapter.code.prettier",
      "adapter.code.typecheck",
      "adapter.docs.canon",
      ...CONFIG_FILENAMES.map((name) => `config.discovery.${name}`),
    ],
    {
      candidates: [
        candidate("artifact.config.eslint.base", "executing", [
          "module-import",
          "plugin-code",
        ]),
        candidate("artifact.config.eslint.astro", "executing", [
          "module-import",
          "plugin-code",
        ]),
        candidate("artifact.config.prettier.base", "static", ["strict-json"]),
        candidate("artifact.config.prettier.astro", "executing", [
          "strict-json",
          "plugin-code",
        ]),
        candidate("artifact.config.tsconfig.base", "static", ["strict-json"]),
        candidate("artifact.config.knip.base", "static", ["strict-json"]),
        ...CONFIG_FILENAMES.map((name) =>
          candidate(
            `config.discovery.${name}`,
            /\.jsonc?$/.test(name) ? "static" : "executing",
            [/.jsonc?$/.test(name) ? "data-config" : "module-import"],
          ),
        ),
        ...["bedrock", "eslint", "knip", "prettier", "typecheck"].map((tool) =>
          candidate(`adapter.code.${tool}`, "executing", ["subprocess"]),
        ),
        candidate("adapter.docs.canon", "executing", ["subprocess"]),
      ],
      classification: "candidate",
    },
    ["adapter.code.bedrock", "artifact.config.eslint.base"],
  );
}

async function characterizeExits(): Promise<Golden> {
  const scratch = mkdtempSync(join(tmpdir(), "conform-characterization-"));
  try {
    writeFileSync(
      join(scratch, "conform.config.json"),
      '{"code":{}}\n',
      "utf8",
    );
    const quiet = async (run: () => Promise<number>): Promise<number> => {
      const original = console.error;
      console.error = () => {};
      try {
        return await run();
      } finally {
        console.error = original;
      }
    };
    return artifact("command-exits", ["command.check", "command.fix"], {
      check: {
        codeFailure: await quiet(() =>
          runCheck([], scratch, {
            runCode: () => Promise.resolve([{ code: 7, tool: "typecheck" }]),
            runDocs: () => Promise.resolve(0),
          }),
        ),
        docsFailure: await quiet(() =>
          runCheck([], scratch, {
            runCode: () => Promise.resolve([]),
            runDocs: () => Promise.resolve(9),
          }),
        ),
        help: await quiet(() => runCheck(["--help"], scratch)),
        invocationError: await quiet(() => runCheck(["--config"], scratch)),
        pass: await quiet(() =>
          runCheck([], scratch, {
            runCode: () => Promise.resolve([]),
            runDocs: () => Promise.resolve(0),
          }),
        ),
      },
      fix: {
        help: await quiet(() => runFix(["--help"], scratch)),
        invocationError: await quiet(() => runFix(["--config"], scratch)),
        residueIsReportedButNonFailing: await quiet(() =>
          runFix([], scratch, {
            runCode: () => Promise.resolve([{ code: 8, tool: "prettier" }]),
            runDocs: () => Promise.resolve(6),
          }),
        ),
      },
    });
  } finally {
    rmSync(scratch, { force: true, recursive: true });
  }
}

function characterizeJsonConfig(
  filename: string,
  surface: string,
  inventoryId: string,
  dependencyNames: string[],
): Golden {
  return artifact(surface, [inventoryId], {
    config: readJson(join(PACKAGE_ROOT, "configs", filename)),
    dependencyVersions: packageVersions(dependencyNames),
  });
}

async function characterizeToolOrdering(): Promise<Golden> {
  const withBedrock = { ...BASE_CODE_CONFIG, bedrock: ["src"] };
  const scratch = mkdtempSync(join(tmpdir(), "conform-characterization-"));
  try {
    writeFileSync(
      join(scratch, "conform.config.json"),
      '{"code":{}}\n',
      "utf8",
    );
    const checkTracks: string[] = [];
    await runCheck([], scratch, {
      runCode: () => {
        checkTracks.push("code");
        return Promise.resolve([]);
      },
      runDocs: () => {
        checkTracks.push("docs");
        return Promise.resolve(0);
      },
    });
    const fixTracks: string[] = [];
    await runFix([], scratch, {
      runCode: () => {
        fixTracks.push("code");
        return Promise.resolve([]);
      },
      runDocs: () => {
        fixTracks.push("docs");
        return Promise.resolve(0);
      },
    });

    return artifact(
      "tool-ordering",
      [
        "adapter.docs.canon",
        "adapter.code.bedrock",
        "adapter.code.eslint",
        "adapter.code.knip",
        "adapter.code.prettier",
        "adapter.code.typecheck",
      ],
      {
        bedrockEnabled: {
          check: enabledTools(withBedrock, "check"),
          fix: enabledTools(withBedrock, "fix"),
        },
        default: {
          check: enabledTools(BASE_CODE_CONFIG, "check"),
          fix: enabledTools(BASE_CODE_CONFIG, "fix"),
        },
        invocationArguments: Object.fromEntries(
          enabledTools(withBedrock, "check").map((tool) => [
            tool,
            {
              check: toolArgs(tool, withBedrock, "check"),
              ...(enabledTools(withBedrock, "fix").includes(tool) && {
                fix: toolArgs(tool, withBedrock, "fix"),
              }),
            },
          ]),
        ),
        orchestration: {
          check: checkTracks,
          fix: fixTracks,
        },
      },
      ["adapter.code.bedrock"],
    );
  } finally {
    rmSync(scratch, { force: true, recursive: true });
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonNull(): null {
  return JSON.parse("null") as null;
}

function normalizeEslintEntry(value: unknown, index: number): JsonObject {
  if (!isObject(value)) {
    return { index, value: normalizeValue(value) };
  }
  const entry: JsonObject = { index };
  for (const key of [
    "files",
    "ignores",
    "language",
    "linterOptions",
    "name",
    "processor",
    "rules",
    "settings",
  ]) {
    if (value[key] !== undefined) {
      entry[key] = normalizeValue(value[key]);
    }
  }
  if (isObject(value.languageOptions)) {
    entry.languageOptions = normalizeLanguageOptions(value.languageOptions);
  }
  if (isObject(value.plugins)) {
    entry.plugins = Object.fromEntries(
      Object.entries(value.plugins).map(([name, plugin]) => [
        name,
        isObject(plugin) && isObject(plugin.meta)
          ? normalizeValue(plugin.meta)
          : { registered: true },
      ]),
    );
  }
  return entry;
}

function normalizeLanguageOptions(value: JsonObject): JsonObject {
  const normalized: JsonObject = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "parser") {
      normalized.parser =
        isObject(entry) && isObject(entry.meta)
          ? normalizeValue(entry.meta)
          : isObject(entry)
            ? { capabilities: Object.keys(entry).toSorted(), registered: true }
            : normalizeValue(entry);
    } else {
      normalized[key] = normalizeValue(entry);
    }
  }
  return normalized;
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "function") {
    return `[function:${value.name || "anonymous"}]`;
  }
  if (value instanceof RegExp) {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, normalizeValue(entry)]),
    );
  }
  return value;
}

function packageVersion(name: string): string {
  const paths = requireFromPackage.resolve.paths(name) ?? [];
  for (const base of paths) {
    const manifestPath = join(base, ...name.split("/"), "package.json");
    if (!existsSync(manifestPath)) {
      continue;
    }
    const manifest = readJson(manifestPath) as { version?: unknown };
    if (typeof manifest.version === "string") {
      return manifest.version;
    }
  }
  throw new Error(`Cannot resolve package version for "${name}"`);
}

function packageVersions(names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, packageVersion(name)]));
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function requiredCodeConfig(
  config: Parameters<typeof resolveCodeConfig>[0],
): ResolvedCodeConfig {
  const resolved = resolveCodeConfig(config);
  if (!resolved) {
    throw new Error("Expected a code block to resolve");
  }
  return resolved;
}

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableNormalize(entry));
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableNormalize(entry)]),
    );
  }
  return value;
}

function validateInventoryReferences(goldens: Record<string, Golden>): void {
  const records = [
    ...P01_INVENTORY.commands,
    ...P01_INVENTORY.configArtifacts,
    ...P01_INVENTORY.configSurfaces,
    ...P01_INVENTORY.defaults,
    ...P01_INVENTORY.toolAdapters,
  ];
  const recordsById = new Map(records.map((record) => [record.id, record]));
  assertExactSet(
    "P02 golden filenames",
    Object.keys(P02_DENOMINATOR.goldens),
    GOLDEN_FILENAMES,
  );
  assertExactSet(
    "generated golden filenames",
    Object.keys(goldens),
    GOLDEN_FILENAMES,
  );
  for (const [filename, golden] of Object.entries(goldens)) {
    const expected = P02_DENOMINATOR.goldens[filename];
    if (!expected) {
      throw new Error(`P02 denominator has no entry for "${filename}"`);
    }
    assertExactSet(
      `${filename} P01 references`,
      golden.p01References,
      expected.p01References,
    );
    assertExactSet(
      `${filename} intentional-difference references`,
      golden.intentionalDifferenceReferences ?? [],
      expected.intentionalDifferenceReferences,
    );
    for (const reference of golden.p01References) {
      if (!recordsById.has(reference)) {
        throw new Error(
          `${filename} cites missing P01 inventory record "${reference}"`,
        );
      }
    }
    const differenceReferences = golden.intentionalDifferenceReferences ?? [];
    for (const reference of differenceReferences) {
      const record = recordsById.get(reference);
      if (record?.migration.kind !== "intentional-difference") {
        throw new Error(
          `${filename} cites non-difference P01 record "${reference}" as an intentional difference`,
        );
      }
    }
  }
  assertExactSet(
    "P02 P01 citation coverage",
    [
      ...new Set(
        Object.values(goldens).flatMap((golden) => golden.p01References),
      ),
    ],
    P02_DENOMINATOR.requiredP01References,
  );
  assertExactSet(
    "P02 intentional-difference citation coverage",
    [
      ...new Set(
        Object.values(goldens).flatMap(
          (golden) => golden.intentionalDifferenceReferences ?? [],
        ),
      ),
    ],
    P02_DENOMINATOR.requiredIntentionalDifferenceReferences,
  );
}
