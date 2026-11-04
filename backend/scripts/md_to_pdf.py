#!/usr/bin/env python3
"""Render a markdown deliverable to a print-friendly PDF.

Usage: python3 md_to_pdf.py <input.md> <output.pdf> [title]
"""

from __future__ import annotations

import re
import sys
from html import escape
from pathlib import Path

from render_deps import ensure_module

ensure_module("markdown")
ensure_module("weasyprint")

import markdown
from weasyprint import HTML

SEPARATOR_TOKEN = re.compile(r"\|\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$")


def _split_cells(row: str) -> list[str]:
    """Split a pipe-delimited table row into its cell values."""
    stripped = row.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [cell.strip() for cell in stripped.split("|")]


def _is_separator_row(row: str) -> bool:
    """True when the line is a GFM table separator row (|---|...|).

    Empty cells are ignored so malformed separators such as
    ``|---|---|---|---||`` (which split into four dashes plus an empty cell) are
    still recognised.
    """
    if "|" not in row:
        return False
    cells = [cell for cell in _split_cells(row) if cell]
    return len(cells) >= 1 and all(re.fullmatch(r":?-+:?", cell) for cell in cells)


def _separator_for(count: int) -> str:
    return "|" + "|".join("---" for _ in range(count)) + "|"


def _split_merged_separator(line: str) -> list[str]:
    """Split a separator token that is merged onto the header line."""
    match = SEPARATOR_TOKEN.search(line)
    if not match or match.start() == 0:
        return [line]

    head = line[: match.start()].strip()
    token = line[match.start():].strip()
    if head.startswith("|") and len(_split_cells(head)) >= 2 and _is_separator_row(token):
        return [head, token]
    return [line]


def repair_tables(markdown_text: str) -> str:
    """Repair common malformed table layouts before rendering.

    Model outputs often merge the header and the ``|---|`` separator onto a
    single line, emit separators whose column count does not match the header,
    or duplicate separators (e.g. ``|---|---|---|---||`` followed by a proper
    separator). Python-Markdown's tables extension silently refuses to parse a
    table in any of these cases, so the PDF ends up showing the raw pipe syntax
    as text. This normalises each pipe-delimited block: it keeps exactly one
    separator sized to the header row, drops malformed/duplicate separators,
    and guarantees the blank line Python-Markdown needs before a table.
    """
    lines: list[str] = []
    for line in markdown_text.split("\n"):
        lines.extend(_split_merged_separator(line))

    repaired: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip().startswith("|"):
            repaired.append(line)
            i += 1
            continue

        block: list[str] = []
        while i < len(lines) and lines[i].strip().startswith("|"):
            block.append(lines[i])
            i += 1

        if len(block) < 2:
            repaired.extend(block)
            continue

        header = block[0]
        column_count = len(_split_cells(header))
        body = [row for row in block[1:] if not _is_separator_row(row)]

        if repaired and repaired[-1].strip() != "":
            repaired.append("")
        repaired.append(header)
        repaired.append(_separator_for(column_count))
        repaired.extend(body)
        if i < len(lines) and lines[i].strip() != "":
            repaired.append("")

    return "\n".join(repaired)

CSS = """
@page {
    size: A4;
    margin: 18mm 16mm 20mm 16mm;
    @bottom-right {
        content: counter(page) " / " counter(pages);
        font-size: 8.5pt;
        color: #6b7280;
    }
}

html {
    font-size: 10.5pt;
}

body {
    font-family: "DejaVu Sans", Arial, Helvetica, sans-serif;
    color: #1f2937;
    line-height: 1.55;
}

h1, h2, h3, h4, h5, h6 {
    color: #111827;
    line-height: 1.25;
    page-break-after: avoid;
}

h1 {
    font-size: 21pt;
    margin: 0 0 14pt;
    padding-bottom: 6pt;
    border-bottom: 2pt solid #2563eb;
}

h2 {
    font-size: 15.5pt;
    margin: 20pt 0 8pt;
    padding-bottom: 3pt;
    border-bottom: 0.75pt solid #e5e7eb;
}

h3 {
    font-size: 12.5pt;
    margin: 14pt 0 6pt;
}

h4, h5, h6 {
    font-size: 11pt;
    margin: 12pt 0 4pt;
}

p {
    margin: 0 0 7pt;
}

ul, ol {
    margin: 5pt 0 8pt;
    padding-left: 18pt;
}

li {
    margin: 0 0 2pt;
}

table {
    width: 100%;
    max-width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    margin: 8pt 0 12pt;
    font-size: 7.5pt;
}

thead {
    display: table-header-group;
}

tr {
    page-break-inside: avoid;
}

th, td {
    border: 0.6pt solid #d1d5db;
    padding: 4pt 6pt;
    text-align: left;
    vertical-align: top;
    overflow-wrap: break-word;
    word-break: normal;
}

th {
    background: #f3f4f6;
    font-weight: 600;
}

code {
    font-family: "DejaVu Sans Mono", "Courier New", monospace;
    font-size: 8.8pt;
    background: #f3f4f6;
    padding: 1pt 3pt;
    border-radius: 2pt;
}

pre {
    background: #f9fafb;
    border: 0.6pt solid #e5e7eb;
    border-radius: 3pt;
    padding: 7pt 9pt;
    margin: 8pt 0 12pt;
    white-space: pre-wrap;
    word-wrap: break-word;
    page-break-inside: avoid;
}

pre code {
    background: transparent;
    padding: 0;
}

blockquote {
    margin: 8pt 0;
    padding: 2pt 10pt;
    border-left: 3pt solid #93c5fd;
    color: #4b5563;
    page-break-inside: avoid;
}

a {
    color: #2563eb;
    text-decoration: none;
}

img {
    max-width: 100%;
}

hr {
    border: none;
    border-top: 0.6pt solid #e5e7eb;
    margin: 14pt 0;
}

.empty {
    color: #6b7280;
    font-style: italic;
}
"""


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: md_to_pdf.py <input.md> <output.pdf> [title]", file=sys.stderr)
        return 2

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    title = sys.argv[3] if len(sys.argv) > 3 else input_path.stem

    text = input_path.read_text(encoding="utf-8")
    if not text.strip():
        body = '<p class="empty">This deliverable has no content yet.</p>'
    else:
        body = markdown.markdown(
            repair_tables(text),
            extensions=["tables", "fenced_code", "sane_lists", "nl2br", "toc", "attr_list"],
            output_format="html5",
        )

    document = (
        "<!doctype html>"
        '<html lang="en"><head><meta charset="utf-8">'
        f"<title>{escape(title)}</title>"
        f"<style>{CSS}</style>"
        f"</head><body>{body}</body></html>"
    )

    public_dir = Path(__file__).resolve().parent.parent / "public"
    base_url = str(public_dir if public_dir.is_dir() else input_path.parent)

    HTML(string=document, base_url=base_url).write_pdf(str(output_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
