import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  exports: Record<string, string>;
  publishConfig: {
    access: string;
    provenance: boolean;
    tag: string;
  };
  repository: {
    directory: string;
    type: string;
    url: string;
  };
  scripts?: Record<string, string>;
};

type PackResult = {
  files: {
    path: string;
  }[];
};

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PACKAGE_PATH = fileURLToPath(new URL("../package.json", import.meta.url));

describe("inert package boundary", () => {
  test("has no root export, dependency, or package script", async () => {
    const packageManifest = JSON.parse(
      await readFile(PACKAGE_PATH, "utf8"),
    ) as PackageManifest;
    expect(packageManifest.exports["."]).toBeUndefined();
    expect(packageManifest.dependencies).toBeUndefined();
    expect(packageManifest.devDependencies).toBeUndefined();
    expect(packageManifest.scripts).toBeUndefined();
    expect(packageManifest.publishConfig).toEqual({
      access: "public",
      provenance: true,
      tag: "next",
    });
    expect(packageManifest.repository).toEqual({
      directory: "packages/crux",
      type: "git",
      url: "git+https://github.com/clockwork-kitten/standards.git",
    });
    expect(Object.values(packageManifest.exports)).toEqual(
      expect.arrayContaining([
        "./schemas/baseline.schema.json",
        "./schemas/rule.schema.json",
        "./schemas/policy.schema.json",
        "./schemas/profile.schema.json",
        "./schemas/suppression.schema.json",
        "./schemas/suppression-registry.schema.json",
        "./schemas/vector-catalog.schema.json",
        "./policy/existing-behavior.json",
        "./vectors/canon.json",
        "./vectors/conform.json",
        "./vectors/crucible.json",
        "./migration/legacy-disposition.json",
        "./reconciliation/existing-behavior.json",
        "./schemas/engine-manifest.schema.json",
        "./schemas/exception.schema.json",
        "./schemas/fingerprint.schema.json",
        "./schemas/inventory-reconciliation.schema.json",
        "./schemas/migration-disposition.schema.json",
        "./schemas/repository-policy.schema.json",
        "./schemas/bundle.schema.json",
        "./schemas/lock.schema.json",
        "./schemas/engine-result.schema.json",
        "./schemas/conform-result.schema.json",
        "./schemas/context.schema.json",
        "./types/index.d.ts",
      ]),
    );
  });

  test("packs every public schema and generated declaration without development code", async () => {
    const process = Bun.spawn(
      ["npm", "pack", PACKAGE_ROOT, "--dry-run", "--json"],
      {
        stderr: "pipe",
        stdout: "pipe",
      },
    );
    const [exitCode, output, errorOutput] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ]);
    expect(exitCode, errorOutput).toBe(0);

    const [packResult] = JSON.parse(output) as PackResult[];
    const packedPaths = packResult?.files.map((file) => file.path) ?? [];
    expect(packedPaths).toEqual(
      expect.arrayContaining([
        "schemas/baseline.schema.json",
        "schemas/exception.schema.json",
        "schemas/fingerprint.schema.json",
        "schemas/inventory-reconciliation.schema.json",
        "schemas/migration-disposition.schema.json",
        "schemas/repository-policy.schema.json",
        "schemas/suppression-registry.schema.json",
        "schemas/vector-catalog.schema.json",
        "policy/existing-behavior.json",
        "vectors/canon.json",
        "vectors/conform.json",
        "vectors/crucible.json",
        "migration/legacy-disposition.json",
        "reconciliation/existing-behavior.json",
        "types/generated/baseline.d.ts",
        "types/generated/exception.d.ts",
        "types/generated/fingerprint.d.ts",
        "types/generated/inventory-reconciliation.d.ts",
        "types/generated/migration-disposition.d.ts",
        "types/generated/repository-policy.d.ts",
        "types/generated/suppression-registry.d.ts",
        "types/generated/vector-catalog.d.ts",
        "schemas/bundle.schema.json",
        "schemas/conform-result.schema.json",
        "schemas/context.schema.json",
        "schemas/engine-result.schema.json",
        "schemas/lock.schema.json",
        "types/generated/bundle.d.ts",
        "types/generated/conform-result.d.ts",
        "types/generated/context.d.ts",
        "types/generated/engine-result.d.ts",
        "types/generated/lock.d.ts",
        "types/index.d.ts",
      ]),
    );
    expect(
      packedPaths.filter(
        (path) => path.startsWith("scripts/") || path.startsWith("test/"),
      ),
    ).toEqual([]);
  });
});
