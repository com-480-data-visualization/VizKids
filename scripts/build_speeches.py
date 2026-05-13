"""Shard data/un-general-debates.csv into per-country JSON files.

The raw CSV is ~129 MB and unsuitable for the browser. After this script runs,
each country has its own ~few-hundred-KB JSON at data/speeches/{ISO3}.json,
lazy-loaded by the Speech Reader only when the user clicks that country.

The text column comes from OCR'd PDFs: it has a leading BOM and hard newlines
mid-sentence. The script reflows newlines, re-paragraphs the text into ~80-word
chunks at sentence boundaries, and stores each paragraph as a string in a list.

Usage:
    /home/giovanni/miniconda3/envs/ssdp/bin/python scripts/build_speeches.py

Output file shape:
{
    "iso3": "USA",
    "years": [1970, 1971, ...],
    "speeches": {
        "YYYY": {
            "word_count": int,
            "paragraphs": [str, str, ...]
        },
        ...
    }
}
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "un-general-debates.csv"
OUT_DIR = ROOT / "data" / "speeches"

BOM = "﻿"
# Sentence split: ".", "!", or "?" followed by whitespace then a capital letter.
# Imperfect — it splits on "U.S." style abbreviations too — but for our display
# purposes it's good enough and avoids pulling in an NLP dependency.
SENT_BOUNDARY_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"'])")
PARA_TARGET_WORDS = 80


def clean_and_paragraph(text: str) -> tuple[list[str], int]:
    """Return (paragraphs, total_word_count). Returns ([], 0) for empty input."""
    if not isinstance(text, str) or not text.strip():
        return [], 0
    if text.startswith(BOM):
        text = text[1:]
    # Mid-sentence hard newlines -> spaces. Multiple newlines collapse too.
    text = re.sub(r"\s*\n\s*", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return [], 0

    sentences = SENT_BOUNDARY_RE.split(text)
    paragraphs: list[str] = []
    chunk: list[str] = []
    chunk_words = 0
    total_words = 0
    for s in sentences:
        n = len(s.split())
        total_words += n
        chunk.append(s)
        chunk_words += n
        if chunk_words >= PARA_TARGET_WORDS:
            paragraphs.append(" ".join(chunk))
            chunk = []
            chunk_words = 0
    if chunk:
        paragraphs.append(" ".join(chunk))
    return paragraphs, total_words


def main() -> int:
    if not CSV_PATH.exists():
        print(f"ERROR: {CSV_PATH} not found", file=sys.stderr)
        return 1

    print(f"Reading {CSV_PATH} …")
    df = pd.read_csv(CSV_PATH)
    print(f"  {len(df)} rows")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Group by country -> {year: (paragraphs, word_count)}
    by_country: dict[str, dict[int, tuple[list[str], int]]] = defaultdict(dict)
    for i, row in enumerate(df.itertuples(index=False), start=1):
        paragraphs, wc = clean_and_paragraph(row.text)
        by_country[row.country][int(row.year)] = (paragraphs, wc)
        if i % 1000 == 0:
            print(f"  processed {i}/{len(df)} speeches")

    print(f"Writing {len(by_country)} country files to {OUT_DIR} …")
    total_bytes = 0
    for iso3, speeches in sorted(by_country.items()):
        years = sorted(speeches.keys())
        out = {
            "iso3": iso3,
            "years": years,
            "speeches": {
                str(y): {"word_count": wc, "paragraphs": paras}
                for y, (paras, wc) in speeches.items()
            },
        }
        out_path = OUT_DIR / f"{iso3}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
        total_bytes += out_path.stat().st_size

    avg_kb = total_bytes / len(by_country) / 1024
    total_mb = total_bytes / 1024 / 1024
    print(f"Done. {len(by_country)} files, total {total_mb:.1f} MB "
          f"(avg {avg_kb:.0f} KB/file)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
