import depend from "eslint-plugin-depend";
import perfectionist from "eslint-plugin-perfectionist";
import security from "eslint-plugin-security";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Studio ESLint base — flat config.
 *
 * Thin by design. Prettier owns formatting, and `clockwork-kitten/bedrock` owns
 * semantic normalization (`var`→`const`, `==`→`===`, arrow/function form,
 * `.push`→spread). This layer only adds what those two do not: framework-agnostic
 * correctness (`typescript-eslint` + `unicorn`), import/export ordering
 * (`perfectionist`), security anti-patterns (`security`), and dependency hygiene
 * (`depend`). Framework rulesets (Svelte, Astro) layer on top of this base.
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
      eqeqeq: "off",
      // Owned by bedrock's semantic normalizer — don't double-own here.
      "no-var": "off",
      "prefer-arrow-callback": "off",

      // Heuristic taint rules that false-positive on nearly every file-system and
      // dynamic-key access — pure noise for a tool that reads/writes files by
      // computed path. The real security wins (eval, child_process, unsafe regex)
      // stay enabled.
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-object-injection": "off",

      // Allow kebab-case (`.ts` modules) and PascalCase (Svelte/Astro components);
      // reject the camelCase outlier so filenames stay consistent studio-wide.
      "unicorn/filename-case": [
        "error",
        { cases: { kebabCase: true, pascalCase: true } },
      ],
      "unicorn/import-style": "off",
      "unicorn/name-replacements": "off",

      // A bin entry that also exports its parsers for unit tests is a deliberate,
      // good pattern here — not a violation.
      "unicorn/no-exports-in-scripts": "off",

      "unicorn/no-nested-ternary": "off",
      "unicorn/no-top-level-assignment-in-function": "off",

      // Vocabulary is intrusive house-style, not machine-checkable correctness —
      // off so the config stays thin and doesn't dictate word choice.
      "unicorn/prevent-abbreviations": "off",

      // A comparator on every string sort is boilerplate, and
      // `no-top-level-assignment-in-function` fights the standard Vitest
      // `beforeEach` setup pattern. (`no-array-sort` stays on — always `.toSorted()`;
      // `no-null` stays on — always `undefined`.)
      "unicorn/require-array-sort-compare": "off",
      // Comment/import shape is formatting the studio delegates to Prettier and
      // author judgement, not a correctness gate. `no-nested-ternary` conflicts
      // directly with Prettier's ternary formatting — Prettier owns it.
      "unicorn/single-line-block-comment-style": "off",
    },
  },
);
