# Standards architecture — where a standard lives

How the studio's engineering standards fit together, and the one rule for deciding
where a new standard belongs. The studio invariant (`ops` CK-004):
**AI proposes freely → a machine-checkable standard constrains _how_ → a human still merges.**

## Two tiers, three repos

| Tier | Repo | What it holds | Who reads it |
|------|------|---------------|--------------|
| **Advisory** | [`josephcarey/ai-config`](https://github.com/josephcarey/ai-config) | Prose standards (`layers/personal/standards/*.md`) rendered into the Copilot `code-standards` skill and opencode `AGENTS.md` | **Agents**, at authoring time |
| **Enforcement** | `clockwork-kitten/standards` (this repo) | Reusable CI workflows + the `conform` engine + versioned shared configs | **A machine**, on every PR |
| **Enforcement (a checker)** | [`clockwork-kitten/bedrock`](https://github.com/clockwork-kitten/bedrock) | A JS/TS _semantic normalizer_ — one check the code track invokes (and a standalone tool) | The CI, via the code-conformance track |

Advisory tells an agent **how to write code well**; enforcement is the **ground truth** a
machine checks. Bedrock is **not a third home** — it is a checker under the enforcement tier
(see [Relationships](../README.md#relationships)).

## Where does a new standard go?

1. **Is it machine-checkable?** (formatting, lint, dead-code, repo hygiene, directory shape)
   → Define it **once** in the enforcement tier — a shared config here, or a `bedrock` rule.
   Do **not** also restate it as prose.
2. **Is it judgment an agent needs while writing?** (design heuristics, when to split a function,
   rationale, tradeoffs a linter cannot see) → It belongs in **ai-config** prose.
3. **Both?** Enforcement **owns the definition**; the prose **links to it** and adds only the _why_.

The durable principle: **one rule, one authoritative home.** Prose links; config enforces.
A rule restated in two places is a rule that will drift.

## Keeping the tiers in sync

Today the advisory prose and the enforced code track agree (both center on ESLint, Prettier, and
`knip`). The risk is structural, not a present conflict: the prose **restates the toolchain by
name**, so as the enforcement tier consolidates versioned shared rulesets and wires in `bedrock`
(the `v0.5` track), the two can silently diverge.

The fix is to make the prose **reference the shared config as the source of truth** rather than
enumerate tools — so the advisory tier points at what is actually enforced and cannot drift from it.
Sequence that reconciliation after `v0.5` lands and fixes the canonical code stack.

## See also

- [`README.md`](../README.md) — what this repo publishes and how a repo consumes it
- `ops` `docs/DECISIONS.md` → **CK-004** — the governing decision and rationale
