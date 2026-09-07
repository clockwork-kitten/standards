# Standards architecture — where a standard lives

How the studio's engineering standards fit together, and the one rule for deciding
where a new standard belongs. The studio invariant (`ops` CK-004):
**AI proposes freely → a machine-checkable standard constrains _how_ → a human still merges.**

## Two tiers, three repos

| Tier | Repo | What it holds | Who reads it |
|------|------|---------------|--------------|
| **Advisory** | [`josephcarey/ai-config`](https://github.com/josephcarey/ai-config) | Prose standards (`layers/personal/standards/*.md`) rendered into the Copilot `code-standards` skill and opencode `AGENTS.md` | **Agents**, at authoring time |
| **Enforcement** | `clockwork-kitten/standards` (this repo) | Reusable CI workflows + the `conform` engine + versioned shared configs | **A machine**, on every PR |
| **Enforcement (a checker)** | [`clockwork-kitten/bedrock`](https://github.com/clockwork-kitten/bedrock) | A JS/TS *semantic normalizer* — one check the code track invokes (and a standalone tool) | The CI, via the code-conformance track |

Advisory tells an agent **how to write code well**; enforcement is the **ground truth** a
machine checks. Bedrock is **not a third home** — it's a checker under the enforcement tier
(see [Relationships](../README.md#relationships)).

## Where does a new standard go?

1. **Is it machine-checkable?** (formatting, lint, dead-code, repo hygiene, directory shape)
   → Define it **once** in the enforcement tier — a shared config here, or a `bedrock` rule.
   Do **not** also restate it as prose.
2. **Is it judgment an agent needs while writing?** (design heuristics, when to split a function,
   rationale, tradeoffs a linter can't see) → It belongs in **ai-config** prose.
3. **Both?** Enforcement **owns the definition**; the prose **links to it** and adds only the *why*.

The durable principle: **one rule, one authoritative home.** Prose links; config enforces.
A rule restated in two places is a rule that will drift.

## Known drift (as of 2026-09)

- ai-config `10-code-style.md` hard-codes a specific toolchain ("Prettier + ESLint + `knip`") and
  never mentions Biome, while the enforcement tier is consolidating shared rulesets and wiring in
  `bedrock`. **Prose that enumerates tools will drift from the enforced config.** Fix: the prose
  should *reference* the shared config here as the source of truth rather than list tools.
- The code-conformance track — shared Biome/TS/Astro rulesets and `bedrock` wiring — is in progress
  on the `v0.5` branches. Once it lands and fixes the canonical code stack, reconcile the advisory
  prose to point at it.

## See also

- [`README.md`](../README.md) — what this repo publishes and how a repo consumes it
- `ops` `docs/DECISIONS.md` → **CK-004** — the governing decision and rationale
