#!/usr/bin/env python3
"""Render a campaign setup checklist markdown deliverable to a usable Excel workbook.

The checklist document is produced by the pm-setup-checklist skill and contains
sectioned tables whose columns are: ID | Check item | Expected / how to verify |
<entity columns>. This script converts those into per-section worksheets with a
Status column per entity (data-validated dropdown: Done / In Progress / Not Done
/ N/A / Needs Review) plus How to Use, Reference and Summary sheets.

Usage: python3 md_to_checklist_xlsx.py <input.md> <output.xlsx> [title]
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import xlsxwriter

STATUS_VALUES = ["Done", "In Progress", "Not Done", "N/A", "Needs Review"]
SHEET_TITLE_CAP = 31  # Excel sheet name limit


def sanitize_sheet_name(name: str) -> str:
    # Excel forbids []:*?/\ in sheet names.
    return re.sub(r"[\[\]:*?/\\]", " - ", name)[:SHEET_TITLE_CAP]

HEADER_PREFIX = ["ID", "Check item", "Expected / how to verify"]

SHEET_NAMES = {
    "google": "Campaign Checklist — Google",
    "meta": "Campaign Checklist — Meta",
    "adgroup": "Ad Group / Ad Set Checklist",
    "adcreative": "Ad / Creative Checklist",
}

STATUS_COLORS = {
    "Done": "#c6efce",
    "In Progress": "#ffeb9c",
    "Not Done": "#ffc7ce",
    "N/A": "#d9d9d9",
    "Needs Review": "#f4cccc",
}


def clean_cell(value: str) -> str:
    return re.sub(r"[\*`\[\]<>]", "", value).strip()


def is_separator(line: str) -> bool:
    return bool(re.fullmatch(r"\s*[\s|:\-]+\s*", line))


def parse_table(rows: list[str]):
    """Return (header, data_rows) from markdown pipe-table lines."""
    if not rows:
        return [], []
    header = [clean_cell(c) for c in rows[0].strip().strip("|").split("|")]
    if len(header) < 2:
        return [], []
    data = []
    for line in rows[1:]:
        if is_separator(line):
            continue
        cells = [clean_cell(c) for c in line.strip().strip("|").split("|")]
        if not any(cells):
            continue
        data.append(cells)
    return header, data


def looks_like_checklist_table(header) -> bool:
    if len(header) < 3:
        return False
    return [h.lower() for h in header[:3]] == [h.lower() for h in HEADER_PREFIX]


def top_sections(text: str):
    """Split the document into (level, title, body) chunks.

    Only `#` and `##` headings start a new chunk; `###` subsections stay inside
    their parent section's body so the checklist tables can be grouped by them.
    """
    lines = text.split("\n")
    chunks: list[tuple[int, str, list[str]]] = []
    current = None
    for line in lines:
        m = re.match(r"^(#{1,2})\s+(.*)$", line)
        if m:
            if current:
                chunks.append(current)
            current = (len(m.group(1)), m.group(2).strip(), [])
        elif current:
            current[2].append(line)
    if current:
        chunks.append(current)
    return chunks


def find_section(chunks, level: int, title_keyword: str) -> str | None:
    for lvl, title, body in chunks:
        if lvl == level and title_keyword.lower() in title.lower():
            return "\n".join(body)
    return None


def find_checklist_section(chunks, kind: str) -> str | None:
    sheet_title = SHEET_NAMES[kind]
    return find_section(chunks, 2, sheet_title)


def parse_checklist_section(body: str):
    """Return list of (subsection_title, header, rows)."""
    result = []
    current_title = ""
    current_rows: list[str] = []
    for line in body.split("\n"):
        m = re.match(r"^###\s+(.*)$", line)
        if m:
            if current_rows:
                header, data = parse_table(current_rows)
                if looks_like_checklist_table(header):
                    result.append((current_title, header, data))
            current_title = m.group(1).strip()
            current_rows = []
            continue
        if line.strip().startswith("|"):
            current_rows.append(line)
    if current_rows:
        header, data = parse_table(current_rows)
        if looks_like_checklist_table(header):
            result.append((current_title, header, data))
    return result


def write_checklist_sheet(wb, sheet_name: str, sections):
    """Write one checklist section to its own worksheet.

    Returns (status_cols, total_item_rows, status_ranges) for the Summary sheet.
    """
    ws = wb.add_worksheet(sanitize_sheet_name(sheet_name))
    ws.freeze_panes(2, 3)

    header_format = wb.add_format({
        "bold": True, "bg_color": "#1f4e79", "font_color": "#ffffff",
        "border": 1, "text_wrap": True, "valign": "top",
    })
    section_format = wb.add_format({
        "bold": True, "bg_color": "#d9e2f3", "border": 1,
        "text_wrap": True, "valign": "vcenter", "font_color": "#1f4e79",
    })
    id_format = wb.add_format({"border": 1, "valign": "top"})
    item_format = wb.add_format({"border": 1, "text_wrap": True, "valign": "top"})
    expected_format = wb.add_format({"border": 1, "text_wrap": True, "valign": "top", "font_color": "#555555"})
    status_format = wb.add_format({"border": 1, "valign": "top"})

    status_cols: list[int] = []
    status_ranges: list[tuple[int, int, int]] = []
    total_item_rows = 0

    row = 0
    for title, header, data in sections:
        entities = header[3:]
        ws.merge_range(row, 0, row, 2 + 2 * len(entities), title, section_format)
        row += 1
        ws.write(row, 0, "ID", header_format)
        ws.write(row, 1, "Check item", header_format)
        ws.write(row, 2, "Expected / how to verify", header_format)
        col = 3
        for entity in entities:
            ws.write(row, col, entity, header_format)
            ws.write(row, col + 1, f"{entity} — Status", header_format)
            status_cols.append(col + 1)
            col += 2
        row += 1

        first_data_row = row
        for cells in data:
            ws.write(row, 0, cells[0] if len(cells) > 0 else "", id_format)
            ws.write(row, 1, cells[1] if len(cells) > 1 else "", item_format)
            ws.write(row, 2, cells[2] if len(cells) > 2 else "", expected_format)
            for idx, _entity in enumerate(entities):
                value = cells[3 + idx] if len(cells) > 3 + idx else ""
                ws.write(row, 3 + 2 * idx, value, item_format)
                ws.write(row, 4 + 2 * idx, None, status_format)
            row += 1
            total_item_rows += 1
        for sc in status_cols:
            status_ranges.append((sc, first_data_row, row - 1))

    for sc, r1, r2 in status_ranges:
        ws.data_validation(
            r1, sc, r2, sc,
            {"validate": "list", "source": STATUS_VALUES,
             "input_title": "Mark status",
             "input_message": "Choose Done, In Progress, Not Done, N/A or Needs Review."},
        )
        for value, color in STATUS_COLORS.items():
            ws.conditional_format(
                r1, sc, r2, sc,
                {"type": "cell", "criteria": "equal to", "value": f'"{value}"',
                 "format": wb.add_format({"bg_color": color})},
            )

    ws.set_column(0, 0, 12)
    ws.set_column(1, 1, 38)
    ws.set_column(2, 2, 46)
    for sc in status_cols:
        ws.set_column(sc, sc, 16)
    for ec in range(3, 3 + 2 * len(status_cols)):
        if ec not in status_cols:
            ws.set_column(ec, ec, 22)

    return status_cols, total_item_rows, status_ranges


def write_reference_sheet(wb, body: str):
    ws = wb.add_worksheet("Reference")
    header_format = wb.add_format({
        "bold": True, "bg_color": "#1f4e79", "font_color": "#ffffff",
        "border": 1, "text_wrap": True, "valign": "top",
    })
    section_format = wb.add_format({"bold": True, "bg_color": "#d9e2f3", "border": 1, "text_wrap": True})
    cell_format = wb.add_format({"border": 1, "text_wrap": True, "valign": "top"})

    row = 0
    for line in body.split("\n"):
        m = re.match(r"^###\s+(.*)$", line)
        if m:
            ws.merge_range(row, 0, row, 8, m.group(1).strip(), section_format)
            row += 1
            continue
        if not line.strip().startswith("|") or is_separator(line):
            continue
        cells = [clean_cell(c) for c in line.strip().strip("|").split("|")]
        if not any(cells):
            continue
        is_header = cells and cells[0].lower() in ("platform", "id", "name", "section", "campaign", "cluster", "category")
        ws.write_row(row, 0, cells[:9], header_format if is_header else cell_format)
        row += 1

    ws.set_column(0, 8, 24)


def build_how_to_use_sheet(wb, body_lines: list[str], title: str):
    ws = wb.add_worksheet("How to Use")
    ws.set_column(0, 0, 110)
    ws.write(0, 0, title, wb.add_format({"bold": True, "font_size": 12, "font_color": "#1f4e79"}))
    text_format = wb.add_format({"text_wrap": True, "valign": "top"})
    row = 2
    for line in body_lines:
        ws.write(row, 0, line, text_format)
        row += 1
    row += 1
    ws.write(row, 0, "Status values:", wb.add_format({"bold": True, "font_color": "#1f4e79"}))
    row += 1
    for status in STATUS_VALUES:
        ws.write(row, 0, f"• {status}", text_format)
        row += 1


def build_summary_sheet(wb, sheet_info):
    ws = wb.add_worksheet("Summary")
    header = wb.add_format({"bold": True, "bg_color": "#1f4e79", "font_color": "#ffffff", "border": 1})
    bold = wb.add_format({"bold": True})
    ws.write_row(0, 0, ["Section", "Total items"] + STATUS_VALUES + ["Completion %"], header)
    row = 1
    total_items = 0
    for sheet_name, status_cols, item_rows in sheet_info:
        quoted = f"'{sheet_name}'"
        last_row = item_rows + 2
        ws.write(row, 0, sheet_name)
        ws.write(row, 1, item_rows)
        for idx, status in enumerate(STATUS_VALUES):
            col_letter = xlsxwriter.utility.xl_col_to_name(4 + 2 * idx)
            formula_parts = [
                f'COUNTIF({quoted}!{col_letter}3:{col_letter}{last_row},"{status}")'
                for _ in status_cols
            ]
            ws.write_formula(row, 2 + idx, "=" + "+".join(formula_parts))
        ws.write_formula(row, 8, f'=IF(B{row + 1}=0,"",ROUND(C{row + 1}/B{row + 1}*100,0))')
        total_items += item_rows
        row += 1
    ws.write(row, 0, "Total", bold)
    ws.write(row, 1, total_items, bold)
    for idx in range(len(STATUS_VALUES)):
        col_letter = xlsxwriter.utility.xl_col_to_name(2 + idx)
        ws.write_formula(row, 2 + idx, f"=SUM({col_letter}1:{col_letter}{row})", bold)
    ws.set_column(0, 0, 40)
    for idx in range(1, 9):
        ws.set_column(idx, idx, 14)


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: python3 md_to_checklist_xlsx.py <input.md> <output.xlsx> [title]", file=sys.stderr)
        return 2

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    title = sys.argv[3] if len(sys.argv) > 3 else input_path.stem

    text = input_path.read_text(encoding="utf-8")
    chunks = top_sections(text)

    how_body = find_section(chunks, 2, "how to use")
    reference_body = find_section(chunks, 2, "reference")

    wb = xlsxwriter.Workbook(str(output_path))
    build_how_to_use_sheet(wb, how_body.split("\n") if how_body else [], title)

    sheet_info = []
    for kind in SHEET_NAMES:
        body = find_checklist_section(chunks, kind)
        if body is None:
            continue
        sections = parse_checklist_section(body)
        if not sections:
            continue
        sheet_name = sanitize_sheet_name(SHEET_NAMES[kind])
        status_cols, item_rows, _ranges = write_checklist_sheet(wb, sheet_name, sections)
        sheet_info.append((sheet_name, status_cols, item_rows))

    if reference_body:
        write_reference_sheet(wb, reference_body)

    if sheet_info:
        build_summary_sheet(wb, sheet_info)

    wb.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
