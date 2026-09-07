import astro from "eslint-plugin-astro";

/**
 * Studio ESLint — Astro overlay (flat config).
 *
 * Reuse, not rebuild. `eslint-plugin-astro` (+ its `astro-eslint-parser`) covers
 * the generic `.astro` lint surface, and the a11y overlay enforces the studio
 * accessibility standard statically. This file is a thin re-export of the plugin's
 * own flat configs so every site/client repo gets the identical baseline. Both
 * shipped configs self-scope to `*.astro` and wire the parser internally, so the
 * overlay is inert on the `.ts`/`.js` the generic base governs.
 *
 * Layer it AFTER the generic base so the `.astro`-scoped parser wins for template
 * files while the base's TS/unicorn/perfectionist rules keep governing everything
 * else:
 *
 *     import base from "@clockwork-kitten/conform/configs/eslint.base";
 *     import astro from "@clockwork-kitten/conform/configs/eslint.astro";
 *     export default [...base, ...astro];
 *
 * Boundaries. Formatting is owned by `prettier-plugin-astro`
 * (`configs/prettier.astro.json`) and `.astro` type-checking is `astro check`'s job
 * in consumer CI — neither is an ESLint concern. House-policy structural rules
 * (hydration-directive policy, `set:html` sanitizer allowlist, required
 * `Props`/layout conventions) are a separate follow-up (ROADMAP v0.5), authored as
 * custom rules over this same parser.
 *
 * Pinned with `~` in this package because `eslint-plugin-astro` intentionally does
 * not follow ESLint's semver policy — a minor may report new violations.
 */
export default [
  ...astro.configs["flat/recommended"],
  ...astro.configs["flat/jsx-a11y-recommended"],
];
