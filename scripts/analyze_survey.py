#!/usr/bin/env python3
"""Generate descriptive Markdown counts from genuine Dukaan2Door survey CSVs."""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from pathlib import Path


def read_responses(path: Path, prefix: str) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        headers = reader.fieldnames or []
        if not headers or not all(header.startswith(prefix) for header in headers):
            raise ValueError(f"{path} must use {prefix} question IDs as headers")
        rows = [
            {key: (value or "").strip() for key, value in row.items()}
            for row in reader
            if any((value or "").strip() for value in row.values())
        ]
    if not rows:
        raise ValueError(f"{path} contains no response rows; findings were not generated")
    return headers, rows


def response_counts(rows: list[dict[str, str]], question: str) -> Counter[str]:
    counts: Counter[str] = Counter()
    for row in rows:
        raw = row.get(question, "")
        for value in (part.strip() for part in raw.split(";")):
            if value:
                counts[value] += 1
    return counts


def section(title: str, headers: list[str], rows: list[dict[str, str]]) -> list[str]:
    lines = [f"## {title}", "", f"Analyzed responses: **{len(rows)}**", ""]
    for question in headers:
        counts = response_counts(rows, question)
        answered = sum(1 for row in rows if row.get(question))
        lines.extend(
            [
                f"### {question}",
                "",
                f"Answered: **{answered}/{len(rows)}**",
                "",
                "| Response | Count | % of analyzed respondents |",
                "|---|---:|---:|",
            ]
        )
        if not counts:
            lines.append("| No answer | 0 | 0.0% |")
        else:
            for value, count in counts.most_common():
                safe_value = value.replace("|", "\\|").replace("\n", " ")
                lines.append(f"| {safe_value} | {count} | {count / len(rows) * 100:.1f}% |")
        lines.append("")
    return lines


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shopkeepers", type=Path, required=True)
    parser.add_argument("--customers", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    try:
        shop_headers, shop_rows = read_responses(args.shopkeepers, "S")
        customer_headers, customer_rows = read_responses(args.customers, "C")
    except (OSError, ValueError) as exc:
        print(f"Survey analysis stopped: {exc}", file=sys.stderr)
        return 2
    lines = [
        "# Dukaan2Door Survey Findings",
        "",
        "> Generated from supplied CSV response rows. Review consent, exclusions,",
        "> free-text privacy, sampling limitations, and themes before publication.",
        "",
    ]
    lines.extend(section("Shopkeeper responses", shop_headers, shop_rows))
    lines.extend(section("Customer responses", customer_headers, customer_rows))
    lines.extend(
        [
            "## Interpretation required",
            "",
            "Add recruitment dates, exclusions, qualitative themes, traceability to product decisions, and limitations using `docs/survey/survey-results-template.md`.",
            "",
        ]
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {args.output} from {len(shop_rows)} shopkeeper and {len(customer_rows)} customer responses")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
