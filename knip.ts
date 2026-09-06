import type { KnipConfig } from "knip";

import base from "@clockwork-kitten/conform/configs/knip.base.json" with { type: "json" };

/**
 * Dogfood + reference pattern: knip has no `extends`, so the studio base is a JSON
 * data file that consumers import and spread from a `knip.ts`.
 */
export default {
  ...base,
  workspaces: {
    ".": {
      // `conform.config.ts` is loaded dynamically by the engine, so knip can't
      // infer it. Everything else (bin, exports, eslint/knip config) is auto-detected.
      entry: ["conform.config.ts"],
    },
  },
} satisfies KnipConfig;
