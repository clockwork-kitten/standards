import { createHash } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(
  new URL("verifier/package.json", import.meta.url),
);
const { verify } = require("sigstore");

const ATTESTATION_MEDIA_TYPE =
  "application/vnd.dev.sigstore.bundle+json;version=0.2";
const CERTIFICATE_IDENTITY =
  "https://github.com/clockwork-kitten/standards/.github/workflows/publish-crux.yml@refs/heads/main";
const CERTIFICATE_IDENTITY_PATTERN = String.raw`^https://github\.com/clockwork-kitten/standards/\.github/workflows/publish-crux\.yml@refs/heads/main$`;
const CERTIFICATE_ISSUER = "https://token.actions.githubusercontent.com";
const CERTIFICATE_OIDS = {
  "1.3.6.1.4.1.57264.1.9": CERTIFICATE_IDENTITY,
  "1.3.6.1.4.1.57264.1.11": "github-hosted",
  "1.3.6.1.4.1.57264.1.12": "https://github.com/clockwork-kitten/standards",
  "1.3.6.1.4.1.57264.1.14": "refs/heads/main",
  "1.3.6.1.4.1.57264.1.18": CERTIFICATE_IDENTITY,
  "1.3.6.1.4.1.57264.1.20": "workflow_dispatch",
  "1.3.6.1.4.1.57264.1.23": "crux-npm",
  "1.3.6.1.4.1.57264.1.24":
    "repo:clockwork-kitten/standards:environment:crux-npm",
};
const PACKAGE_NAME = "@clockwork-kitten/crux";
const PACKAGE_PATH = "@clockwork-kitten%2fcrux";
const PROVENANCE_PREDICATE = "https://slsa.dev/provenance/v1";
const REGISTRY = "https://registry.npmjs.org";
const RETRY_COUNT = 10;
const RETRY_DELAY_MS = 6000;

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

function requireNonEmpty(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`registry metadata is missing ${field}`);
  }
  return value;
}

async function verifyAttestation(document, version, integrity) {
  const provenance = document.attestations?.find(
    (attestation) => attestation.predicateType === PROVENANCE_PREDICATE,
  );
  if (provenance?.bundle?.mediaType !== ATTESTATION_MEDIA_TYPE) {
    throw new Error(
      "npm attestation response has no Sigstore provenance bundle",
    );
  }

  const signer = await verify(provenance.bundle, {
    certificateIdentityURI: CERTIFICATE_IDENTITY_PATTERN,
    certificateIssuer: CERTIFICATE_ISSUER,
    certificateOIDs: CERTIFICATE_OIDS,
    ctLogThreshold: 1,
    tlogThreshold: 1,
  });

  const envelope = provenance.bundle.dsseEnvelope;
  if (
    envelope?.payloadType !== "application/vnd.in-toto+json" ||
    !Array.isArray(envelope.signatures) ||
    envelope.signatures.length === 0
  ) {
    throw new Error("npm provenance bundle has no signed in-toto envelope");
  }
  const transparencyEntries =
    provenance.bundle.verificationMaterial?.tlogEntries;

  const statement = JSON.parse(
    Buffer.from(envelope.payload, "base64").toString("utf8"),
  );
  const expectedSubject = `pkg:npm/%40clockwork-kitten/crux@${version}`;
  const expectedDigest = Buffer.from(
    integrity.slice("sha512-".length),
    "base64",
  ).toString("hex");
  const subject = statement.subject?.find(
    (candidate) => candidate.name === expectedSubject,
  );
  if (
    statement._type !== "https://in-toto.io/Statement/v1" ||
    statement.predicateType !== PROVENANCE_PREDICATE ||
    subject?.digest?.sha512 !== expectedDigest
  ) {
    throw new Error(
      "npm provenance subject does not match the published tarball",
    );
  }

  return {
    certificateIdentity: CERTIFICATE_IDENTITY,
    certificateIssuer: CERTIFICATE_ISSUER,
    deploymentEnvironment: CERTIFICATE_OIDS["1.3.6.1.4.1.57264.1.23"],
    mediaType: provenance.bundle.mediaType,
    predicateType: provenance.predicateType,
    signerIdentity: signer.identity?.subjectAlternativeName,
    subject: expectedSubject,
    transparencyLogEntries: transparencyEntries?.length ?? 0,
  };
}

function verifyMetadata(metadata, version) {
  if (metadata.name !== PACKAGE_NAME || metadata.version !== version) {
    throw new Error(
      "registry metadata does not identify the exact package version",
    );
  }

  const tarball = requireNonEmpty(metadata.dist?.tarball, "dist.tarball");
  const integrity = requireNonEmpty(metadata.dist?.integrity, "dist.integrity");
  const attestationUrl = requireNonEmpty(
    metadata.dist?.attestations?.url,
    "dist.attestations.url",
  );
  const predicateType = requireNonEmpty(
    metadata.dist?.attestations?.provenance?.predicateType,
    "dist.attestations.provenance.predicateType",
  );
  const expectedAttestationUrl = `${REGISTRY}/-/npm/v1/attestations/${PACKAGE_PATH}@${version}`;

  if (attestationUrl !== expectedAttestationUrl) {
    throw new Error(`unexpected npm attestation URL: ${attestationUrl}`);
  }
  const expectedTarball = `${REGISTRY}/@clockwork-kitten/crux/-/crux-${version}.tgz`;
  if (tarball !== expectedTarball) {
    throw new Error(`unexpected npm tarball URL: ${tarball}`);
  }
  if (predicateType !== PROVENANCE_PREDICATE) {
    throw new Error(`unexpected provenance predicate: ${predicateType}`);
  }
  if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(integrity)) {
    throw new Error("dist.integrity is not a single sha512 digest");
  }

  return { attestationUrl, integrity, predicateType, tarball };
}

async function verifyPublishedPackage(version) {
  const metadataUrl = `${REGISTRY}/${PACKAGE_PATH}/${version}`;
  let lastError;

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt += 1) {
    try {
      const metadata = await fetchJson(metadataUrl);
      const fields = verifyMetadata(metadata, version);
      const tarballBytes = await fetchBytes(fields.tarball);
      const actualIntegrity = `sha512-${createHash("sha512")
        .update(tarballBytes)
        .digest("base64")}`;
      if (actualIntegrity !== fields.integrity) {
        throw new Error("published tarball does not match dist.integrity");
      }
      const attestation = await verifyAttestation(
        await fetchJson(fields.attestationUrl),
        version,
        fields.integrity,
      );
      return { attestation, metadataUrl, version, ...fields };
    } catch (error) {
      lastError = error;
      console.error(`verification attempt ${attempt}/${RETRY_COUNT}:`, error);
      if (attempt < RETRY_COUNT) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw new Error("published package failed registry verification", {
    cause: lastError,
  });
}

const version = process.argv[2];
if (!version) {
  throw new Error("usage: verify-published-package.mjs <version>");
}

const evidence = await verifyPublishedPackage(version);
const output = JSON.stringify(evidence, undefined, 2);
console.log(output);

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    [
      "## Verified published Crux",
      "",
      `- npm: https://www.npmjs.com/package/${PACKAGE_NAME}/v/${version}`,
      `- Registry metadata: ${evidence.metadataUrl}`,
      `- Tarball: ${evidence.tarball}`,
      `- Attestations: ${evidence.attestationUrl}`,
      "",
      "```json",
      output,
      "```",
      "",
    ].join("\n"),
  );
}
