#!/usr/bin/env python3
"""Validate internal cross-references in a Markdown tree.

Generalized from clockwork-kitten/ops ``scripts/check_links.py`` so any repo can
call it — roots, skip-dirs, and ignore substrings are configurable instead of
being hard-coded to one tree.

Two kinds of reference are checked:

1. Clickable relative markdown links ``](path.md)`` — resolved relative to the
   file they appear in. External ``http(s)://`` and ``mailto:`` links are ignored
   (use an external link checker for those).
2. Backtick root-relative doc paths like ``docs/conventions.md`` — the studio
   convention (CK-003) — resolved from ``--repo-root``.

Exits non-zero and prints every broken reference. Deterministic.
"""
from __future__ import annotations

import argparse
import os
import re
import sys

LINK_RE = re.compile(r"\]\(([^)]+)\)")
BACKTICK_RE = re.compile(r"`([a-zA-Z0-9_][a-zA-Z0-9_./-]*\.md)`")

DEFAULT_SKIP_DIRS = {".git", "node_modules"}


def md_files(roots: list[str], skip_dirs: set[str]) -> list[str]:
    out: list[str] = []
    for root in roots:
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in skip_dirs]
            for name in filenames:
                if name.endswith(".md"):
                    out.append(os.path.join(dirpath, name))
    return sorted(set(out))


def check(
    repo_root: str,
    roots: list[str],
    skip_dirs: set[str],
    ignore_substr: tuple[str, ...],
) -> int:
    problems: list[str] = []
    files = md_files(roots, skip_dirs)
    for path in files:
        rel = os.path.relpath(path, repo_root)
        with open(path, encoding="utf-8") as fh:
            text = fh.read()

        # Clickable links inside inline-code spans are illustrative, not real
        # links. Blank out inline code before scanning for links; backtick refs
        # are scanned on the original text below.
        link_text = re.sub(r"`[^`]*`", lambda mm: " " * len(mm.group(0)), text)
        for m in LINK_RE.finditer(link_text):
            link = m.group(1).split()[0].split("#")[0]
            if not link or link.startswith(("http://", "https://", "mailto:")):
                continue
            if not link.endswith(".md"):
                continue
            target = os.path.normpath(os.path.join(os.path.dirname(path), link))
            if not os.path.exists(target):
                problems.append(f"{rel}: broken link -> {link}")

        for m in BACKTICK_RE.finditer(text):
            ref = m.group(1)
            if any(s in ref for s in ignore_substr):
                continue
            if "/" not in ref:
                # Bare filename in backticks is prose, not a path reference.
                continue
            if not os.path.exists(os.path.join(repo_root, ref)):
                problems.append(f"{rel}: broken root-relative ref -> {ref}")

    if problems:
        sys.stderr.write("Broken references:\n")
        for p in problems:
            sys.stderr.write(f"  {p}\n")
        return 1
    print(f"All references resolve across {len(files)} files.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "roots",
        nargs="*",
        help="Directories to scan for Markdown (default: the repo root).",
    )
    ap.add_argument(
        "--repo-root",
        default=".",
        help="Root that backtick root-relative paths resolve against (default: cwd).",
    )
    ap.add_argument(
        "--skip-dir",
        action="append",
        default=[],
        help="Directory name to skip while walking (repeatable). "
        ".git and node_modules are always skipped.",
    )
    ap.add_argument(
        "--ignore-substr",
        action="append",
        default=[],
        help="Backtick paths containing this substring are treated as external "
        "and not resolved (repeatable).",
    )
    args = ap.parse_args()

    repo_root = os.path.abspath(args.repo_root)
    roots = [os.path.abspath(r) for r in (args.roots or ["."])]
    skip_dirs = DEFAULT_SKIP_DIRS | set(args.skip_dir)
    return check(repo_root, roots, skip_dirs, tuple(args.ignore_substr))


if __name__ == "__main__":
    raise SystemExit(main())
