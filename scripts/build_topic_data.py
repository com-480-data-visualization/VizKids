"""Build data/topic_rates.json from the raw UN General Debate corpus.

For every (country, year, topic) combination the script computes the number of
mentions of any keyword in that topic, normalised to mentions per 1,000 words
of that year's speech. The result is consumed by the Topic Map on final.html.

Usage:
    /home/giovanni/miniconda3/envs/ssdp/bin/python scripts/build_topic_data.py

Inputs:
    data/un-general-debates.csv  — columns: session, year, country, text

Output:
    data/topic_rates.json — see TOP-LEVEL SHAPE below.

JSON shape:
{
    "meta":   { "year_min", "year_max", "n_topics", "n_countries", "generated_at" },
    "topics": [ { "key", "label", "keywords": [...] }, ... ],
    "years":  [1970, ..., 2015],
    "rates":  { topic_key: { "YYYY": { ISO3: float } } }    # rate = mentions per 1000 words
}
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "un-general-debates.csv"
OUT_PATH = ROOT / "data" / "topic_rates.json"

# Tokenisation: lower-cased ASCII word runs. Good enough for English UN text;
# does not catch hyphenated compounds, which we handle by listing both halves
# in the keyword set when needed.
WORD_RE = re.compile(r"[a-z]+")

# Topic taxonomy. Each topic groups a small bag of indicator words. Words are
# matched in their lower-cased base form — we list the inflections explicitly
# so the script stays dependency-free (no nltk lemmatiser).
TOPICS: list[dict] = [
    {
        "key": "climate",
        "label": "Climate & environment",
        "keywords": [
            "climate", "climates", "climatic",
            "emission", "emissions",
            "carbon", "warming", "greenhouse",
            "environment", "environmental", "environmentally",
            "ecology", "ecological", "ecosystem", "ecosystems",
            "biodiversity", "deforestation", "desertification",
            "pollution", "polluting",
            "renewable", "renewables",
            "sustainable", "sustainability", "sustainably",
        ],
    },
    {
        "key": "terrorism",
        "label": "Terrorism",
        "keywords": [
            "terror", "terrors",
            "terrorism", "terrorist", "terrorists",
            "extremism", "extremist", "extremists",
            "radicalization", "radicalisation", "radicalized", "radicalised",
            "jihad", "jihadi", "jihadist", "jihadists",
            "daesh", "qaeda", "isis", "isil",
        ],
    },
    {
        "key": "nuclear",
        "label": "Nuclear weapons",
        "keywords": [
            "nuclear", "nuclei",
            "atomic",
            "missile", "missiles",
            "proliferation", "nonproliferation", "proliferating",
            "disarmament", "disarming", "disarm",
            "warhead", "warheads",
            "npt", "ctbt",
        ],
    },
    {
        "key": "migration",
        "label": "Migration & refugees",
        "keywords": [
            "refugee", "refugees",
            "migrant", "migrants", "migration", "migrations", "migratory",
            "displacement", "displaced",
            "asylum",
        ],
    },
    {
        "key": "democracy",
        "label": "Democracy & freedoms",
        "keywords": [
            "democracy", "democracies", "democratic", "democratisation", "democratization",
            "election", "elections", "electoral",
            "freedom", "freedoms",
            "liberty", "liberties",
            "pluralism", "pluralistic",
        ],
    },
    {
        "key": "poverty",
        "label": "Poverty & development",
        "keywords": [
            "poverty", "impoverished", "impoverishment",
            "hunger", "famine", "famines", "malnutrition", "undernourishment",
            "inequality", "inequalities",
            "underdevelopment", "underdeveloped",
            "deprivation",
            "mdg", "mdgs", "sdg", "sdgs",
        ],
    },
    {
        "key": "conflict",
        "label": "War & conflict",
        "keywords": [
            "war", "wars", "warfare",
            "conflict", "conflicts",
            "armed",
            "hostilities", "hostility",
            "ceasefire",
            "aggression", "aggressor", "aggressors",
            "invasion", "invade", "invaded",
            "occupation", "occupying",
        ],
    },
    {
        "key": "economy",
        "label": "Economy & trade",
        "keywords": [
            "economy", "economies", "economic", "economical",
            "trade", "trading",
            "market", "markets",
            "finance", "financial", "financing",
            "investment", "investments", "investor", "investors",
            "growth",
            "debt", "debts", "indebtedness",
            "gdp",
            "tariff", "tariffs",
        ],
    },
    {
        "key": "health",
        "label": "Public health",
        "keywords": [
            "health", "healthcare", "healthy",
            "pandemic", "pandemics",
            "epidemic", "epidemics",
            "hiv", "aids", "malaria", "tuberculosis", "cholera", "ebola",
            "vaccination", "vaccinations", "vaccine", "vaccines",
            "virus", "viruses",
        ],
    },
    {
        "key": "sovereignty",
        "label": "Sovereignty & independence",
        "keywords": [
            "sovereignty", "sovereign", "sovereignties",
            "intervention", "interventions", "interventionism",
            "noninterference", "interference",
            "self-determination", "selfdetermination",
            "independence", "independent",
            "autonomy", "autonomous",
            "decolonization", "decolonisation",
        ],
    },
    {
        "key": "coldwar",
        "label": "Cold War vocabulary",
        "keywords": [
            "soviet", "soviets",
            "ussr",
            "communism", "communist", "communists",
            "capitalism", "capitalist", "capitalists",
            "imperialism", "imperialist", "imperialists",
            "bloc", "blocs",
            "détente", "detente",
        ],
    },
    {
        "key": "gender",
        "label": "Women & gender",
        "keywords": [
            "woman", "women",
            "girl", "girls",
            "gender", "genders",
            "feminism", "feminist",
            "matriarchy", "patriarchy",
        ],
    },
]


def build_keyword_index(topics: list[dict]) -> dict[str, str]:
    """Flatten { topic_key: [kws] } → { kw: topic_key }. Detects collisions."""
    index: dict[str, str] = {}
    for t in topics:
        for kw in t["keywords"]:
            kw_norm = kw.lower()
            if kw_norm in index and index[kw_norm] != t["key"]:
                raise ValueError(
                    f"Keyword collision: {kw_norm!r} claimed by both "
                    f"{index[kw_norm]!r} and {t['key']!r}"
                )
            index[kw_norm] = t["key"]
    return index


def count_speech(text: str, kw_to_topic: dict[str, str]) -> tuple[int, Counter]:
    """Returns (total_word_count, topic_counts) for one speech."""
    tokens = WORD_RE.findall(text.lower())
    total = len(tokens)
    counts: Counter = Counter()
    for tok in tokens:
        topic = kw_to_topic.get(tok)
        if topic is not None:
            counts[topic] += 1
    return total, counts


def main() -> int:
    if not CSV_PATH.exists():
        print(f"ERROR: {CSV_PATH} not found", file=sys.stderr)
        return 1

    print(f"Reading {CSV_PATH} …")
    df = pd.read_csv(CSV_PATH)
    print(f"  {len(df)} rows, columns: {list(df.columns)}")

    kw_to_topic = build_keyword_index(TOPICS)
    print(f"  {len(kw_to_topic)} keywords across {len(TOPICS)} topics")

    # Aggregator: topic -> year -> iso3 -> rate (filled at the end).
    # Two passes: first collect raw counts and word totals, then compute rates.
    raw_counts: dict[str, dict[int, dict[str, int]]] = {
        t["key"]: defaultdict(lambda: defaultdict(int)) for t in TOPICS
    }
    word_totals: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for i, row in enumerate(df.itertuples(index=False), start=1):
        if not isinstance(row.text, str):
            continue
        total, counts = count_speech(row.text, kw_to_topic)
        word_totals[int(row.year)][row.country] += total
        for topic, n in counts.items():
            raw_counts[topic][int(row.year)][row.country] += n
        if i % 1000 == 0:
            print(f"  processed {i}/{len(df)} speeches")

    # Year axis: all years actually present in the corpus (sorted).
    years = sorted({y for y in word_totals.keys()})
    countries = sorted({c for ymap in word_totals.values() for c in ymap.keys()})
    print(f"  years: {years[0]}..{years[-1]} ({len(years)})")
    print(f"  countries: {len(countries)}")

    # Compute rates: per 1000 words. A country that spoke but didn't mention
    # the topic gets an explicit 0 (so the map distinguishes "no mention" from
    # "did not speak"). Countries with no speech that year are simply omitted.
    rates: dict[str, dict[str, dict[str, float]]] = {}
    for topic_key, year_map in raw_counts.items():
        rates[topic_key] = {}
        for year in years:
            year_str = str(year)
            rates[topic_key][year_str] = {}
            for iso3, total in word_totals[year].items():
                if total <= 0:
                    continue
                n = year_map.get(year, {}).get(iso3, 0)
                rates[topic_key][year_str][iso3] = round(1000.0 * n / total, 4)

    out = {
        "meta": {
            "year_min": years[0],
            "year_max": years[-1],
            "n_topics": len(TOPICS),
            "n_countries": len(countries),
            "n_speeches": len(df),
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "topics": TOPICS,
        "years": years,
        "rates": rates,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"Wrote {OUT_PATH} ({size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
