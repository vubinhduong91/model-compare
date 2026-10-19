"""Merge snapshots + manual data into web/data.js (what the dashboard loads).

Usage: python scripts/build.py

Every value keeps where it came from, so the dashboard can show the source in tooltips.
Warnings are printed for missing data and for list prices that disagree between sources.
"""
from __future__ import annotations

import json
import sys

from common import WEB, load_models, load_toml, now_iso, read_snapshot

# Metric catalogue: id -> definition shown in the dashboard.
# higher: True if bigger is better. group: perf | price | speed | spec.
METRICS = [
    # Coding ability
    dict(id="swe_verified", group="perf", unit="%", higher=True, decimals=1, source="vals",
         vi="SWE-bench Verified", en="SWE-bench Verified",
         dvi="% issue GitHub thật được sửa đúng (Vals AI, cùng harness mini-SWE-agent cho mọi model).",
         den="% of real GitHub issues resolved (Vals AI, same mini-SWE-agent harness for every model)."),
    dict(id="tbench_official", group="perf", unit="%", higher=True, decimals=1, source="tbench",
         vi="Terminal-Bench 4.0 (leaderboard chính thức)", en="Terminal-Bench 4.0 (official leaderboard)",
         dvi="% task terminal hoàn thành; mỗi model chạy trong agent riêng (Claude Code, Codex…), lấy lượt chạy tốt nhất.",
         den="% of terminal tasks solved; each model runs inside an agent (Claude Code, Codex…), best submission."),
    dict(id="aa_tbench40", group="perf", unit="%", higher=True, decimals=1, source="aa",
         vi="Terminal-Bench 4.0 (AA)", en="Terminal-Bench 4.0 (AA)",
         dvi="Terminal-Bench 4.0 do Artificial Analysis tự chạy với cùng một harness cho mọi model.",
         den="Terminal-Bench 4.0 run by Artificial Analysis with one shared harness for every model."),
    dict(id="aa_scicode", group="perf", unit="%", higher=True, decimals=1, source="aa",
         vi="SciCode (AA)", en="SciCode (AA)",
         dvi="Viết code giải bài toán khoa học (Artificial Analysis).",
         den="Writing code for scientific problems (Artificial Analysis)."),
    dict(id="aa_coding", group="perf", unit="", higher=True, decimals=1, source="aa",
         vi="Điểm coding AA (TB 4.0 + SciCode)", en="AA coding score (TB 4.0 + SciCode)",
         dvi="Trung bình Terminal-Bench 4.0 và SciCode — đúng 2 bài tạo nên nhóm Coding trong AA Intelligence Index (mỗi bài 10%).",
         den="Mean of Terminal-Bench 4.0 and SciCode — the two evals forming the Coding category of the AA Intelligence Index (10% each)."),
    dict(id="arena_webdev", group="perf", unit="Elo", higher=True, decimals=0, source="arena",
         vi="WebDev Arena (Elo)", en="WebDev Arena (Elo)",
         dvi="Người dùng thật bình chọn mù giữa 2 model khi tạo web app. Chênh ~100 Elo ≈ thắng 64% số lần.",
         den="Blind human votes between two models building web apps. ~100 Elo gap ≈ 64% win rate."),
    dict(id="aa_intelligence", group="perf", unit="", higher=True, decimals=1, source="aa",
         vi="AA Intelligence Index", en="AA Intelligence Index",
         dvi="Chỉ số tổng hợp 10 bài đánh giá (agent, coding, kiến thức, suy luận) của Artificial Analysis.",
         den="Artificial Analysis composite of 10 evals (agents, coding, knowledge, reasoning)."),
    # Price
    dict(id="price_input", group="price", unit="$/1M", higher=False, decimals=3, source="openrouter",
         vi="Giá input", en="Input price",
         dvi="USD / 1 triệu token input, giá niêm yết của chính hãng (endpoint chính hãng trên OpenRouter).",
         den="USD per 1M input tokens, first-party list price (first-party endpoint on OpenRouter)."),
    dict(id="price_output", group="price", unit="$/1M", higher=False, decimals=3, source="openrouter",
         vi="Giá output", en="Output price",
         dvi="USD / 1 triệu token output (gồm cả token suy luận).",
         den="USD per 1M output tokens (reasoning tokens included)."),
    dict(id="price_cache", group="price", unit="$/1M", higher=False, decimals=4, source="openrouter",
         vi="Giá input cache-hit", en="Cached input price",
         dvi="USD / 1 triệu token input đã có trong cache — rất quan trọng với agent coding vì context lặp lại nhiều.",
         den="USD per 1M cached input tokens — matters a lot for coding agents that resend the same context."),
    dict(id="price_blended", group="price", unit="$/1M", higher=False, decimals=3, source="openrouter",
         vi="Giá blended (3:1)", en="Blended price (3:1)",
         dvi="(3 × input + 1 × output) / 4 — cách tính giá gộp phổ biến của Artificial Analysis.",
         den="(3 × input + 1 × output) / 4 — the common blended price used by Artificial Analysis."),
    dict(id="aa_cost_per_task", group="price", unit="$", higher=False, decimals=2, source="aa",
         vi="Chi phí thực tế / task (AA)", en="Real cost per task (AA)",
         dvi="Chi phí trung bình mỗi task khi AA chạy bộ Intelligence Index — phản ánh cả việc model tiêu nhiều hay ít token.",
         den="Average cost per task while AA ran its Intelligence Index — captures how many tokens the model burns."),
    # Speed
    dict(id="aa_tps", group="speed", unit="tok/s", higher=True, decimals=0, source="aa",
         vi="Tốc độ sinh (token/s)", en="Output speed (tokens/s)",
         dvi="Trung vị số token output mỗi giây qua API chính hãng (Artificial Analysis).",
         den="Median output tokens per second via the first-party API (Artificial Analysis)."),
    dict(id="aa_ttfat", group="speed", unit="s", higher=False, decimals=1, source="aa",
         vi="Thời gian đến câu trả lời đầu tiên", en="Time to first answer token",
         dvi="Giây từ lúc gửi đến token trả lời đầu tiên (đã gồm thời gian suy nghĩ) — so sánh công bằng giữa model ẩn/hiện reasoning.",
         den="Seconds until the first answer token (thinking time included) — fair across models that hide or show reasoning."),
    dict(id="aa_e2e", group="speed", unit="s", higher=False, decimals=1, source="aa",
         vi="Thời gian phản hồi trọn vẹn", en="End-to-end response time",
         dvi="Giây để nhận đủ một câu trả lời 500 token (Artificial Analysis).",
         den="Seconds to receive a full 500-token answer (Artificial Analysis)."),
    # Spec
    dict(id="context", group="spec", unit="tokens", higher=True, decimals=0, source="openrouter",
         vi="Context window", en="Context window",
         dvi="Số token tối đa của endpoint chính hãng.", den="Maximum tokens of the first-party endpoint."),
]

SOURCES = {
    "aa": dict(name="Artificial Analysis", url="https://artificialanalysis.ai/leaderboards/models",
               vi="Benchmark độc lập: chỉ số tổng hợp, Terminal-Bench, SciCode, tốc độ, chi phí/task.",
               en="Independent benchmarks: composite index, Terminal-Bench, SciCode, speed, cost per task."),
    "openrouter": dict(name="OpenRouter", url="https://openrouter.ai/models",
                       vi="Giá niêm yết theo từng provider, context window.",
                       en="List prices per provider, context window."),
    "tbench": dict(name="Terminal-Bench (tbench.ai)", url="https://www.tbench.ai/leaderboard",
                   vi="Leaderboard chính thức của Terminal-Bench 4.0 (model + agent).",
                   en="Official Terminal-Bench 4.0 leaderboard (model + agent)."),
    "vals": dict(name="Vals AI — SWE-bench", url="https://www.vals.ai/benchmarks/swebench",
                 vi="SWE-bench Verified chạy độc lập, cùng harness. (Leaderboard swebench.com ngừng cập nhật từ 02/2026.)",
                 en="Independent SWE-bench Verified runs, one harness. (swebench.com board not updated since Feb 2026.)"),
    "arena": dict(name="WebDev Arena (arena.ai)", url="https://arena.ai/leaderboard/code/webdev",
                  vi="Elo từ bình chọn mù của người dùng; nhập tay vì trang chặn script.",
                  en="Elo from blind human votes; entered by hand because the site blocks scripts."),
}

# Endpoint tiers that are not the standard list price.
_NON_STANDARD_TIERS = ("flex", "priority", "fast", "batch", "prime")

warnings: list[str] = []


def warn(msg: str) -> None:
    warnings.append(msg)


def val(v, **extra):
    if v is None:
        return None
    return {"v": v, **extra}


def pick_first_party(model: dict, entry: dict) -> dict | None:
    eps = [e for e in entry["endpoints"] if e["provider"] == model.get("openrouter_first_party")]
    standard = [e for e in eps if not any(t in (e["tag"] or "") for t in _NON_STANDARD_TIERS)]
    candidates = standard or eps
    if not candidates:
        return None
    # Prefer a global endpoint over regional ones, then the shortest (most generic) tag.
    return sorted(candidates, key=lambda e: ("global" not in (e["tag"] or ""), len(e["tag"] or "")))[0]


def build() -> dict:
    models = load_models()
    manual = load_toml("manual.toml")
    plans = load_toml("plans.toml")["plans"]
    snaps = {k: read_snapshot(k) for k in ("openrouter", "artificial_analysis", "terminal_bench", "vals_swebench")}
    orr = (snaps["openrouter"] or {}).get("data", {})
    aa = (snaps["artificial_analysis"] or {}).get("data", {})
    tb = (snaps["terminal_bench"] or {}).get("data", {}).get("models", {})
    vals = (snaps["vals_swebench"] or {}).get("data", {}).get("models", {})
    arena = manual.get("arena_webdev", {})
    licenses = manual.get("licenses", {})

    out_models = []
    for m in models:
        mid = m["id"]
        values: dict[str, dict | None] = {}
        details: dict = {}

        # OpenRouter prices
        entry = orr.get(m.get("openrouter", ""))
        fp = pick_first_party(m, entry) if entry else None
        if fp:
            note = f"{fp['provider']} ({fp['tag']})"
            values["price_input"] = val(fp["input"], note=note)
            values["price_output"] = val(fp["output"], note=note)
            values["price_cache"] = val(fp["cache_read"], note=note)
            if fp["input"] is not None and fp["output"] is not None:
                values["price_blended"] = val(round((3 * fp["input"] + fp["output"]) / 4, 4), note=note)
            values["context"] = val(fp["context_length"], note=note)
            priced = [e for e in entry["endpoints"] if e["input"] is not None and e["output"] is not None]
            cheapest = min(priced, key=lambda e: (3 * e["input"] + e["output"]) / 4) if priced else None
            details["openrouter"] = {
                "providers": len(entry["endpoints"]),
                "cheapest": cheapest and {k: cheapest[k] for k in ("provider", "tag", "quantization", "input", "output", "cache_read")},
            }
        elif entry:
            warn(f"{mid}: no first-party endpoint '{m.get('openrouter_first_party')}' on OpenRouter")

        # Artificial Analysis
        a = aa.get(m.get("aa_slug", ""))
        if a:
            note = a["name"]
            pct = lambda x: None if x is None else round(x * 100, 2)
            values["aa_intelligence"] = val(a["intelligenceIndex"] and round(a["intelligenceIndex"], 2), note=note)
            values["aa_tbench40"] = val(pct(a["terminalBench40"]), note=note)
            values["aa_scicode"] = val(pct(a["scicode"]), note=note)
            if a["terminalBench40"] is not None and a["scicode"] is not None:
                values["aa_coding"] = val(round((a["terminalBench40"] + a["scicode"]) * 50, 2), note=note)
            values["aa_cost_per_task"] = val(a["intelligenceIndexCostPerTask"] and round(a["intelligenceIndexCostPerTask"], 4), note=note)
            values["aa_tps"] = val(a["medianOutputTokensPerSecond"] and round(a["medianOutputTokensPerSecond"], 1), note=note)
            values["aa_ttfat"] = val(a["medianTimeToFirstAnswerTokenSeconds"] and round(a["medianTimeToFirstAnswerTokenSeconds"], 2), note=note)
            values["aa_e2e"] = val(a["medianEndToEndResponseTimeSeconds"] and round(a["medianEndToEndResponseTimeSeconds"], 2), note=note)
            details["open_weights"] = a["isOpenWeights"]
            # Cross-check list prices between OpenRouter and AA.
            if fp:
                for k_or, k_aa in (("input", "price1mInputTokens"), ("output", "price1mOutputTokens")):
                    x, y = fp[k_or], a[k_aa]
                    if x and y and abs(x - y) / y > 0.05:
                        warn(f"{mid}: {k_or} price OpenRouter ${x} vs AA ${y}")
            if values.get("price_input") is None and a["price1mInputTokens"] is not None:
                values["price_input"] = val(a["price1mInputTokens"], note="Artificial Analysis")
                values["price_output"] = val(a["price1mOutputTokens"], note="Artificial Analysis")
        elif m.get("aa_slug"):
            warn(f"{mid}: missing in Artificial Analysis snapshot")

        # Terminal-Bench official
        rows = tb.get(m.get("tbench_model", ""))
        if rows:
            best = rows[0]
            values["tbench_official"] = val(best["accuracy"], note=f"{best['agent']} · effort {best['reasoning_effort']}", ci=best["ci95"])

        # Vals SWE-bench
        v = vals.get(m.get("vals_href", ""))
        if v:
            values["swe_verified"] = val(v["accuracy"], note=f"{v['name']} · {v['harness']} · ${v['cost_per_test']}/test")

        # Arena (manual)
        s = arena.get("scores", {}).get(mid)
        if s:
            note = s["variant"] + (" · preliminary" if s.get("preliminary") else "")
            values["arena_webdev"] = val(s["score"], note=note, ci=s.get("ci"), votes=s.get("votes"))

        for metric in METRICS:
            if values.get(metric["id"]) is None:
                values.pop(metric["id"], None)
        out_models.append({
            "id": mid, "name": m["name"], "vendor": m["vendor"], "group": m["group"],
            "license": licenses.get(mid), "values": values, "details": details,
        })

    for metric in METRICS:
        missing = [x["id"] for x in out_models if metric["id"] not in x["values"]]
        if missing:
            warn(f"{metric['id']}: no data for {', '.join(missing)}")

    fetched = {
        "openrouter": (snaps["openrouter"] or {}).get("fetched_at"),
        "aa": (snaps["artificial_analysis"] or {}).get("fetched_at"),
        "tbench": (snaps["terminal_bench"] or {}).get("fetched_at"),
        "vals": (snaps["vals_swebench"] or {}).get("fetched_at"),
        "arena": str(arena.get("checked")) if arena.get("checked") else None,
    }
    sources = [{"id": k, **v, "fetched_at": fetched[k]} for k, v in SOURCES.items()]
    vals_meta = (snaps["vals_swebench"] or {}).get("data", {})
    if vals_meta.get("page_updated"):
        sources[[s["id"] for s in sources].index("vals")]["page_updated"] = vals_meta["page_updated"]

    out_plans = []
    for p in plans:
        out_plans.append({k: (str(v) if k == "checked" else v) for k, v in p.items()})

    return {"generated_at": now_iso(), "metrics": METRICS, "sources": sources, "models": out_models,
            "plans": out_plans, "warnings": warnings}


def main() -> int:
    data = build()
    WEB.mkdir(exist_ok=True)
    js = "// Generated by scripts/build.py — do not edit by hand.\nwindow.MODEL_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
    (WEB / "data.js").write_text(js, encoding="utf-8", newline="\n")
    print(f"web/data.js: {len(data['models'])} models, {len(data['metrics'])} metrics, {len(data['plans'])} plans")
    for w in data["warnings"]:
        print("  ! " + w)
    return 0


if __name__ == "__main__":
    sys.exit(main())
