"""Build data/mentions.json — directed country-mention graph from speech text.

For every speech, we scan for any country name and tally a mention from the
speech's source country to every other country named. Self-mentions are skipped.
Output supports both aggregated (1970-2015) and per-year lookups so the frontend
can switch between long-term diplomatic attention and a single year's chatter.

Output shape:
{
    "meta": { ... },
    "years": [1970..2015],
    "country_names": { iso3: display_name },
    "aggregate": {
        source_iso3: {
            "total": int,
            "top":   [ [target_iso3, count], ... ]   # all distinct targets, sorted desc
        }, ...
    },
    "by_year": {
        "YYYY": {
            source_iso3: { "total": int, "top": [...top 25...] }, ...
        }, ...
    }
}

Usage:
    /home/giovanni/miniconda3/envs/ssdp/bin/python scripts/build_mentions.py
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
OUT_PATH = ROOT / "data" / "mentions.json"

# Top N targets to keep per (year, source) in by_year (aggregate keeps all).
TOP_PER_YEAR = 25

# --------------------------------------------------------------------------
# Country-name -> ISO3 dictionary
# --------------------------------------------------------------------------
# All keys are lowercase. The regex below sorts by length descending so that
# "united states of america" is tried before "united states". Aliases include
# historical/alternate names commonly seen in UN speeches.

NAME_TO_ISO3: dict[str, str] = {}

def add(iso3: str, *names: str) -> None:
    for n in names:
        NAME_TO_ISO3[n.lower()] = iso3

# Africa
add("DZA", "algeria")
add("AGO", "angola")
add("BEN", "benin", "dahomey")
add("BWA", "botswana")
add("BFA", "burkina faso", "upper volta")
add("BDI", "burundi")
add("CMR", "cameroon")
add("CPV", "cabo verde", "cape verde")
add("CAF", "central african republic")
add("TCD", "chad")
add("COM", "comoros")
add("COG", "congo", "republic of the congo")
add("COD", "democratic republic of the congo", "drc", "zaire")
add("DJI", "djibouti")
add("EGY", "egypt")
add("GNQ", "equatorial guinea")
add("ERI", "eritrea")
add("SWZ", "swaziland", "eswatini")
add("ETH", "ethiopia")
add("GAB", "gabon")
add("GMB", "gambia")
add("GHA", "ghana")
add("GIN", "guinea")
add("GNB", "guinea-bissau", "guinea bissau")
add("CIV", "ivory coast", "cote d'ivoire", "cote divoire")
add("KEN", "kenya")
add("LSO", "lesotho")
add("LBR", "liberia")
add("LBY", "libya")
add("MDG", "madagascar")
add("MWI", "malawi")
add("MLI", "mali")
add("MRT", "mauritania")
add("MUS", "mauritius")
add("MAR", "morocco")
add("MOZ", "mozambique")
add("NAM", "namibia")
add("NER", "niger")
add("NGA", "nigeria")
add("RWA", "rwanda")
add("STP", "sao tome and principe", "sao tome")
add("SEN", "senegal")
add("SYC", "seychelles")
add("SLE", "sierra leone")
add("SOM", "somalia")
add("ZAF", "south africa")
add("SSD", "south sudan")
add("SDN", "sudan")
add("TZA", "tanzania", "united republic of tanzania")
add("TGO", "togo")
add("TUN", "tunisia")
add("UGA", "uganda")
add("ZMB", "zambia")
add("ZWE", "zimbabwe", "rhodesia")

# Americas
add("USA", "united states of america", "united states")
add("CAN", "canada")
add("MEX", "mexico")
add("GTM", "guatemala")
add("BLZ", "belize")
add("SLV", "el salvador")
add("HND", "honduras")
add("NIC", "nicaragua")
add("CRI", "costa rica")
add("PAN", "panama")
add("CUB", "cuba")
add("HTI", "haiti")
add("DOM", "dominican republic")
add("JAM", "jamaica")
add("BHS", "bahamas")
add("BRB", "barbados")
add("TTO", "trinidad and tobago", "trinidad")
add("GRD", "grenada")
add("VCT", "saint vincent and the grenadines", "saint vincent")
add("LCA", "saint lucia")
add("DMA", "dominica")
add("ATG", "antigua and barbuda", "antigua")
add("KNA", "saint kitts and nevis", "saint kitts")
add("VEN", "venezuela")
add("COL", "colombia")
add("ECU", "ecuador")
add("PER", "peru")
add("BOL", "bolivia")
add("BRA", "brazil")
add("CHL", "chile")
add("ARG", "argentina")
add("URY", "uruguay")
add("PRY", "paraguay")
add("GUY", "guyana")
add("SUR", "suriname")

# Europe
add("ALB", "albania")
add("AND", "andorra")
add("AUT", "austria")
add("BEL", "belgium")
add("BIH", "bosnia and herzegovina", "bosnia-herzegovina", "bosnia")
add("BGR", "bulgaria")
add("HRV", "croatia")
add("CYP", "cyprus")
add("CZE", "czech republic", "czechia")
add("CSK", "czechoslovakia")
add("DNK", "denmark")
add("EST", "estonia")
add("FIN", "finland")
add("FRA", "france")
add("DEU", "germany", "federal republic of germany", "west germany")
add("DDR", "east germany", "german democratic republic")
add("GRC", "greece")
add("HUN", "hungary")
add("ISL", "iceland")
add("IRL", "ireland")
add("ITA", "italy")
add("LVA", "latvia")
add("LIE", "liechtenstein")
add("LTU", "lithuania")
add("LUX", "luxembourg")
add("MLT", "malta")
add("MCO", "monaco")
add("MNE", "montenegro")
add("NLD", "netherlands")
add("MKD", "north macedonia", "macedonia")
add("NOR", "norway")
add("POL", "poland")
add("PRT", "portugal")
add("ROU", "romania")
add("SMR", "san marino")
add("SRB", "serbia")
add("SVK", "slovakia")
add("SVN", "slovenia")
add("ESP", "spain")
add("SWE", "sweden")
add("CHE", "switzerland")
add("UKR", "ukraine")
add("GBR", "united kingdom", "great britain", "britain")
add("VAT", "holy see", "vatican", "vatican city")
add("BLR", "belarus", "byelorussia")
add("MDA", "moldova")
add("RUS", "russia", "russian federation", "soviet union", "ussr")
add("YUG", "yugoslavia")
add("EU", "european union")

# Middle East
add("BHR", "bahrain")
add("IRN", "iran", "islamic republic of iran")
add("IRQ", "iraq")
add("ISR", "israel")
add("JOR", "jordan")
add("KWT", "kuwait")
add("LBN", "lebanon")
add("OMN", "oman")
add("PSE", "palestine", "occupied palestinian territory")
add("QAT", "qatar")
add("SAU", "saudi arabia")
add("SYR", "syria", "syrian arab republic")
add("TUR", "turkey", "türkiye", "turkiye")
add("ARE", "united arab emirates", "uae")
add("YEM", "yemen")
add("YDYE", "south yemen", "democratic yemen")

# Asia
add("AFG", "afghanistan")
add("ARM", "armenia")
add("AZE", "azerbaijan")
add("BGD", "bangladesh")
add("BTN", "bhutan")
add("BRN", "brunei", "brunei darussalam")
add("KHM", "cambodia", "kampuchea")
add("CHN", "china", "people's republic of china")
add("GEO", "georgia")
add("IND", "india")
add("IDN", "indonesia")
add("JPN", "japan")
add("KAZ", "kazakhstan")
add("PRK", "north korea", "democratic people's republic of korea", "dprk")
add("KOR", "south korea", "republic of korea")
add("KGZ", "kyrgyzstan")
add("LAO", "laos", "lao people's democratic republic")
add("MYS", "malaysia")
add("MDV", "maldives")
add("MNG", "mongolia")
add("MMR", "myanmar", "burma")
add("NPL", "nepal")
add("PAK", "pakistan")
add("PHL", "philippines")
add("SGP", "singapore")
add("LKA", "sri lanka")
add("TJK", "tajikistan")
add("THA", "thailand")
add("TLS", "timor-leste", "east timor")
add("TKM", "turkmenistan")
add("UZB", "uzbekistan")
add("VNM", "vietnam", "viet nam")

# Oceania
add("AUS", "australia")
add("NZL", "new zealand")
add("FJI", "fiji")
add("PNG", "papua new guinea")
add("SLB", "solomon islands")
add("VUT", "vanuatu")
add("WSM", "samoa")
add("TON", "tonga")
add("TUV", "tuvalu")
add("KIR", "kiribati")
add("PLW", "palau")
add("MHL", "marshall islands")
add("FSM", "micronesia")
add("NRU", "nauru")


def build_pattern() -> re.Pattern:
    # Longest names first so "united states of america" wins over "united states"
    # in the regex alternation engine. Word boundaries on both sides.
    names = sorted(NAME_TO_ISO3.keys(), key=len, reverse=True)
    return re.compile(r"\b(?:" + "|".join(re.escape(n) for n in names) + r")\b", re.IGNORECASE)


def main() -> int:
    if not CSV_PATH.exists():
        print(f"ERROR: {CSV_PATH} not found", file=sys.stderr)
        return 1

    print(f"Reading {CSV_PATH} …")
    df = pd.read_csv(CSV_PATH)
    df = df.dropna(subset=["text"])
    print(f"  {len(df)} speeches; {len(NAME_TO_ISO3)} name variants -> {len(set(NAME_TO_ISO3.values()))} ISO3 codes")

    pattern = build_pattern()

    by_year: dict[int, dict[str, Counter]] = defaultdict(lambda: defaultdict(Counter))
    n_mentions = 0
    for i, row in enumerate(df.itertuples(index=False), start=1):
        text = row.text
        source = row.country
        year = int(row.year)
        # findall over the lowercased text — pattern is already case-insensitive
        # but lowering avoids per-match .lower() calls below.
        text_lower = text.lower()
        for hit in pattern.findall(text_lower):
            target = NAME_TO_ISO3.get(hit)
            if target is None or target == source:
                continue
            by_year[year][source][target] += 1
            n_mentions += 1
        if i % 1000 == 0:
            print(f"  processed {i}/{len(df)} speeches, {n_mentions:,} mentions so far")

    print(f"Total mentions: {n_mentions:,}")

    # Build aggregate by summing by_year
    aggregate: dict[str, Counter] = defaultdict(Counter)
    for year_data in by_year.values():
        for source, targets in year_data.items():
            aggregate[source].update(targets)

    years_sorted = sorted(by_year.keys())

    # Build display names from the ISO3 → first canonical name. We pick the
    # longest registered alias for each ISO3 (usually the official name).
    iso_to_names: dict[str, list[str]] = defaultdict(list)
    for name, iso in NAME_TO_ISO3.items():
        iso_to_names[iso].append(name)
    # Modern short names rather than longest historical alias, with a few
    # casing corrections for things title() can't handle ("People's", "of", ...).
    PRETTY_NAMES = {
        "USA": "United States", "GBR": "United Kingdom", "RUS": "Russia",
        "DEU": "Germany", "PRK": "North Korea", "KOR": "South Korea",
        "CIV": "Côte d'Ivoire", "EU": "European Union", "VAT": "Holy See",
        "PSE": "Palestine", "CHN": "China", "KHM": "Cambodia", "MMR": "Myanmar",
        "LAO": "Laos", "SYR": "Syria", "IRN": "Iran", "VNM": "Vietnam",
        "TZA": "Tanzania", "COG": "Congo", "COD": "DR Congo",
        "BRN": "Brunei", "STP": "São Tomé and Príncipe", "ARE": "UAE",
        "FSM": "Micronesia", "TLS": "Timor-Leste", "BIH": "Bosnia and Herzegovina",
        "MKD": "North Macedonia", "SWZ": "Eswatini", "BFA": "Burkina Faso",
        "BHS": "Bahamas", "BLZ": "Belize", "DOM": "Dominican Republic",
        "GNB": "Guinea-Bissau", "GNQ": "Equatorial Guinea", "CPV": "Cabo Verde",
        "CAF": "Central African Republic", "VCT": "Saint Vincent and the Grenadines",
        "TTO": "Trinidad and Tobago", "KNA": "Saint Kitts and Nevis",
        "ATG": "Antigua and Barbuda", "LCA": "Saint Lucia", "DDR": "East Germany",
        "CSK": "Czechoslovakia", "YUG": "Yugoslavia", "YDYE": "South Yemen",
        "PNG": "Papua New Guinea", "SLB": "Solomon Islands", "MHL": "Marshall Islands",
        "NZL": "New Zealand", "ZAF": "South Africa", "SSD": "South Sudan",
    }
    country_names: dict[str, str] = {}
    for iso, names in iso_to_names.items():
        if iso in PRETTY_NAMES:
            country_names[iso] = PRETTY_NAMES[iso]
        else:
            # Use the SHORTEST alias (usually the common name), then title-case.
            country_names[iso] = min(names, key=len).title()

    out_aggregate = {}
    for source, counts in aggregate.items():
        top = counts.most_common()
        out_aggregate[source] = {
            "total": int(sum(counts.values())),
            "top": [[t, int(n)] for t, n in top],
        }

    out_by_year = {}
    for year in years_sorted:
        ymap = {}
        for source, counts in by_year[year].items():
            top = counts.most_common(TOP_PER_YEAR)
            ymap[source] = {
                "total": int(sum(counts.values())),
                "top": [[t, int(n)] for t, n in top],
            }
        out_by_year[str(year)] = ymap

    out = {
        "meta": {
            "n_speeches": int(len(df)),
            "n_total_mentions": int(n_mentions),
            "n_name_variants": len(NAME_TO_ISO3),
            "n_countries": len(set(NAME_TO_ISO3.values())),
            "top_per_year": TOP_PER_YEAR,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "years": years_sorted,
        "country_names": country_names,
        "aggregate": out_aggregate,
        "by_year": out_by_year,
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    kb = OUT_PATH.stat().st_size / 1024
    print(f"Wrote {OUT_PATH} ({kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
