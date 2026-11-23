/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run `bun run --cwd packages/crux generate:types`.
 */

export type ComponentRecord = {
  [k: string]: unknown;
} & {
  componentId: string;
  role: "policy" | "engine" | "orchestrator" | "tool";
  package: PackageRecord;
  capabilities: Capabilities;
  verdictProducing: boolean;
  manifestHash: string | null;
};
export type Capabilities = string[];

/**
 * Sole resolved-policy authority written by Conform and readable by every engine.
 */
export interface PolicyLock {
  schemaVersion: string;
  bundleId: string;
  policyPackage: PackageRecord & {
    name?: "@clockwork-kitten/crux";
  };
  components: Components;
  schemaMajors: SchemaMajors;
  environment: {
    nodeMajor: 24 | 26;
    operatingSystem: "linux" | "darwin";
    packageManagerLock: "package-lock.json" | "bun.lock";
    verdictRuntime: "node";
  };
  capabilities: Capabilities;
  /**
   * Normalized, repository-relative inputs sorted by inputId before canonical hashing.
   */
  effectivePolicyInputs: {
    inputId: string;
    kind:
      | "base-policy"
      | "repository-policy"
      | "repository-override"
      | "exception-ledger"
      | "repository-config";
    /**
     * Lowercase SHA-256 of RFC 8785 canonical JSON bytes for the artifact-specific hash input.
     */
    contentHash: string;
  }[];
  /**
   * Lowercase SHA-256 of RFC 8785 canonical JSON bytes for the artifact-specific hash input.
   */
  effectivePolicyHash: string;
  repository: {
    profile: string;
    declaredShape: string;
  };
  extensions?: Extensions;
}
export interface PackageRecord {
  name: string;
  version: string;
  registryUrl: string;
  integrity: string;
}
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
    /**
     * Lowercase SHA-256 of RFC 8785 canonical JSON bytes for the artifact-specific hash input.
     */
    manifestHash?: string;
  };
  crucible: ComponentRecord & {
    componentId?: "crucible";
    role?: "engine";
    package?: {
      name?: "@clockwork-kitten/crucible";
    };
    verdictProducing?: true;
    /**
     * Lowercase SHA-256 of RFC 8785 canonical JSON bytes for the artifact-specific hash input.
     */
    manifestHash?: string;
  };
  conform: ComponentRecord & {
    componentId?: "conform";
    role?: "orchestrator";
    package?: {
      name?: "@clockwork-kitten/conform";
    };
    verdictProducing?: true;
    /**
     * Lowercase SHA-256 of RFC 8785 canonical JSON bytes for the artifact-specific hash input.
     */
    manifestHash?: string;
  };
  tools: (ComponentRecord & {
    role?: "tool";
  })[];
}
export interface SchemaMajors {
  lock: number;
  policy: number;
  result: number;
}
export interface Extensions {
  [k: string]: unknown;
}
