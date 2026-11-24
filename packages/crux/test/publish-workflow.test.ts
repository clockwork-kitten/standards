import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const WORKFLOW_PATH = fileURLToPath(
  new URL("../../../.github/workflows/publish-crux.yml", import.meta.url),
);
const VERIFIER_PATH = fileURLToPath(
  new URL("distribution/verify-published-package.mjs", import.meta.url),
);

describe("Crux publication workflow", () => {
  test("keeps bootstrap one-time, manual, protected, and token-isolated", async () => {
    const workflow = await readFile(WORKFLOW_PATH, "utf8");

    expect(workflow).toContain("type: boolean");
    expect(workflow).toContain("default: false");
    expect(workflow).toContain(
      "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'",
    );
    expect(workflow).toContain(
      "bootstrap is permanently disabled once any package version exists",
    );
    expect(workflow).toContain("environment: crux-npm");
    expect(workflow.match(/environment: crux-npm/g)).toHaveLength(2);
    expect(workflow).toContain(
      "NODE_AUTH_TOKEN: ${{ secrets.NPM_BOOTSTRAP_TOKEN }}",
    );
    expect(workflow.match(/NODE_AUTH_TOKEN:/g)).toHaveLength(1);
    expect(workflow).toContain(
      "if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && !inputs.bootstrap",
    );
  });

  test("requires exact registry metadata and signed provenance evidence", async () => {
    const workflow = await readFile(WORKFLOW_PATH, "utf8");
    const verifier = await readFile(VERIFIER_PATH, "utf8");

    expect(
      workflow.match(/verify-published-package\.mjs "\$VERSION"/g),
    ).toHaveLength(2);
    expect(
      workflow.match(/npm ci --ignore-scripts --no-audit --no-fund/g),
    ).toHaveLength(3);
    expect(workflow).toContain("Verify captured npm provenance");
    expect(verifier).toContain("new Verifier(");
    expect(verifier).toContain("bundleFromJSON(provenance.bundle)");
    expect(verifier).toContain("subjectAlternativeName");
    expect(verifier).toContain("extensions: { issuer:");
    expect(verifier).toContain('"1.3.6.1.4.1.57264.1.23": "crux-npm"');
    expect(verifier).toContain(
      "repo:clockwork-kitten/standards:environment:crux-npm",
    );
    expect(verifier).toContain("ctlogThreshold: 1");
    expect(verifier).toContain("tlogThreshold: 1");
    expect(verifier).toContain(
      "published tarball does not match dist.integrity",
    );
    expect(verifier).toContain("dist.attestations.provenance.predicateType");
    expect(verifier).toContain("https://slsa.dev/provenance/v1");
    expect(verifier).toContain("verificationMaterial?.tlogEntries");
    expect(verifier).toContain("https://in-toto.io/Statement/v1");
    expect(verifier).toContain(
      "npm provenance subject does not match the published tarball",
    );
  });
});
