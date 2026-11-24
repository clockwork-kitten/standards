import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

import {
  derUtf8String,
  verifyAttestation,
} from "./verify-published-package.mjs";

const require = createRequire(
  new URL("verifier/package.json", import.meta.url),
);
const { TrustedRoot } = require("@sigstore/protobuf-specs");

const FIXTURE_ROOT = new URL(
  "../fixtures/published-provenance/",
  import.meta.url,
);
const ATTESTATION = JSON.parse(
  await readFile(new URL("vite-8.3.8-attestation.json", FIXTURE_ROOT), "utf8"),
);
const METADATA = JSON.parse(
  await readFile(new URL("vite-8.3.8-metadata.json", FIXTURE_ROOT), "utf8"),
);
const TRUSTED_ROOT_JSON = JSON.parse(
  await readFile(new URL("sigstore-trusted-root.json", FIXTURE_ROOT), "utf8"),
);
const TRUSTED_ROOT = TrustedRoot.fromJSON(TRUSTED_ROOT_JSON);

const WORKFLOW_IDENTITY =
  "https://github.com/vitejs/vite/.github/workflows/publish.yml@refs/heads/main";
const VITE_IDENTITY = {
  certificateIdentity: WORKFLOW_IDENTITY,
  certificateIdentityPattern: String.raw`^https://github\.com/vitejs/vite/\.github/workflows/publish\.yml@refs/heads/main$`,
  certificateIssuer: "https://token.actions.githubusercontent.com",
  oidClaims: {
    "1.3.6.1.4.1.57264.1.9": WORKFLOW_IDENTITY,
    "1.3.6.1.4.1.57264.1.11": "github-hosted",
    "1.3.6.1.4.1.57264.1.12": "https://github.com/vitejs/vite",
    "1.3.6.1.4.1.57264.1.14": "refs/heads/main",
    "1.3.6.1.4.1.57264.1.18": WORKFLOW_IDENTITY,
    "1.3.6.1.4.1.57264.1.20": "push",
    "1.3.6.1.4.1.57264.1.23": "Release",
    "1.3.6.1.4.1.57264.1.24": "repo:vitejs/vite:environment:Release",
  },
};

function fixtureOptions(identity = VITE_IDENTITY) {
  return {
    identity,
    integrity: METADATA.dist.integrity,
    packageName: METADATA.name,
    trustedRoot: TRUSTED_ROOT,
    version: METADATA.version,
  };
}

function mutatedIdentity(oid, value) {
  return {
    ...VITE_IDENTITY,
    oidClaims: { ...VITE_IDENTITY.oidClaims, [oid]: value },
  };
}

function mutatePayload(document, mutate) {
  const copy = structuredClone(document);
  const envelope = copy.attestations[0].bundle.dsseEnvelope;
  const statement = JSON.parse(
    Buffer.from(envelope.payload, "base64").toString("utf8"),
  );
  mutate(statement);
  envelope.payload = Buffer.from(JSON.stringify(statement)).toString("base64");
  return copy;
}

test("verifies the captured npm v0.3 provenance and DER identity", async () => {
  const result = await verifyAttestation(ATTESTATION, fixtureOptions());

  assert.equal(
    result.mediaType,
    "application/vnd.dev.sigstore.bundle.v0.3+json",
  );
  assert.equal(result.signerIdentity, WORKFLOW_IDENTITY);
  assert.equal(result.deploymentEnvironment, "Release");
  assert.equal(result.transparencyLogEntries, 1);
  assert.deepEqual(
    derUtf8String("Release"),
    Buffer.from([12, 7, ...Buffer.from("Release")]),
  );
});

for (const [name, oid, value] of [
  ["repository", "1.3.6.1.4.1.57264.1.12", "https://github.com/attacker/vite"],
  [
    "workflow signer",
    "1.3.6.1.4.1.57264.1.9",
    "https://github.com/vitejs/vite/.github/workflows/other.yml@refs/heads/main",
  ],
  ["ref", "1.3.6.1.4.1.57264.1.14", "refs/heads/attacker"],
  ["event", "1.3.6.1.4.1.57264.1.20", "pull_request"],
  ["runner environment", "1.3.6.1.4.1.57264.1.11", "self-hosted"],
  [
    "OIDC subject",
    "1.3.6.1.4.1.57264.1.24",
    "repo:vitejs/vite:environment:Attacker",
  ],
  ["deployment environment", "1.3.6.1.4.1.57264.1.23", "Attacker"],
]) {
  test(`rejects a mismatched ${name} claim`, async () => {
    const identity = mutatedIdentity(oid, value);
    await assert.rejects(
      verifyAttestation(ATTESTATION, fixtureOptions(identity)),
      /invalid certificate extension/,
    );
  });
}

test("rejects a mismatched workflow SAN", async () => {
  await assert.rejects(
    verifyAttestation(
      ATTESTATION,
      fixtureOptions({
        ...VITE_IDENTITY,
        certificateIdentityPattern: "attacker",
      }),
    ),
    /certificate identity error/,
  );
});

test("rejects a mismatched SLSA subject", async () => {
  await assert.rejects(
    verifyAttestation(ATTESTATION, {
      ...fixtureOptions(),
      packageName: "attacker",
    }),
    /provenance subject does not match/,
  );
});

test("rejects a mismatched SLSA digest", async () => {
  await assert.rejects(
    verifyAttestation(ATTESTATION, {
      ...fixtureOptions(),
      integrity: `sha512-${Buffer.alloc(64).toString("base64")}`,
    }),
    /provenance subject does not match/,
  );
});

test("rejects an altered signed SLSA subject", async () => {
  const mutated = mutatePayload(ATTESTATION, (statement) => {
    statement.subject[0].name = "pkg:npm/attacker@8.3.8";
  });
  await assert.rejects(
    verifyAttestation(mutated, fixtureOptions()),
    /DSSE payload hash mismatch/,
  );
});

test("rejects an altered signed SLSA digest", async () => {
  const mutated = mutatePayload(ATTESTATION, (statement) => {
    statement.subject[0].digest.sha512 = "0".repeat(128);
  });
  await assert.rejects(
    verifyAttestation(mutated, fixtureOptions()),
    /DSSE payload hash mismatch/,
  );
});

test("rejects an altered signature", async () => {
  const mutated = structuredClone(ATTESTATION);
  const signature = mutated.attestations[0].bundle.dsseEnvelope.signatures[0];
  const bytes = Buffer.from(signature.sig, "base64");
  bytes[0] ^= 255;
  signature.sig = bytes.toString("base64");
  await assert.rejects(
    verifyAttestation(mutated, fixtureOptions()),
    /timestamp could not be verified|signature verification failed/,
  );
});

test("rejects legacy bundle media types", async () => {
  const mutated = structuredClone(ATTESTATION);
  mutated.attestations[0].bundle.mediaType =
    "application/vnd.dev.sigstore.bundle+json;version=0.2";
  await assert.rejects(
    verifyAttestation(mutated, fixtureOptions()),
    /no Sigstore provenance bundle/,
  );
});

test("rejects missing transparency evidence", async () => {
  const mutated = structuredClone(ATTESTATION);
  mutated.attestations[0].bundle.verificationMaterial.tlogEntries = [];
  await assert.rejects(
    verifyAttestation(mutated, fixtureOptions()),
    /expected 1 tlog entries, got 0/,
  );
});
