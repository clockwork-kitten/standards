import { applyFixes } from "markdownlint";
import { lint } from "markdownlint/promise";
import type { LintError, LintResults } from "markdownlint";
import type { MarkdownlintConfig } from "../config/types.ts";

/** A single markdown-lint finding, flattened for reporting. */
export type LintIssue = {
	/** File path or, for string linting, the provided name. */
	file: string;
	/** 1-based line number. */
	line: number;
	/** Rule identifier, e.g. `MD041/first-line-heading`. */
	rule: string;
	/** Human-readable rule description. */
	description: string;
	/** Extra detail about this occurrence, when the rule provides it. */
	detail: string | undefined;
};

function collectIssues(results: LintResults): LintIssue[] {
	const issues: LintIssue[] = [];
	for (const [file, errors] of Object.entries(results)) {
		for (const error of errors as LintError[]) {
			issues.push({
				file,
				line: error.lineNumber,
				rule: error.ruleNames.slice(0, 2).join("/"),
				description: error.ruleDescription,
				detail: error.errorDetail || undefined,
			});
		}
	}
	return issues.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
}

/**
 * Lint the given files against a resolved markdownlint config. Returns a flat,
 * sorted list of findings (empty means conformant).
 */
export async function lintFiles(files: string[], config: MarkdownlintConfig): Promise<LintIssue[]> {
	if (files.length === 0) {
		return [];
	}
	const results = await lint({ files, config });
	return collectIssues(results);
}

/**
 * Lint in-memory named contents against a resolved markdownlint config. Same
 * result shape as {@link lintFiles}; used for tests and future piped input.
 */
export async function lintContent(
	contents: Record<string, string>,
	config: MarkdownlintConfig,
): Promise<LintIssue[]> {
	const results = await lint({ strings: contents, config });
	return collectIssues(results);
}

/**
 * Render lint issues as a readable multi-line report. Returns an empty string
 * when there are no issues.
 */
export function formatIssues(issues: LintIssue[]): string {
	return issues
		.map((issue) => {
			const detail = issue.detail ? ` [${issue.detail}]` : "";
			return `${issue.file}:${issue.line} ${issue.rule} ${issue.description}${detail}`;
		})
		.join("\n");
}

/** The outcome of autofixing a single document. */
export type FixResult = {
	/** File path or, for string fixing, the provided name. */
	file: string;
	/** The document content after applying every fixable rule. */
	content: string;
	/** Whether applying fixes changed the content. */
	changed: boolean;
	/**
	 * Issues that remain after fixing — rules with no autofix, or fixes that did
	 * not fully resolve. Computed by re-linting the fixed content, so it reflects
	 * what a subsequent `conform check` would still report.
	 */
	residue: LintIssue[];
};

/**
 * Autofix named in-memory documents against a resolved markdownlint config.
 *
 * Each document is linted, then markdownlint's {@link applyFixes} rewrites it
 * using every error's `fixInfo` (rules without `fixInfo` are left untouched).
 * The fixed content is re-linted so `residue` honestly reports what still fails
 * — `fix` self-heals what it can and leaves `check` as the failing gate. Pure:
 * IO lives in the CLI, mirroring the `llms` generator.
 */
export async function fixContents(
	contents: Record<string, string>,
	config: MarkdownlintConfig,
): Promise<FixResult[]> {
	const names = Object.keys(contents);
	if (names.length === 0) {
		return [];
	}
	const results = await lint({ strings: contents, config });
	const fixed: Record<string, string> = {};
	for (const name of names) {
		const original = contents[name] as string;
		const errors = (results[name] ?? []) as LintError[];
		fixed[name] = applyFixes(original, errors);
	}
	const residueResults = await lint({ strings: fixed, config });
	return names.map((name) => ({
		file: name,
		content: fixed[name] as string,
		changed: fixed[name] !== contents[name],
		residue: collectIssues({ [name]: residueResults[name] ?? [] } as LintResults),
	}));
}
