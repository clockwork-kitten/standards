import { createHash } from "node:crypto";

export type SourceProvenance = {
  artifact: string;
  contentSha256: string;
  repository: string;
  revision: string;
  sourceId: string;
};

export const CONFORM_LEGACY_REVISION =
  "50f290ddce8984ace6f9c7a5e161242f9ee4b0e5";

export const CONFORM_INVENTORY_SOURCE: SourceProvenance = {
  artifact: "packages/conform/inventory/legacy-conform.json",
  contentSha256:
    "3fabef6c3096be1383ac6757ae5721d97ad6fa64d133597268a052aca4ab7288",
  repository: "clockwork-kitten/standards",
  revision: "9ae50e9c1e9f77c018cb476fb0a7aa5e76071d0b",
  sourceId: "conform",
};

type Fetch = (input: string) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

export async function fetchPinnedJson<T>(
  source: SourceProvenance,
  fetchImplementation: Fetch = fetch,
): Promise<T> {
  const url = `https://raw.githubusercontent.com/${source.repository}/${source.revision}/${source.artifact}`;
  const response = await fetchImplementation(url);
  if (!response.ok) {
    throw new Error(
      `Pinned source is unavailable at ${source.repository}@${source.revision}:${source.artifact}: ${response.status}`,
    );
  }
  const content = await response.text();
  const digest = createHash("sha256").update(content).digest("hex");
  if (digest !== source.contentSha256) {
    throw new Error(
      `Pinned source digest mismatch for ${source.sourceId}: expected ${source.contentSha256}, received ${digest}`,
    );
  }
  return JSON.parse(content) as T;
}

export function validateConformSourceDeclaration(
  sources: readonly SourceProvenance[],
): string[] {
  const declarations = sources.filter(
    (source) => source.sourceId === CONFORM_INVENTORY_SOURCE.sourceId,
  );
  if (declarations.length !== 1) {
    return [
      `source provenance count mismatch for conform: expected 1, received ${declarations.length}`,
    ];
  }
  const declaration = declarations[0]!;
  return (
    ["repository", "revision", "artifact", "contentSha256"] as const
  ).flatMap((field) =>
    declaration[field] === CONFORM_INVENTORY_SOURCE[field]
      ? []
      : [
          `source provenance mismatch for conform ${field}: expected ${CONFORM_INVENTORY_SOURCE[field]}, received ${declaration[field]}`,
        ],
  );
}
