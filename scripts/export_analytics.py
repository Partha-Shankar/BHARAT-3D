# Copyright (c) 2026 Partha Shankar and the BHARAT 3D team. All rights reserved. See LICENSE.
"""Export every row of every table in the D1 analytics database to a local, git-ignored folder.

Usage (repo root, logged in to Cloudflare with `npx wrangler@4 login`):
    python scripts/export_analytics.py

Writes docs/analytics-export/<UTC timestamp>/ (docs/ is git-ignored, so visitor data is never published):
    <table>.jsonl and <table>.csv  every column of every row, paged by rowid so nothing is skipped
    schema.json                    CREATE statements of all tables and indexes
    manifest.json                  row counts counted in D1 vs rows written, first/last event, sha256 per file

Read-only: plain SELECT queries, so live analytics writes are never blocked.
"""
import csv
import datetime as dt
import hashlib
import json
import os
import subprocess
import sys

DB = "bharat3d-analytics"
PAGE = 2000
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs", "analytics-export")


def d1(sql: str) -> list:
    """Run one read-only query on the remote D1 database and return its rows."""
    cmd = ["npx", "--yes", "wrangler@4", "d1", "execute", DB, "--remote", "--json", "--command", sql]
    if os.name == "nt":
        cmd = ["cmd", "/c", *cmd]
    out = subprocess.run(cmd, check=False, capture_output=True, text=True, encoding="utf-8", timeout=300).stdout
    data = json.loads(out[out.find("["):] if "[" in out else out)
    if isinstance(data, list):
        return data[0]["results"]
    raise RuntimeError(f"D1 query failed: {json.dumps(data)[:300]}")


def export_table(table: str, folder: str) -> dict:
    counted = d1(f"SELECT COUNT(*) AS n FROM {table}")[0]["n"]
    rows, last = [], None
    while True:
        where = f"WHERE rowid > {last}" if last is not None else ""
        chunk = d1(f"SELECT rowid AS __rowid, * FROM {table} {where} ORDER BY rowid LIMIT {PAGE}")
        rows += chunk
        if len(chunk) < PAGE:
            break
        last = chunk[-1]["__rowid"]
    jsonl = os.path.join(folder, f"{table}.jsonl")
    with open(jsonl, "w", encoding="utf-8") as f:
        f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in rows)
    cols = sorted({k for r in rows for k in r}, key=lambda k: (k != "__rowid", k))
    with open(os.path.join(folder, f"{table}.csv"), "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=cols)
        writer.writeheader()
        writer.writerows(rows)
    with open(jsonl, "rb") as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    return {"rows_counted_in_d1": counted, "rows_exported": len(rows), "columns": len(cols), "sha256_jsonl": digest}


def main() -> int:
    stamp = dt.datetime.now(dt.UTC).strftime("%Y-%m-%dT%H%MZ")
    folder = os.path.join(ROOT, stamp)
    os.makedirs(folder, exist_ok=True)
    schema = d1("SELECT type, name, tbl_name, sql FROM sqlite_master "
                "WHERE name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%' ORDER BY type DESC, name")
    with open(os.path.join(folder, "schema.json"), "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=1)
    manifest = {"database": DB, "exported_at_utc": stamp, "tables": {}}
    complete = True
    for table in [r["name"] for r in schema if r["type"] == "table"]:
        info = export_table(table, folder)
        manifest["tables"][table] = info
        complete &= info["rows_exported"] >= info["rows_counted_in_d1"]
        print(f"{table:18} counted {info['rows_counted_in_d1']:>7}  exported {info['rows_exported']:>7}")
    manifest["events_span"] = d1("SELECT MIN(at) AS first_event, MAX(at) AS last_event, COUNT(DISTINCT session_id) AS sessions, "
                                 "COUNT(DISTINCT ip) AS ips FROM events")[0]
    with open(os.path.join(folder, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1)
    print(f"saved to {folder}  ({'complete' if complete else 'INCOMPLETE: rerun'})  span {manifest['events_span']}")
    return 0 if complete else 1


if __name__ == "__main__":
    sys.exit(main())
