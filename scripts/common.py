"""Shared helpers for the fetch/build scripts (stdlib only)."""
from __future__ import annotations

import datetime as dt
import json
import re
import sys
import tomllib
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterator

# Windows consoles default to a legacy code page that cannot print Vietnamese messages.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SNAPSHOTS = DATA / "snapshots"
CACHE = ROOT / ".cache" / "raw"
WEB = ROOT / "web"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def http_get(url: str, cache_name: str | None = None, headers: dict | None = None, timeout: int = 60) -> bytes:
    """GET a URL; keep a raw copy in .cache/raw for debugging parsers."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read()
    if cache_name:
        CACHE.mkdir(parents=True, exist_ok=True)
        (CACHE / cache_name).write_bytes(body)
    return body


def get_json(url: str, cache_name: str | None = None) -> Any:
    return json.loads(http_get(url, cache_name, {"Accept": "application/json"}))


def load_toml(name: str) -> dict:
    with open(DATA / name, "rb") as f:
        return tomllib.load(f)


def load_models() -> list[dict]:
    return load_toml("models.toml")["models"]


def write_snapshot(name: str, source_url: str, payload: Any) -> Path:
    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    path = SNAPSHOTS / f"{name}.json"
    doc = {"source_url": source_url, "fetched_at": now_iso(), "data": payload}
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    return path


def read_snapshot(name: str) -> dict | None:
    path = SNAPSHOTS / f"{name}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


# --- Next.js React Server Components payload -------------------------------
# Several leaderboards (Artificial Analysis, tbench.ai) ship their table data inside
# `self.__next_f.push([1, "..."])` script chunks rather than in the HTML table itself.

_RSC_CHUNK = re.compile(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)')


def rsc_stream(html: str) -> str:
    return "".join(json.loads(c) for c in _RSC_CHUNK.findall(html))


def json_objects_containing(stream: str, marker: str, max_backtrack: int = 80) -> Iterator[dict]:
    """Yield the innermost JSON object that encloses each occurrence of `marker`."""
    dec = json.JSONDecoder()
    seen_spans: set[tuple[int, int]] = set()
    for m in re.finditer(re.escape(marker), stream):
        pos = m.start()
        start = stream.rfind("{", 0, pos)
        for _ in range(max_backtrack):
            if start == -1:
                break
            try:
                obj, end = dec.raw_decode(stream, start)
            except json.JSONDecodeError:
                obj, end = None, -1
            if end > pos and isinstance(obj, dict):
                if (start, end) not in seen_spans:
                    seen_spans.add((start, end))
                    yield obj
                break
            start = stream.rfind("{", 0, start)


def per_million(price_per_token: Any) -> float | None:
    """OpenRouter prices are USD per token as strings; convert to USD per 1M tokens."""
    if price_per_token in (None, "", "-1"):
        return None
    return round(float(price_per_token) * 1_000_000, 6)


# --- Plain HTML tables -------------------------------------------------------

class _TableParser(HTMLParser):
    """Collect every <table> as rows of cells; each cell is (text, first_href)."""

    def __init__(self) -> None:
        super().__init__()
        self.tables: list[list[list[tuple[str, str | None]]]] = []
        self._row: list | None = None
        self._cell: list[str] | None = None
        self._href: str | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self.tables.append([])
        elif tag == "tr" and self.tables:
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell, self._href = [], None
        elif tag == "a" and self._cell is not None and self._href is None:
            self._href = dict(attrs).get("href")

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._cell is not None:
            self._row.append((" ".join("".join(self._cell).split()), self._href))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self.tables[-1].append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)


def html_tables(html: str) -> list[list[list[tuple[str, str | None]]]]:
    p = _TableParser()
    p.feed(html)
    return p.tables
