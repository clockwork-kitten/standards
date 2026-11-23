import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_ROOT = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(TEST_ROOT, "..", "..");
const EXPECTED_MANIFEST_PATH = join(TEST_ROOT, "tarball-files.json");
const TYPESCRIPT_VERSION = "5.7.3";

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  assert.equal(
    result.status,
    0,
    `${command} ${arguments_.join(" ")} failed:\n${result.stderr}`,
  );
  return result.stdout;
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "crux-distribution-"));

try {
  const packOutput = run("npm", [
    "pack",
    PACKAGE_ROOT,
    "--json",
    "--pack-destination",
    temporaryRoot,
  ]);
  const [packResult] = JSON.parse(packOutput);
  assert.ok(packResult, "npm pack did not return a result");

  const expectedManifest = JSON.parse(
    await readFile(EXPECTED_MANIFEST_PATH, "utf8"),
  );
  const actualManifest = packResult.files
    .map(({ path }) => path)
    .toSorted((left, right) => left.localeCompare(right));
  assert.deepEqual(actualManifest, expectedManifest);

  const packageManifest = JSON.parse(
    await readFile(join(PACKAGE_ROOT, "package.json"), "utf8"),
  );
  assert.equal(packageManifest.dependencies, undefined);
  assert.equal(packageManifest.devDependencies, undefined);
  assert.equal(packageManifest.scripts, undefined);
  assert.equal(packageManifest.exports["."], undefined);
  assert.deepEqual(packageManifest.publishConfig, {
    access: "public",
    provenance: true,
    tag: "next",
  });

  const consumerRoot = join(temporaryRoot, "consumer");
  await mkdir(consumerRoot);
  await writeFile(
    join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        dependencies: {
          "@clockwork-kitten/crux": `file:${join(
            temporaryRoot,
            packResult.filename,
          )}`,
        },
        devDependencies: { typescript: TYPESCRIPT_VERSION },
        private: true,
        type: "module",
      },
      undefined,
      2,
    )}\n`,
  );
  await cp(join(TEST_ROOT, "imports.mjs"), join(consumerRoot, "imports.mjs"));
  await cp(join(TEST_ROOT, "types.ts"), join(consumerRoot, "types.ts"));
  await cp(
    join(TEST_ROOT, "tsconfig.json"),
    join(consumerRoot, "tsconfig.json"),
  );

  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
    ],
    { cwd: consumerRoot },
  );
  run(process.execPath, ["imports.mjs"], { cwd: consumerRoot });
  run(
    process.execPath,
    ["node_modules/typescript/bin/tsc", "--project", "tsconfig.json"],
    { cwd: consumerRoot },
  );

  process.stdout.write(
    `verified ${packResult.filename} (${actualManifest.length} files) on ${process.version}\n`,
  );
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
