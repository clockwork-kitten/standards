import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const HARNESS_PATH = fileURLToPath(
  new URL("../scripts/verify-canonical-vectors.mjs", import.meta.url),
);

async function runHarness(executable: string): Promise<string> {
  const process = Bun.spawn([executable, HARNESS_PATH], {
    cwd: PACKAGE_ROOT,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
  return stdout;
}

describe("RFC 8785 canonical JSON vectors", () => {
  test("pass the runtime-neutral harness under Node and Bun development", async () => {
    const [nodeOutput, bunOutput] = await Promise.all([
      runHarness("node"),
      runHarness("bun"),
    ]);

    expect(nodeOutput).toContain("RFC 8785 vectors with node");
    expect(bunOutput).toContain("RFC 8785 vectors with bun");
  });
});
