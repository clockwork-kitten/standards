import { defineConfig } from "@clockwork-kitten/conform";

// Conform is the orchestrator: docs are delegated to canon and configured in
// canon.config.ts, while this config only opts the repo into the code track.
export default defineConfig({
  // The code-conformance track: `conform check` runs ESLint + Prettier + knip +
  // the TypeScript typecheck, and `conform fix` runs the ESLint/Prettier
  // autofixers. The engine's TypeScript lives in the workspace package, so point
  // the typecheck at that tsconfig rather than a (nonexistent) root one.
  code: {
    tsconfig: "packages/conform/tsconfig.json",
  },
});
