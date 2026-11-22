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
        "./schemas/bundle.schema.json",
        "./schemas/lock.schema.json",
        "./schemas/engine-result.schema.json",
        "./schemas/conform-result.schema.json",
        "./schemas/context.schema.json",
        "./types/index.d.ts",
      ]),
    );
  });

  test("packs schemas and declarations without development tooling", async () => {
    const packageRoot = fileURLToPath(new URL("..", import.meta.url));
    const process = Bun.spawn(["bun", "pm", "pack", "--dry-run"], {
      cwd: packageRoot,
      stderr: "pipe",
      stdout: "pipe",
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ]);
    const output = `${stdout}\n${stderr}`;

    expect(exitCode, output).toBe(0);
    expect(output).toContain("schemas/bundle.schema.json");
    expect(output).toContain("schemas/lock.schema.json");
    expect(output).toContain("schemas/engine-result.schema.json");
    expect(output).toContain("schemas/conform-result.schema.json");
    expect(output).toContain("schemas/context.schema.json");
    expect(output).toContain("types/generated/engine-result.d.ts");
    expect(output).not.toContain("scripts/generate-types.ts");
    expect(output).not.toContain("test/contracts.test.ts");
  });
});
