"""Download each automatic source and store a normalized snapshot in data/snapshots/.

Usage:
    python scripts/fetch_sources.py              # all sources
    python scripts/fetch_sources.py aa tbench    # only some (openrouter, aa, tbench, vals)

A source that fails keeps its previous snapshot, so the dashboard never loses data
because one website changed or was down.
"""
from __future__ import annotations

import difflib
import re
import sys
import traceback

from common import (
    get_json,
    html_tables,
    http_get,
    json_objects_containing,
    load_models,
    per_million,
    rsc_stream,
    write_snapshot,
)


def _warn_missing(kind: str, wanted: str, available: list[str]) -> None:
    close = difflib.get_close_matches(wanted, available, n=3, cutoff=0.5)
    hint = f" (gần giống / close: {', '.join(close)})" if close else ""
    print(f"  ! {kind}: không tìm thấy / not found '{wanted}'{hint}")


# --- OpenRouter: list price per provider, context window ---------------------

OPENROUTER_MODELS = "https://openrouter.ai/api/v1/models"


def fetch_openrouter(models: list[dict]) -> None:
    catalog = {m["id"]: m for m in get_json(OPENROUTER_MODELS, "openrouter_models.json")["data"]}
    out = {}
    for model in models:
        or_id = model.get("openrouter")
        if not or_id:
            continue
        if or_id not in catalog:
            _warn_missing("openrouter", or_id, list(catalog))
            continue
        info = catalog[or_id]
        safe = or_id.replace("/", "__")
        endpoints = get_json(f"https://openrouter.ai/api/v1/models/{or_id}/endpoints", f"openrouter_{safe}.json")["data"]["endpoints"]
        eps = []
        for e in endpoints:
            p = e.get("pricing") or {}
            eps.append({
                "provider": e.get("provider_name"),
                "tag": e.get("tag"),
                "quantization": e.get("quantization"),
                "context_length": e.get("context_length"),
                "max_completion_tokens": e.get("max_completion_tokens"),
                "input": per_million(p.get("prompt")),
                "output": per_million(p.get("completion")),
                "cache_read": per_million(p.get("input_cache_read")),
                "uptime_1d": e.get("uptime_last_1d"),
            })
        out[or_id] = {
            "name": info.get("name"),
            "created": info.get("created"),
            "context_length": info.get("context_length"),
            "supported_parameters": info.get("supported_parameters"),
            "endpoints": sorted(eps, key=lambda x: (x["input"] is None, x["input"] or 0, x["output"] or 0)),
        }
        print(f"  {or_id}: {len(eps)} endpoints")
    write_snapshot("openrouter", OPENROUTER_MODELS, out)


# --- Artificial Analysis: intelligence index, coding evals, speed, cost/task --

AA_URL = "https://artificialanalysis.ai/leaderboards/models"
AA_FIELDS = [
    "name", "shortName", "slug", "modelCreatorName", "isOpenWeights", "isReasoning", "deprecated",
    "intelligenceIndex", "intelligenceIndexIsEstimated", "intelligenceIndexCostPerTask",
    "terminalBench40", "terminalBench21", "terminalbenchHard", "scicode",
    "price1mInputTokens", "price1mOutputTokens", "cacheHitPrice", "contextWindowTokens",
    "medianOutputTokensPerSecond", "medianTimeToFirstTokenSeconds",
    "medianTimeToFirstAnswerTokenSeconds", "medianEndToEndResponseTimeSeconds",
]


def fetch_aa(models: list[dict]) -> None:
    stream = rsc_stream(http_get(AA_URL, "aa_leaderboard.html").decode("utf-8"))
    # The page embeds several partial records per model (table rows, chart points...).
    # Merge them per slug, letting records with more fields win.
    records: dict[str, dict] = {}
    for obj in sorted(json_objects_containing(stream, '"intelligenceIndex"'), key=len):
        if "slug" in obj:
            records.setdefault(obj["slug"], {}).update(obj)
    if len(records) < 20:
        raise RuntimeError(f"AA page layout changed? only {len(records)} records parsed")
    out = {}
    for model in models:
        slug = model.get("aa_slug")
        if not slug:
            continue
        if slug not in records:
            _warn_missing("artificial analysis", slug, list(records))
            continue
        out[slug] = {k: records[slug].get(k) for k in AA_FIELDS}
    print(f"  parsed {len(records)} AA records, kept {len(out)}")
    write_snapshot("artificial_analysis", AA_URL, out)


# --- Terminal-Bench official leaderboard (tbench.ai) --------------------------

TBENCH_URL = "https://www.tbench.ai/leaderboard"


def fetch_tbench(models: list[dict]) -> None:
    html = http_get(TBENCH_URL, "tbench_leaderboard.html").decode("utf-8")
    stream = rsc_stream(html)
    title = re.search(r"official leaderboard for (Terminal-Bench \d+(?:\.\d+)*)", stream)
    rows = [r for r in json_objects_containing(stream, '"leaderboard_id"') if "metrics" in r and "metadata" in r]
    if not rows:
        raise RuntimeError("tbench.ai layout changed? no leaderboard rows parsed")
    by_model: dict[str, list[dict]] = {}
    for r in rows:
        md, mx = r["metadata"], r["metrics"]
        by_model.setdefault(md["model_display"]["label"], []).append({
            "agent": md.get("agent_display", {}).get("label"),
            "reasoning_effort": md.get("reasoning_effort"),
            "date": md.get("date"),
            "accuracy": mx.get("accuracy"),
            "ci95": mx.get("accuracy_ci95_half_width"),
            "total_cost_usd": mx.get("total_cost_usd"),
            "n_trials": mx.get("n_trials"),
        })
    out = {}
    for model in models:
        label = model.get("tbench_model")
        if not label:
            continue
        if label not in by_model:
            _warn_missing("tbench", label, list(by_model))
            continue
        out[label] = sorted(by_model[label], key=lambda x: -(x["accuracy"] or 0))
    version = title.group(1) if title else "Terminal-Bench"
    print(f"  {version}: {len(rows)} rows, kept {len(out)} models")
    write_snapshot("terminal_bench", TBENCH_URL, {"benchmark": version, "models": out})


# --- Vals AI: SWE-bench Verified with one shared harness ----------------------

VALS_URL = "https://www.vals.ai/benchmarks/swebench"
VALS_HARNESS = "Mini-SWE-agent"


def _pct(s: str) -> float | None:
    m = re.search(r"[-\d.]+", s.replace(",", ""))
    return float(m.group()) if m else None


def fetch_vals(models: list[dict]) -> None:
    html = http_get(VALS_URL, "vals_swebench.html").decode("utf-8")
    updated = re.search(r"Updated\s+(\d{1,2}/\d{1,2}/\d{4})", html)
    table = next((t for t in html_tables(html) if t and [c[0] for c in t[0]][:4] == ["Rank", "Model", "Harness", "Score"]), None)
    if table is None:
        raise RuntimeError("vals.ai layout changed? leaderboard table not found")
    rows: dict[str, dict] = {}
    for r in table[1:]:
        if len(r) < 6 or r[2][0] != VALS_HARNESS or not r[1][1]:
            continue
        rows.setdefault(r[1][1], {
            "name": r[1][0], "harness": r[2][0], "accuracy": _pct(r[3][0]),
            "cost_per_test": _pct(r[4][0]), "listed_price": r[5][0],
            "duration": r[6][0] if len(r) > 6 else None,
        })
    out = {}
    for model in models:
        href = model.get("vals_href")
        if not href:
            continue
        if href not in rows:
            _warn_missing("vals", href, list(rows))
            continue
        out[href] = rows[href]
    print(f"  SWE-bench Verified ({VALS_HARNESS}): {len(rows)} rows, kept {len(out)}")
    write_snapshot("vals_swebench", VALS_URL, {
        "benchmark": "SWE-bench Verified", "harness": VALS_HARNESS,
        "page_updated": updated.group(1) if updated else None, "models": out,
    })


FETCHERS = {"openrouter": fetch_openrouter, "aa": fetch_aa, "tbench": fetch_tbench, "vals": fetch_vals}


def main(argv: list[str]) -> int:
    wanted = argv or list(FETCHERS)
    models = load_models()
    failed = []
    for name in wanted:
        print(f"[{name}]")
        try:
            FETCHERS[name](models)
        except Exception:  # keep going; the old snapshot stays in place
            traceback.print_exc()
            failed.append(name)
    if failed:
        print(f"\nLỖI / FAILED: {', '.join(failed)} — giữ snapshot cũ / previous snapshot kept")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
