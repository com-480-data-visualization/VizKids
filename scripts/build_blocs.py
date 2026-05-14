"""Build data/blocs.json — 2D embedding of (country, decade) UN speech corpora.

Pipeline:
    1. Aggregate every country's speeches into one document per decade.
       1970s = 1970..1979, 1980s = 1980..1989, etc.
    2. TF-IDF over those ~1,000 documents (top 5,000 terms, English stopwords).
    3. TruncatedSVD reduces the sparse TF-IDF matrix to 50 dense dimensions.
    4. t-SNE projects those 50 dims to 2, in ONE joint embedding so that all
       (country, decade) points share an axis system. The frontend can then
       animate decade-by-decade and the same country physically moves.
    5. Coordinates are normalised to roughly [-1, 1].

Output JSON shape:
{
    "meta": { ... },
    "decades": [1970, 1980, ..., 2010],
    "regions": [<list of region labels in legend order>],
    "region_by_iso3": { "USA": "Americas", ... },
    "decade_data": {
        "1970": [ { "iso3", "x", "y", "region", "n_speeches", "word_count" }, ... ],
        ...
    }
}

Usage:
    /home/giovanni/miniconda3/envs/ssdp/bin/python scripts/build_blocs.py
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.manifold import TSNE

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "un-general-debates.csv"
OUT_PATH = ROOT / "data" / "blocs.json"

# Hand-curated ISO3 → region mapping. Six broad groups, chosen to roughly
# correspond to UN regional dynamics. "Other" catches anything missing.
REGION_LIST = ["Africa", "Americas", "Asia", "Europe", "Middle East", "Oceania"]

REGIONS: dict[str, str] = {}

def _add(region: str, codes: list[str]) -> None:
    for c in codes:
        REGIONS[c] = region

_add("Africa", [
    "DZA", "AGO", "BEN", "BWA", "BFA", "BDI", "CMR", "CPV", "CAF", "TCD",
    "COM", "COG", "COD", "DJI", "EGY", "GNQ", "ERI", "ETH", "GAB", "GMB",
    "GHA", "GIN", "GNB", "CIV", "KEN", "LSO", "LBR", "LBY", "MDG", "MWI",
    "MLI", "MRT", "MUS", "MAR", "MOZ", "NAM", "NER", "NGA", "RWA", "STP",
    "SEN", "SYC", "SLE", "SOM", "ZAF", "SSD", "SDN", "SWZ", "TZA", "TGO",
    "TUN", "UGA", "ZMB", "ZWE",
])
_add("Americas", [
    "USA", "CAN", "MEX", "GTM", "BLZ", "SLV", "HND", "NIC", "CRI", "PAN",
    "CUB", "HTI", "DOM", "JAM", "BHS", "BRB", "TTO", "GRD", "VCT", "LCA",
    "DMA", "ATG", "KNA", "VEN", "COL", "ECU", "PER", "BOL", "BRA", "CHL",
    "ARG", "URY", "PRY", "GUY", "SUR",
])
_add("Europe", [
    "ALB", "AND", "AUT", "BEL", "BIH", "BGR", "HRV", "CYP", "CZE", "CSK",
    "DNK", "EST", "FIN", "FRA", "DEU", "DDR", "GRC", "HUN", "ISL", "IRL",
    "ITA", "LVA", "LIE", "LTU", "LUX", "MLT", "MCO", "MNE", "NLD", "MKD",
    "NOR", "POL", "PRT", "ROU", "SMR", "SRB", "SVK", "SVN", "ESP", "SWE",
    "CHE", "UKR", "GBR", "VAT", "BLR", "MDA", "RUS", "YUG", "EU",
])
_add("Middle East", [
    "BHR", "IRN", "IRQ", "ISR", "JOR", "KWT", "LBN", "OMN", "PSE", "QAT",
    "SAU", "SYR", "TUR", "ARE", "YEM", "YDYE",
])
_add("Asia", [
    "AFG", "ARM", "AZE", "BGD", "BTN", "BRN", "KHM", "CHN", "GEO", "IND",
    "IDN", "JPN", "KAZ", "PRK", "KOR", "KGZ", "LAO", "MYS", "MDV", "MNG",
    "MMR", "NPL", "PAK", "PHL", "SGP", "LKA", "TJK", "THA", "TLS", "TKM",
    "UZB", "VNM",
])
_add("Oceania", [
    "AUS", "NZL", "FJI", "PNG", "SLB", "VUT", "WSM", "TON", "TUV",
    "KIR", "PLW", "MHL", "FSM", "NRU",
])


def main() -> int:
    if not CSV_PATH.exists():
        print(f"ERROR: {CSV_PATH} not found", file=sys.stderr)
        return 1

    print(f"Reading {CSV_PATH} …")
    df = pd.read_csv(CSV_PATH)
    df = df.dropna(subset=["text"])
    df["decade"] = (df["year"] // 10) * 10
    print(f"  {len(df)} speeches, decades: {sorted(df['decade'].unique().tolist())}")

    # Aggregate text per (country, decade). Each cell becomes a single document.
    print("Aggregating speeches by (country, decade) …")
    groups = df.groupby(["country", "decade"], sort=False)
    docs: list[str] = []
    keys: list[tuple[str, int]] = []
    meta: list[dict] = []
    for (country, decade), sub in groups:
        text = " ".join(sub["text"].astype(str).tolist())
        docs.append(text)
        keys.append((country, int(decade)))
        meta.append({
            "n_speeches": int(len(sub)),
            "word_count": int(sum(len(t.split()) for t in sub["text"].astype(str))),
        })
    print(f"  {len(docs)} documents")

    # TF-IDF: drop terms that appear in fewer than 3 docs or in >85% of docs
    # (these are either noise or generic UN-speak: 'mr', 'president', etc.).
    print("Fitting TF-IDF …")
    vec = TfidfVectorizer(
        max_features=5000,
        stop_words="english",
        min_df=3,
        max_df=0.85,
        ngram_range=(1, 1),
        lowercase=True,
        token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z]+\b",
    )
    X = vec.fit_transform(docs)
    print(f"  TF-IDF matrix: {X.shape}, nnz={X.nnz}")

    # SVD compresses the sparse TF-IDF to 50 dense dims (LSA).
    print("TruncatedSVD → 50 dims …")
    svd = TruncatedSVD(n_components=50, random_state=42)
    X50 = svd.fit_transform(X)
    explained = float(svd.explained_variance_ratio_.sum())
    print(f"  variance explained by 50 components: {explained:.3f}")

    # t-SNE: project to 2D. perplexity=30 is the sklearn default and reasonable
    # for ~1000 points. init='pca' keeps the result deterministic given the
    # random_state, and is faster than random init.
    print("t-SNE → 2D … (this can take a minute)")
    tsne = TSNE(
        n_components=2,
        perplexity=30,
        random_state=42,
        learning_rate="auto",
        init="pca",
        n_iter=1500,
    )
    X2 = tsne.fit_transform(X50)
    print(f"  embedded shape: {X2.shape}")

    # Normalise to [-1, 1] on each axis so the frontend can size the canvas
    # without knowing the raw range.
    mins = X2.min(axis=0)
    maxs = X2.max(axis=0)
    rng = np.where(maxs - mins == 0, 1.0, maxs - mins)
    X2_norm = (X2 - mins) / rng * 2 - 1

    # Build output: keyed by decade for easy iteration.
    decades = sorted({d for _, d in keys})
    decade_data: dict[str, list[dict]] = {str(d): [] for d in decades}
    for (country, decade), (x, y), m in zip(keys, X2_norm, meta):
        decade_data[str(decade)].append({
            "iso3": country,
            "x": float(round(x, 4)),
            "y": float(round(y, 4)),
            "region": REGIONS.get(country, "Other"),
            "n_speeches": m["n_speeches"],
            "word_count": m["word_count"],
        })

    # Stable sort inside each decade for diff-friendly output.
    for d in decade_data:
        decade_data[d].sort(key=lambda p: p["iso3"])

    region_by_iso3 = {iso: REGIONS.get(iso, "Other") for iso in {k for k, _ in keys}}
    regions_used = sorted({p["region"] for d in decade_data.values() for p in d})

    out = {
        "meta": {
            "n_documents": len(docs),
            "n_decades": len(decades),
            "n_terms": int(X.shape[1]),
            "svd_explained_variance": round(explained, 4),
            "tsne_perplexity": 30,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "decades": decades,
        "regions": regions_used,
        "region_by_iso3": region_by_iso3,
        "decade_data": decade_data,
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"Wrote {OUT_PATH} ({size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
