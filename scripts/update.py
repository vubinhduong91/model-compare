"""One command to refresh everything: fetch all sources, rebuild web/data.js.

Usage:
    python scripts/update.py           # fetch + build, then review with `git diff`
    python scripts/update.py --push    # ...and also commit data changes and push (sync to other machines)
"""
from __future__ import annotations

import datetime as dt
import subprocess
import sys

import build
import fetch_sources
from common import ROOT

DATA_PATHS = ["data", "web/data.js"]


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True)


def main(argv: list[str]) -> int:
    fetch_failed = fetch_sources.main([])
    build.main()
    changed = git("status", "--porcelain", "--", *DATA_PATHS).stdout.rstrip()
    if not changed:
        print("\nKhông có thay đổi dữ liệu / no data changes.")
        return fetch_failed
    print("\nThay đổi / changed:\n" + changed)
    if "--push" not in argv:
        print("\nXem chi tiết: git diff -- data web/data.js | Commit + push: python scripts/update.py --push")
        return fetch_failed
    git("add", "--", *DATA_PATHS)
    msg = f"Update data {dt.date.today().isoformat()}"
    commit = git("commit", "-m", msg)
    print(commit.stdout or commit.stderr)
    push = git("push")
    print(push.stdout or push.stderr)
    return fetch_failed or commit.returncode or push.returncode


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
