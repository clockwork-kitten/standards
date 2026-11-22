/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

/**
 * This interface was referenced by `CompatibilityBundle`'s JSON-Schema
 * via the `definition` "bundleId".
 */
export type BundleId = string;
/**
 * This interface was referenced by `CompatibilityBundle`'s JSON-Schema
 * via the `definition` "registryUrl".
 */
export type RegistryUrl = string;
/**
 * This interface was referenced by `CompatibilityBundle`'s JSON-Schema
 * via the `definition` "integrity".
 */
export type Integrity = string;
/**
 * This interface was referenced by `CompatibilityBundle`'s JSON-Schema
 * via the `definition` "capabilities".
 */
export type Capabilities = string[];
/**
 * Lowercase SHA-256 of RFC 8785 canonical JSON bytes for the artifact-specific hash input.
 *
 * This interface was referenced by `CompatibilityBundle`'s JSON-Schema
 * via the `definition` "sha256".
 */
export type Sha256 = string;

/**
 * Offline-readable exact compatibility metadata shipped by one Conform release.
 */
export interface CompatibilityBundle {
  schemaVersion: string;
  bundleId: BundleId;
  components: Components;
  schemaMajors: SchemaMajors;
  environment: EnvironmentSupport;
  capabilities: Capabilities;
  resultMajorSupport: ResultMajorSupport;
  extensions?: Extensions;
}
/**
 * This interface was referenced by `CompatibilityBundle`'s JSON-Schema
 * via the `definition` "components".
 */
export interface Components {
  crux: ComponentRecord & {
    componentId?: "crux";
    role?: "policy";
    package?: {
      name?: "@clockwork-kitten/crux";
    };
    verdictProducing?: false;
    manifestHash?: null;
  };
  canon: ComponentRecord & {
    componentId?: "canon";
    role?: "engine";
    package?: {
      name?: "@clockwork-kitten/canon";
    };
    verdictProducing?: true;
    manifestHash?: Sha256;
  };
  crucible: ComponentRecord & {
    componentId?: "crucible";
    role?: "engine";
    package?: {
      name?: "@clockwork-kitten/crucible";
    };
    verdictProducing?: true;
    manifestHash?: Sha256;
  };
  conform: ComponentRecord & {
    componentId?: "conform";
    role?: "orchestrator";
    package?: {
      name?: "@clockwork-kitten/conform";
    };
    verdictProducing?: true;
    manifestHash?: Sha256;
  };
  tools: (ComponentRecord & {
    role?: "tool";
  })[];
}
/**
 * This interface was referenced by `CompatibilityBundle`'s JSON-Schema
 * via the `definition` "componentRecord".
 */
export interface ComponentRecord {
  componentId: string;
  role: "policy" | "engine" | "orchestrator" | "tool";
  package: PackageRecord;
  capabilities: Capabilities;
  verdictProducing: boolean;
  manifestHash: Sha256 | null;
}
/**
 * This interface was referenced by `CompatibilityBundle`'s JSON-Schema
 * via the `definition` "packageRecord".
 */
export interface PackageRecord {
  name: string;
  version: string;
  registryUrl: RegistryUrl;
  integrity: Integrity;
}
/**
 * This interface was referenced by `CompatibilityBundle`'s JSON-Schema
 * via the `definition` "schemaMajors".
 */
export interface SchemaMajors {
  lock: number;
  policy: number;
  result: number;
}
/**
 * This interface was referenced by `CompatibilityBundle`'s JSON-Schema
 * via the `definition` "environmentSupport".
 */
export interface EnvironmentSupport {
  /**
   * @minItems 1
   */
  nodeMajors: [24 | 26, ...(24 | 26)[]];
  /**
   * @minItems 1
   */
  operatingSystems: ["linux" | "darwin", ...("linux" | "darwin")[]];
  /**
   * @minItems 1
   */
  packageManagerLocks: [
    "package-lock.json" | "bun.lock",
    ...("package-lock.json" | "bun.lock")[],
  ];
  verdictRuntime: "node";
}
/**
 * Readers support current and immediately previous result-schema majors for at least one Conform minor release and 90 days, whichever is longer.
 *
 * This interface was referenced by `CompatibilityBundle`'s JSON-Schema
 * via the `definition` "resultMajorSupport".
 */
export interface ResultMajorSupport {
  current: number;
  previous: {
    major: number;
    minimumConformMinorReleases: number;
    minimumDays: number;
  };
}
export interface Extensions {
  [k: string]: unknown;
}
