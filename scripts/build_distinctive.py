"""Build data/distinctive.json — words each country uses far more than average.

For every country we compute a "distinctiveness ratio" per word:

    ratio = (word's frequency in this country) / (word's frequency globally)

Words with ratio >> 1 are over-represented in that country's speeches.
Thresholds filter out OCR noise and one-off mentions:

  - Word must appear at least MIN_GLOBAL times across the whole corpus
  - Word must appear at least MIN_IN_COUNTRY times in this country
  - Country must have at least MIN_COUNTRY_WORDS total words

We keep the top DISTINCTIVE_KEEP_N words per country (sorted by ratio desc).

Stopwords: sklearn's English list, plus a small UN-specific extension
(generic procedural words that show up everywhere and aren't distinctive).

Output shape:
{
    "meta": { ... },
    "stopwords_extra": [...],
    "by_country": {
        "USA": [ [word, ratio, count_in_country, count_globally], ... ],
        ...
    }
}

Usage:
    /home/giovanni/miniconda3/envs/ssdp/bin/python scripts/build_distinctive.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "un-general-debates.csv"
OUT_PATH = ROOT / "data" / "distinctive.json"

WORD_RE = re.compile(r"[a-z]+")

# Tuning knobs
MIN_GLOBAL = 50              # word must appear >= this often across all corpus
MIN_IN_COUNTRY = 5           # word must appear >= this often in target country
MIN_COUNTRY_WORDS = 2000     # ignore countries with very little text
MIN_LENGTH = 3               # ignore 2-letter words (most are noise)
DISTINCTIVE_KEEP_N = 30      # top N words per country

# UN-specific procedural words. Equally-distributed across countries so they
# wouldn't survive the ratio filter anyway, but stripping them up front keeps
# the regex smaller and makes the top-N more focused on substantive vocab.
UN_STOPWORDS = {
    "united", "nations", "general", "assembly", "session", "president",
    "secretary", "organization", "mr", "ms", "sir", "madam", "speaker",
    "delegation", "delegations", "behalf", "behalf", "fifty", "sixty",
    "seventy", "second", "third", "fourth", "fifth", "sixth", "seventh",
    "eighth", "ninth", "tenth", "first", "thirty", "forty", "year", "years",
    "today", "yesterday", "tomorrow", "make", "made", "take", "taken",
    "give", "given", "say", "said", "country", "countries", "state", "states",
    "international", "world", "global", "people", "peoples", "nation",
    "government", "governments", "shall", "must", "would", "could", "may",
    "let", "us", "we", "our", "ours", "their", "theirs",
}
STOPWORDS = set(ENGLISH_STOP_WORDS) | UN_STOPWORDS


def tokenize(text: str) -> list[str]:
    if not isinstance(text, str): return []
    return [w for w in WORD_RE.findall(text.lower())
            if len(w) >= MIN_LENGTH and w not in STOPWORDS]


def main() -> int:
    if not CSV_PATH.exists():
        print(f"ERROR: {CSV_PATH} not found", file=sys.stderr)
        return 1

    print(f"Reading {CSV_PATH} …")
    df = pd.read_csv(CSV_PATH)
    df = df.dropna(subset=["text"])
    print(f"  {len(df)} speeches")

    # Tally globally + per country in one pass.
    global_counter: Counter = Counter()
    by_country: dict[str, Counter] = {}
    for i, row in enumerate(df.itertuples(index=False), start=1):
        words = tokenize(row.text)
        global_counter.update(words)
        by_country.setdefault(row.country, Counter()).update(words)
        if i % 1000 == 0:
            print(f"  tokenised {i}/{len(df)}; vocab so far: {len(global_counter)} unique")

    # Filter the global vocabulary to a high-quality subset.
    print("Filtering vocabulary …")
    vocab = {w: n for w, n in global_counter.items() if n >= MIN_GLOBAL}
    total_global = sum(vocab.values())
    print(f"  kept {len(vocab)} words after MIN_GLOBAL={MIN_GLOBAL}; total tokens {total_global:,}")

    # Per-country: compute ratios for words in vocab.
    print("Scoring per country …")
    output: dict[str, list] = {}
    for country, counts in by_country.items():
        total_country = sum(counts.values())
        if total_country < MIN_COUNTRY_WORDS:
            continue
        rows: list[tuple[str, float, int, int]] = []
        for w, c_in_country in counts.items():
            if w not in vocab or c_in_country < MIN_IN_COUNTRY:
                continue
            c_global = vocab[w]
            p_country = c_in_country / total_country
            p_global  = c_global  / total_global
            if p_global == 0: continue
            ratio = p_country / p_global
            if ratio < 2.0:  # at least 2× more frequent than average
                continue
            rows.append((w, ratio, c_in_country, c_global))
        rows.sort(key=lambda r: -r[1])
        if rows:
            # Truncate the global count to int and round the ratio.
            output[country] = [[w, round(r, 2), c, g] for (w, r, c, g) in rows[:DISTINCTIVE_KEEP_N]]

    print(f"  {len(output)} countries with distinctive words")

    out = {
        "meta": {
            "n_speeches": int(len(df)),
            "n_countries": len(output),
            "vocab_size": len(vocab),
            "min_global": MIN_GLOBAL,
            "min_in_country": MIN_IN_COUNTRY,
            "min_country_words": MIN_COUNTRY_WORDS,
            "min_ratio": 2.0,
            "keep_top_n": DISTINCTIVE_KEEP_N,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "stopwords_extra": sorted(UN_STOPWORDS),
        "by_country": output,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    kb = OUT_PATH.stat().st_size / 1024
    print(f"Wrote {OUT_PATH} ({kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
