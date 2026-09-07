import depend from "eslint-plugin-depend";
import perfectionist from "eslint-plugin-perfectionist";
import security from "eslint-plugin-security";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Studio ESLint base — flat config.
 *
 * Thin by design. Prettier owns formatting, and `clockwork-kitten/bedrock` will own
 * semantic normalization (`var`→`const`, `==`→`===`, arrow/function form,
 * `.push`→spread). This layer adds what those two do not: framework-agnostic
 * correctness (`typescript-eslint` + `unicorn`), deterministic ordering
 * (`perfectionist`), security anti-patterns (`security`), and dependency hygiene
 * (`depend`). Framework rulesets (Svelte, Astro) layer on top of this base.
 *
 * Interim: because bedrock is not yet wired into the engine, a few of its canonical
 * rules are duplicated here and must be removed when it is (see the rules block and
 * ROADMAP v0.5 row 3).
 *
 * Consumers extend it from their own `eslint.config.js`:
 *
 *     import base from "@clockwork-kitten/conform/configs/eslint.base";
 *     export default [...base, { rules: { ... } }];
 */
export default tseslint.config(
  { ignores: ["**/dist/**", "**/build/**", "**/coverage/**", "**/*.d.ts"] },
  // Anchor file enumeration so `eslint .` picks up TypeScript, not just `.js`.
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"] },
  ...tseslint.configs.recommended,
  unicorn.configs.recommended,
  security.configs.recommended,
  depend.configs["flat/recommended"],
  perfectionist.configs["recommended-natural"],
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // --- Interim duplication of `clockwork-kitten/bedrock` ---------------------
      // bedrock is the long-term owner of semantic normalization, but it is not yet
      // wired into the engine (v0.5 row 3). Until it is, enforce its canonical forms
      // here so nothing regresses. REMOVE these four when bedrock is invoked, to
      // avoid double-ownership (tracked in ROADMAP v0.5 row 3).
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-arrow-callback": "error",
      "prefer-const": "error",

      // Heuristic taint rules that false-positive on nearly every file-system and
      // dynamic-key access — noise for a tool that reads/writes files by computed
      // path. The real wins (eval, child_process, unsafe regex) stay enabled.
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-object-injection": "off",

      // One canonical case for the files this base governs: kebab-case `.ts`/`.js`.
      // The Svelte/Astro rulesets (follow-up) enforce PascalCase for their component
      // files, where they add the matching parsers.
      "unicorn/filename-case": ["error", { case: "kebabCase" }],

      // The codebase already uses one consistent named-import style; this rule would
      // impose a different per-module opinion. Off — no consistency gained.
      "unicorn/import-style": "off",

      // Vocabulary/abbreviation policy is intrusive house-style, not
      // machine-checkable correctness — don't dictate word choice.
      "unicorn/name-replacements": "off",
      // A bin entry that also exports its parsers for unit tests is a deliberate,
      // good pattern here — not a violation.
      "unicorn/no-exports-in-scripts": "off",

      // Prettier owns ternary formatting; this rule fights it in an infinite fix loop.
      "unicorn/no-nested-ternary": "off",

      // Fights the standard Vitest `beforeEach` setup pattern.
      "unicorn/no-top-level-assignment-in-function": "off",

      // Rewrites the CLI's `else if` argument dispatchers into a `switch` inside
      // the parse loop, which then trips `no-break-in-nested-loop` — the two
      // rules fight and mangle the code. `else if` chains are the house style
      // for these small parsers.
      "unicorn/prefer-switch": "off",

      // Vocabulary/abbreviation policy — see `name-replacements` above.
      "unicorn/prevent-abbreviations": "off",

      // A comparator on every string sort is boilerplate. (`no-array-sort` stays on —
      // always `.toSorted()`; `no-null` stays on — always `undefined`.)
      "unicorn/require-array-sort-compare": "off",

      // Comment shape is formatting the studio delegates to Prettier and judgement.
      "unicorn/single-line-block-comment-style": "off",
    },
  },
);
