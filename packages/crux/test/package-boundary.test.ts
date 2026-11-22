import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

type PackageManifest = {
  dependencies?: Record<string, string>;
  exports: Record<string, string>;
  scripts: Record<string, string>;
};

const PACKAGE_PATH = fileURLToPath(new URL("../package.json", import.meta.url));

describe("inert package boundary", () => {
  test("has no root export, runtime dependency, or lifecycle script", async () => {
    const packageManifest = JSON.parse(
      await readFile(PACKAGE_PATH, "utf8"),
    ) as PackageManifest;
    const lifecycleScripts = [
      "install",
      "postinstall",
      "postpack",
      "preinstall",
      "prepare",
      "prepack",
    ];

    expect(packageManifest.exports["."]).toBeUndefined();
    expect(packageManifest.dependencies).toBeUndefined();
    expect(
      lifecycleScripts.filter((script) =>
        Object.hasOwn(packageManifest.scripts, script),
      ),
    ).toEqual([]);
    expect(Object.values(packageManifest.exports)).toEqual(
      expect.arrayContaining([
        "./schemas/rule.schema.json",
        "./schemas/policy.schema.json",
        "./schemas/profile.schema.json",
        "./schemas/suppression.schema.json",
        "./schemas/engine-manifest.schema.json",
        "./types/index.d.ts",
      ]),
    );
  });
});
