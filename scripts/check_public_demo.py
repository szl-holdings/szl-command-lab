#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Read-only public demo preflight; record responses, never restart or deploy.

Run before a presentation:
  python scripts/check_public_demo.py --expected-source <git-sha> --output <dir>
Exit 0 means only that these bounded demo contracts passed at the recorded time.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
from urllib.error import HTTPError
from urllib.request import build_opener, HTTPRedirectHandler, Request

ORIGIN = "https://szlholdings-szl-command-lab.hf.space"
PINS = {
    "retrieval-bm25": ("szl-retrieval-bench", "0.3.1", "fd7bdd79573a5045934e6d65cfaf86f619cdd15c", "a9dd8aceb048e6e0c6f5f01a4b6d44fd0a755dbcf649224d91a155952563a043"),
    "receipt-verification": ("szl-guardrail-receipt", "0.1.2", "340cafd3178e80ef6ebc5ba19f389f0ce4a3253f", "e1814fa8b021f900aa3c39c0a503c58e7d8fa93165e32427d998576e044d8085"),
}
RETRIEVAL = {"inventory": "Public Atlas inventory", "product": "Governed product runtime", "proof": "Independent proof registry"}
RECEIPTS = {"intact": "PASS", "tampered": "FAIL", "unsigned": "PASS"}
PATHS = ["/demos", "/demos/retrieval", "/demos/receipts", *(f"/demos/retrieval/{key}" for key in RETRIEVAL), *(f"/demos/receipts/{key}" for key in RECEIPTS), "/api/demo-adapters", "/api/build-info", "/healthz", "/readyz"]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.headings = []
        self.heading = None

    def handle_starttag(self, tag, attrs):
        if tag == "h2":
            self.heading = []

    def handle_data(self, data):
        self.text.append(data)
        if self.heading is not None:
            self.heading.append(data)

    def handle_endtag(self, tag):
        if tag == "h2" and self.heading is not None:
            self.headings.append("".join(self.heading))
            self.heading = None


def validate(path, status, content_type, body, expected_source):
    """Return explicit contract failures; an HTTP 200 alone is insufficient."""
    failures = []

    def check(condition, message):
        if not condition:
            failures.append(message)

    check(status == 200, f"HTTP {status}, expected 200")
    if path.startswith("/demos"):
        check("text/html" in content_type, "Expected HTML")
        page = Page()
        page.feed(body)
        text = " ".join(" ".join(page.text).split())
        check("Authority NONE" in text or "authority" in text.lower() and "NONE" in text, "Authority boundary missing")
        ident = path.rsplit("/", 1)[-1]
        if path.startswith("/demos/retrieval/"):
            check("FIXED DEMO" in text, "Fixed retrieval result missing")
            check(len(page.headings) == 3 and page.headings[0] == RETRIEVAL[ident], "Retrieval ranking differs")
            check("Scientific validity: NOT EVALUATED" in text, "Validity boundary missing")
        elif path.startswith("/demos/receipts/"):
            check(f"Fixture {ident} · integrity {RECEIPTS[ident]} · signature SKIP" in text, "Receipt outcome differs")
            check("NOT_EVALUATED" in text, "Validity boundary missing")
        else:
            title = {"/demos": "Inspect a bounded result.", "/demos/retrieval": "Find a source, inspect its limit.", "/demos/receipts": "See which check passed."}[path]
            check(title in text, "Demo page missing")
        return failures
    check("application/json" in content_type, "Expected JSON")
    try:
        data = json.loads(body)
        if not isinstance(data, dict):
            raise ValueError("Expected object")
    except (ValueError, TypeError):
        return failures + ["Invalid JSON object"]
    if path in ("/api/build-info", "/api/demo-adapters"):
        check(data.get("source_revision") == expected_source, "Source revision mismatch")
        check(data.get("source_repository") == "szl-holdings/szl-command-lab", "Source repository mismatch")
    if path == "/api/demo-adapters":
        check(data.get("schema") == "szl.atlas.adapters/v1", "Adapter schema mismatch")
        check(data.get("authority") == "NONE" and data.get("public_effectors") == [], "Adapter authority boundary differs")
        rows = data.get("adapters")
        if not isinstance(rows, list) or len(rows) != 2 or any(not isinstance(r, dict) for r in rows):
            return failures + ["Expected two adapter objects"]
        check({r.get("id") for r in rows} == set(PINS), "Adapter IDs differ")
        for row in rows:
            pin = PINS.get(row.get("id"))
            check(pin == tuple(row.get(k) for k in ("distribution", "version", "source_revision", "wheel_sha256")), "Adapter pin mismatch")
            check(row.get("state") == "AVAILABLE", "Adapter unavailable")
            check(row.get("authority") == "NONE" and row.get("effects") == [], "Adapter effects differ")
    elif path == "/api/build-info":
        check(data.get("state") == "SOURCE_BOUND" and data.get("receipt_minted") is False, "Build binding differs")
    else:
        check(data.get("ok") is True, "Health check not OK")
        if path == "/readyz":
            check(data.get("ready") is True, "Runtime not ready")
    return failures


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def capture(path, output, expected_source):
    row = {"url": ORIGIN + path, "path": path, "started_at_utc": datetime.now(timezone.utc).isoformat(), "method": "GET"}
    started = time.monotonic()
    try:
        request = Request(row["url"], headers={"User-Agent": "szl-demo-preflight/1.0", "Cache-Control": "no-cache"})
        try:
            response = build_opener(NoRedirect()).open(request, timeout=15)
        except HTTPError as exc:
            response = exc
        with response:
            raw = response.read(1_000_001)
            if len(raw) > 1_000_000:
                raise ValueError("Response exceeds 1 MB bound")
            body = raw.decode("utf-8")
            row.update(status=response.status, headers=dict(response.headers), body_sha256=hashlib.sha256(raw).hexdigest())
            name = path.strip("/").replace("/", "__") + ".txt"
            (output / name).write_bytes(raw)
            row["body_file"] = name
            row["failures"] = validate(path, response.status, response.headers.get("Content-Type", ""), body, expected_source)
    except (OSError, ValueError) as exc:
        row["failures"] = [f"{type(exc).__name__}: {exc}"]
    row.update(finished_at_utc=datetime.now(timezone.utc).isoformat(), elapsed_seconds=round(time.monotonic() - started, 3))
    return row


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected-source", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.expected_source):
        parser.error("expected-source must be an exact 40-character Git SHA")
    args.output.mkdir(parents=True, exist_ok=False)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda path: capture(path, args.output, args.expected_source), PATHS))
    report = {"schema": "szl.demo-preflight/v1", "expected_source": args.expected_source, "scope": "Point-in-time fixed demo behavior; no live agent execution or authorization verified", "passed": all(not row["failures"] for row in results), "responses": results}
    (args.output / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": report["passed"], "checks": len(results), "output": str(args.output)}))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
