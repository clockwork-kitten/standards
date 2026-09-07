import type { KnipConfig } from "knip";

import base from "@clockwork-kitten/conform/configs/knip.base.json" with { type: "json" };

/**
 * Dogfood + reference pattern: knip has no `extends`, so the studio base is a JSON
 * data file that consumers import and spread from a `knip.ts`.
 *
 * The ignores below are specific to this monorepo, which both *bundles* the code
 * toolchain (as `@clockwork-kitten/conform` dependencies) and calls its bins from
 * root scripts. A normal consumer neither declares those deps nor calls the bins
 * directly (they run `conform check`), so the shared base stays empty.
 */
export default {
  ...base,
  // Root scripts (`lint`, `format`, `deadcode`) call these bins, which are
  // provided transitively by the conform workspace dependency.
  ignoreBinaries: ["eslint", "prettier", "knip"],
  // `prettier` is a bundled bin invoked by the conform code runner, never
  // imported, so knip can't see its use.
  ignoreDependencies: ["prettier"],
  workspaces: {
    ".": {
      // `conform.config.ts` is loaded dynamically by the engine, so knip can't
      // infer it. `eslint.config.js` is only referenced by the eslint bin (which
      // conform bundles, so knip's eslint plugin can't see it here), so name it
      // explicitly too.
      entry: ["conform.config.ts", "eslint.config.js"],
    },
  },
} satisfies KnipConfig;
