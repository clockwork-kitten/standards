import { appendFile } from "node:fs/promises";

const ATTESTATION_MEDIA_TYPE =
  "application/vnd.dev.sigstore.bundle+json;version=0.2";
const PACKAGE_NAME = "@clockwork-kitten/crux";
const PACKAGE_PATH = "@clockwork-kitten%2fcrux";
const PROVENANCE_PREDICATE = "https://slsa.dev/provenance/v1";
const REGISTRY = "https://registry.npmjs.org";
const RETRY_COUNT = 10;
const RETRY_DELAY_MS = 6000;

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

function verifyAttestation(document, version, integrity) {
  const provenance = document.attestations?.find(
    (attestation) => attestation.predicateType === PROVENANCE_PREDICATE,
  );
  if (provenance?.bundle?.mediaType !== ATTESTATION_MEDIA_TYPE) {
    throw new Error(
      "npm attestation response has no Sigstore provenance bundle",
    );
  }

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
  if (
    !Array.isArray(transparencyEntries) ||
    transparencyEntries.length === 0 ||
    !transparencyEntries[0]?.inclusionPromise?.signedEntryTimestamp
  ) {
    throw new Error("npm provenance bundle has no transparency-log inclusion");
  }

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
    statement.predicateType !== PROVENANCE_PREDICATE ||
    subject?.digest?.sha512 !== expectedDigest
  ) {
    throw new Error(
      "npm provenance subject does not match the published tarball",
    );
  }

  return {
    mediaType: provenance.bundle.mediaType,
    predicateType: provenance.predicateType,
    subject: expectedSubject,
    transparencyLogEntries: transparencyEntries.length,
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
  if (predicateType !== PROVENANCE_PREDICATE) {
    throw new Error(`unexpected provenance predicate: ${predicateType}`);
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
      const attestation = verifyAttestation(
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
