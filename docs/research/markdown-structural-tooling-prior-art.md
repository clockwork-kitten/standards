# Prior art — Deterministic structural tools for conformant Markdown

*Prior-art scan for the `IDEAS.md` entry "Deterministic structural tools for conformant Markdown". Compiled 2026-09-04 by a read-only research session (`josephcarey-scaling-carnival`); preserved here verbatim.*

## Executive summary

**Recommendation: BUILD (thin), on top of an EXISTING parser — do not build a parser, do not adopt a whole product.**

The single strongest reason: **the novel, defensible part of this idea is not the editing — it's the coupling of a repo-specific conformance schema (`## I-NNN` shape, monotonic IDs, one separator) to typed splice operations that re-lint as a postcondition.** No existing tool combines *your* schema-as-precondition with deterministic entry-level operations. The generic "edit Markdown by AST/section" problem is thoroughly solved (remark/mdast, tree-sitter, ADR CLIs, MCP editors) and should be **reused, not rebuilt** — but none of them know or enforce your entry model. So: adopt `mdast` (or `markdownlint` custom rules you'll already own from v0.1) as the substrate; build a small typed-operation layer as the differentiator.

Secondary point: **sequence this strictly after v0.1.** The whole safety argument collapses without the lint that guarantees the invariants. The operations are only "deterministic" because the precondition holds.

## Prior-art landscape

### Closest analog — agent-safe structured Markdown editors (MCP)

- **SafeMarkdownEditor / MCP "section editor" servers** — expose `insert_section`, `update_section`, `delete_section`, `move_section`, `list_sections` as atomic, validated, undoable operations keyed by stable section IDs, explicitly for AI agents. This is conceptually *the same move you're proposing* — typed operations instead of string-matching — and validates the direction. **Gaps:** (1) they operate on generic heading/section structure, not a **domain schema** (`I-NNN` entries, monotonic IDs, separator normalization, renumber/reflow); (2) they're general document editors, not a conformance-gated CLI; (3) maturity/health is unproven — the referenced repo (`raphaelmansuy/quantalogic-markdown-edit-mcp`) returned 404 on direct fetch, so treat directory listings as unverified. Sources: <https://lobehub.com/mcp/raphaelmansuy-quantalogic-markdown-edit-mcp> , <https://modelcontextprotocol.io/> . **Verdict: inspiration for the operation surface (esp. stable IDs + atomicity + re-validate), not adoptable as-is.**

- **ADR CLIs — `adr-tools` (npryce), `dotnet-adr`, `log4brains`** — the *most direct precedent for schema-aware entry operations on Markdown*: `adr new` (sequential numbered file + fixed template), `adr link`, `adr generate toc`, superseding relationships. This is essentially "typed entry operations" for one document type. **Gaps:** one-entry-per-file (not many entries in one `IDEAS.md`), no `move`/`renumber`/reflow, no re-lint postcondition, bash-based and unmaintained (`adr-tools` is effectively dormant). MIT. Sources: <https://github.com/npryce/adr-tools> , <https://adr.github.io/adr-tooling/> . **Verdict: strong conceptual precedent (the studio's `CK-NNN`/`I-NNN` model is ADR-shaped); inspiration-only.**

### Reusable building blocks (the substrate to build ON)

- **unified / remark / `mdast` + `mdast-util-to-markdown` / `unist-util-visit`** — the mature, MIT-licensed standard for Markdown-as-AST: parse → transform nodes → stringify. `mdast` is a documented spec, `remark-gfm` covers tables. This is the natural engine for schema-aware splices in a TS/Bun studio. **Cost/risk:** stringify is **not byte-preserving** — a full parse→stringify round-trip reformats the *whole* file (bullet styles, emphasis, wrapping), so you must either (a) accept remark as the canonical formatter, or (b) do **minimal/positional splicing** (edit only the byte range of the target entry, leave the rest untouched). Sources: <https://github.com/syntax-tree/mdast> , <https://unifiedjs.com/> , <https://github.com/syntax-tree/mdast-util-to-markdown> .

- **`markdownlint` custom rules (DavidAnson)** — you will already own a markdownlint config for v0.1. Custom rules (JS) can encode the entry-shape invariants, and markdownlint doubles as the **re-lint postcondition** the idea depends on. MIT. Source: <https://github.com/DavidAnson/markdownlint/blob/main/doc/CustomRules.md> . **This is likely your cheapest precondition/postcondition engine — the schema you write for v0.1 is reused verbatim by the operations.**

- **`remark-lint-frontmatter-schema` (JSON Schema over YAML front-matter)** — proves the "schema-constrained Markdown" pattern, but only for front-matter, not body structure. If per-file schemas were expressed partly as front-matter (doc `type: ideas`), this is a ready validator. MIT/ISC. Source: <https://codeberg.org/JulianCataldo/remark-lint-frontmatter-schema> .

- **`tree-sitter-markdown`** — incremental, concrete-syntax AST; good for editors, but its issue tracker shows recurring whitespace/table/blockquote edge-case bugs; heavier than mdast for a CLI. Source: <https://github.com/tree-sitter-grammars/tree-sitter-markdown/issues> . **Verdict: overkill vs mdast for batch CLI splices.**

### Adjacent-but-different (knowledge-base structured blocks)

- **Org-mode (`org-capture`/`org-refile`)** — the gold standard for *typed capture + structural refile/move/promote* on outline nodes. Directly analogous to `entry add`/`entry move`, but Emacs-Lisp-bound and heading-tree-centric, not a portable CI-callable checker. Inspiration for the operation vocabulary. Source: <https://orgmode.org/> .
- **Logseq (block-centric), Dendron (dot-hierarchy schemas + refactor API), Obsidian (block-refs via plugins), Notion (block model)** — all model documents as typed/structured blocks with programmatic ops, but all are **app-embedded**, not standalone conformance CLIs, and none re-lint against a repo schema. Inspiration-only. Sources: <https://docs.logseq.com/> , <https://wiki.dendron.so/> .
- **`schema-markdown`, "Database Modeling Markdown", Schema.md** — "typed Markdown" for *data/schema documentation*, not for structurally editing governance docs. Different problem. Sources: <https://github.com/craigahobbs/schema-markdown> , <https://schema.md/> .

### Standards worth knowing

- **CommonMark** (<https://commonmark.org/>) and **GFM** (<https://github.github.com/gfm/>) — parsing baseline; pin one, since ambiguous Markdown parses differently across tools and breaks determinism.
- **unist / mdast** (<https://github.com/syntax-tree/unist> , <https://github.com/syntax-tree/mdast>) — the de-facto AST contract; nodes carry `position` offsets, which is exactly what minimal positional splicing needs.
- **`llms.txt`** (<https://llmstxt.org/>) — a *convention* (H1 + blockquote + `##` sections of link bullets), not a schema language. Relevant precedent that "tightly-shaped Markdown is machine-consumable," but it defines no operations. The studio's `ops` repo already generates `llms.txt` — the same generation discipline (deterministic emit from structure) applies here.
- **No mainstream "schema language for Markdown *body* structure" exists.** JSON Schema/YAML validate front-matter; body-shape constraints are hand-rolled (markdownlint custom rules, ad-hoc parsers). This absence is precisely the gap the idea fills.

## Pitfalls to avoid

- **Round-trip reformatting (the #1 trap).** A naive `parse → mutate → stringify` rewrites the *entire* file, producing huge diffs and violating "surgical edit." Mitigation: use `position` offsets to splice only the target entry's byte range, or declare remark/prettier the canonical formatter so any reflow is expected and idempotent. Evidence: <https://github.com/multica-ai/multica/issues/3765> (round-trip accumulates blank lines).
- **Non-idempotent formatting.** Formatters can oscillate on edge cases (HTML comments in lists, table padding), so `op` then `lint --fix` never converges. Test idempotency explicitly (apply twice, diff must be empty). Evidence: <https://github.com/oxc-project/oxc/issues/21314> .
- **Comment/whitespace/HTML-comment loss.** Anchors like `<!-- I-014 -->` or intentional blank lines get normalized away; preserve them deliberately.
- **Parser divergence = non-determinism.** If the lint parser and the operation parser differ (or differ in GFM options), an op can "pass" its own parse yet fail the lint. **Share one parser + one schema config between linter and tools** (your Open Question #1 — the answer is: yes, single source, or they *will* drift).
- **Renumber is a referential-integrity problem, not a text problem.** Renumbering `I-NNN` breaks any cross-references (`see I-014`, links, `ops` DECISIONS mentions). Decide up front whether IDs are stable-forever (never reuse/renumber) or renumberable-with-rewrite. ADR practice favors **immutable, monotonic, never-reused** IDs — cheaper and safer.
- **Concurrent edits / partial writes.** Agents editing in parallel need atomic write + re-lint-or-rollback (the MCP editors' atomicity model is the reference).

## Recommendation framing (three viable directions)

1. **Extend markdownlint (lightest, best v0.1 continuity).** Encode entry schemas as markdownlint custom rules (you own these anyway), and build tiny CLI ops that do positional splices then invoke the *same* rules as postcondition. Tradeoff: markdownlint's model is line/token-oriented, so complex `move`/`renumber` logic lives in your own splice code, not the linter. Lowest new surface; maximal reuse; schema can't drift because it's literally the lint.

2. **Build on `mdast` (most capable, most idiomatic for the TS/Bun stack).** Rich AST with `position` offsets makes `add`/`move`/`renumber` clean; re-lint via remark-lint or by re-running the markdownlint rules. Tradeoff: must actively prevent whole-file round-trip reformatting (positional splice discipline). Best if operations will grow beyond delete/add.

3. **Adopt/extend an MCP structured-editor + ADR conventions (least custom code, most external risk).** Wrap an existing section-editor MCP and layer ID/renumber rules on top. Tradeoff: those tools are generic (no `I-NNN` schema), unproven maintenance/health (repo 404'd), and you'd fork rather than reuse — likely more integration cost than direction 1 or 2 for less control.

**Framing for the coordinator/human:** the *editing engine* is a solved, reusable commodity (pick mdast or your own markdownlint rules); the *typed-schema-as-precondition-and-postcondition* is the studio's original contribution and the reason it belongs in `standards`, gated behind v0.1. Directions 1 and 2 are the realistic finalists; the choice is "reuse the lint I already own" (1) vs "get a real AST for richer ops" (2).

## References

- mdast spec — <https://github.com/syntax-tree/mdast>
- unified/remark — <https://unifiedjs.com/> · <https://github.com/syntax-tree/mdast-util-to-markdown>
- markdownlint custom rules — <https://github.com/DavidAnson/markdownlint/blob/main/doc/CustomRules.md>
- remark-lint-frontmatter-schema — <https://codeberg.org/JulianCataldo/remark-lint-frontmatter-schema>
- tree-sitter-markdown issues — <https://github.com/tree-sitter-grammars/tree-sitter-markdown/issues>
- adr-tools — <https://github.com/npryce/adr-tools> · tooling survey <https://adr.github.io/adr-tooling/>
- MCP — <https://modelcontextprotocol.io/> · SafeMarkdownEditor listing (unverified) <https://lobehub.com/mcp/raphaelmansuy-quantalogic-markdown-edit-mcp>
- Org-mode — <https://orgmode.org/> · Dendron — <https://wiki.dendron.so/> · Logseq — <https://docs.logseq.com/>
- CommonMark — <https://commonmark.org/> · GFM — <https://github.github.com/gfm/> · unist — <https://github.com/syntax-tree/unist>
- llms.txt — <https://llmstxt.org/>
- Round-trip/idempotency evidence — <https://github.com/multica-ai/multica/issues/3765> · <https://github.com/oxc-project/oxc/issues/21314>
