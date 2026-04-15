"""Aggregate UN speeches per country and write data/country_stats.json.

Pure stdlib — no pandas dependency. Run from the project root:
    python3 scripts/build_country_stats.py
"""
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "un-general-debates.csv"
OUT = ROOT / "data" / "country_stats.json"

STOP = set("""
a an the and or but if then else of in on at to for from by with as is are was were be been being
have has had do does did not no nor so than that this these those i we you he he she it they them us
our your their his her its my me mine yours ours theirs will would shall should can could may might
must also upon one two any some all each every such only just more most less least very much many
few several other another new same own about into through during before after above below between
among over under while when where why how what which who whom whose here there out off down up again
further once because against per mr president assembly general nations united said statement session
country countries government international world people year charter secretary sir
""".split())

WORD_RE = re.compile(r"[a-z]+")
SENT_RE = re.compile(r"[.!?]+")

ISO3_FIX = {"YUG": None, "CSK": None, "DDR": None, "YDYE": None, "EU": None}

# CSV files with very large cells need a larger field size limit.
csv.field_size_limit(sys.maxsize)


def tokenize(text: str) -> list[str]:
    return [w for w in WORD_RE.findall(text.lower()) if len(w) > 2 and w not in STOP]


def main() -> None:
    print(f"Reading {CSV_PATH.name}…")

    buckets: dict[str, dict] = defaultdict(lambda: {
        "n_speeches": 0,
        "word_total": 0,
        "unique_total": 0,
        "sent_total": 0,
        "years": set(),
        "counter": Counter(),
    })

    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, 1):
            iso3 = ISO3_FIX.get(row["country"], row["country"])
            if iso3 is None:
                continue
            text = row["text"]
            words = text.split()
            tokens = tokenize(text)

            b = buckets[iso3]
            b["n_speeches"] += 1
            b["word_total"] += len(words)
            b["unique_total"] += len(set(w.lower() for w in words))
            b["sent_total"] += len(SENT_RE.findall(text))
            b["years"].add(int(row["year"]))
            b["counter"].update(tokens)

            if i % 500 == 0:
                print(f"  {i} rows…", end="\r")

    stats: dict[str, dict] = {}
    for iso3, b in buckets.items():
        n = b["n_speeches"]
        stats[iso3] = {
            "name": iso3,
            "n_speeches": n,
            "years": sorted(b["years"]),
            "avg_word_count": round(b["word_total"] / n, 1),
            "avg_sent_count": round(b["sent_total"] / n, 1),
            "avg_unique_words": round(b["unique_total"] / n, 1),
            "top_words": b["counter"].most_common(25),
        }

    OUT.write_text(json.dumps(stats, ensure_ascii=False))
    print(f"\nWrote {OUT.relative_to(ROOT)} — {len(stats)} countries, {sum(v['n_speeches'] for v in stats.values())} speeches")


if __name__ == "__main__":
    main()
