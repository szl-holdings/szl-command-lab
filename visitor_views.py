#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Escaped Python rendering for the Atlas's first owned visitor demo views."""
from __future__ import annotations

from html import escape
from urllib.parse import unquote

import demo_adapters as adapters


def _e(value: object) -> str:
    return escape(str(value), quote=True)


def _page(title: str, content: str) -> bytes:
    # content is assembled only by the renderers below; every interpolated value is escaped.
    return f"""<!doctype html>
<html lang="en" data-szl-surface="atlas-demo-v1" data-surface="dark" data-szl-holo-disabled="native-atlas">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="dark">
  <title>{_e(title)} · SZL Atlas</title>
  <link rel="stylesheet" href="/szl-holo-v2.css">
  <link rel="stylesheet" href="/szl-tokens.css?v=81f7c9baeef0">
  <link rel="stylesheet" href="/atlas-demos.css?v=58fdd39d56eb">
  <link rel="icon" type="image/svg+xml" href="/szl-orbit-icon.svg">

</head>
<body>
  <a class="skip" href="#main">Skip to demos</a>
  <header><div class="shell nav">
    <a class="brand" href="/"><img class="native-mark" src="/szl-orbit-icon.svg" alt="" width="40" height="40">SZL Atlas</a>
    <nav class="nav-links" aria-label="Demo navigation">
      <a href="/#loop">Anatomy demo</a><a href="/demos">Demo index</a>
      <a href="/launchpad">Launchpad</a><a href="https://a-11-oy.com">Enter A11oy ↗</a>
    </nav>
  </div></header>
  <main class="shell" id="main">{content}</main>
  <footer><div class="shell">Fixed public fixtures · Advisory evidence · Authority NONE ·
    <a href="/api/demo-adapters">Inspect adapter registry</a> ·
    <a href="https://a11oy.net">Independent proof registry ↗</a></div></footer>
</body></html>""".encode("utf-8")


def _choices(kind: str, ids: tuple[str, ...], current: str | None = None) -> str:
    return '<nav class="choices" aria-label="Fixed demo fixtures">' + "".join(
        f'<a class="choice" href="/demos/{_e(kind)}/{_e(ident)}"'
        + (' aria-current="page"' if current == ident else "")
        + f'>{_e(ident.replace("-", " ").title())}</a>'
        for ident in ids
    ) + "</nav>"


def _index() -> bytes:
    content = """<p class="eyebrow">Try a demo</p>
<h1>Inspect a bounded result.</h1>
<p class="lede">These read-only examples run in Python over small committed public
fixtures. They do not fetch visitor URLs, accept uploads, sign receipts, or grant
action authority.</p>
<div class="grid">
  <article class="card"><h2>Retrieve from a public corpus</h2>
    <p>Compare a fixed question against five short, source-linked documents with
    the SZL BM25 package. The ranking is a lexical demonstration, not a quality benchmark.</p>
    <a href="/demos/retrieval">Try retrieval →</a></article>
  <article class="card"><h2>Verify a receipt fixture</h2>
    <p>Inspect intact, tampered, and unsigned records with the SZL receipt verifier.
    Hash and chain integrity, signature verification, and scientific validity are separate.</p>
    <a href="/demos/receipts">Try receipt verification →</a></article>
</div>
<p class="fine">The existing five-organ anatomy demo remains at
<a href="/#loop">Atlas / Try a demo</a>. Healthy checks remain ADVISORY DEMO;
energy may be UNAVAILABLE and Conjecture 1 remains OPEN.</p>"""
    return _page("Try a demo", content)


def _retrieval(query_id: str | None) -> bytes:
    choices = _choices("retrieval", ("inventory", "product", "proof"), query_id)
    intro = """<p class="eyebrow">Fixed retrieval demonstration</p>
<h1>Find a source, inspect its limit.</h1>
<p class="lede">Choose one committed question. BM25 ranks five small public documents
locally. Results show lexical scores only; no model inference or scientific evaluation runs.</p>"""
    if query_id is None:
        return _page("Retrieval demo", intro + choices)
    if query_id not in adapters.QUERY_IDS:
        raise adapters.UnknownFixture(query_id)
    result = adapters.retrieval_demo(query_id)
    rows = []
    for row in result["results"]:
        rows.append(
            '<article class="result"><p class="eyebrow">Rank ' + _e(row["rank"])
            + " · lexical score " + _e(f'{row["score"]:.4f}') + "</p><h2>"
            + _e(row["title"]) + "</h2><p>" + _e(row["text"]) + '</p><a href="'
            + _e(row["source"]) + '" target="_blank" rel="noopener noreferrer">Inspect source ↗</a></article>'
        )
    body = (intro + choices + '<p class="status" role="status" aria-live="polite">'
        + "FIXED DEMO · " + _e(result["query"]) + " · Authority NONE</p>"
        + "".join(rows)
        + '<p class="fine">Scientific validity: NOT EVALUATED. Ranking is not a readiness, relevance, or accuracy certificate.</p>')
    return _page("Retrieval result", body)


def _receipt(fixture_id: str | None) -> bytes:
    intro = """<p class="eyebrow">Fixed receipt verification</p>
<h1>See which check passed.</h1>
<p class="lede">These committed records are public, synthetic, and unsigned.
No private key is loaded. Structural and hash integrity can pass while signature
verification is skipped. Neither check establishes that a decision was correct.</p>"""
    choices = _choices("receipts", ("intact", "tampered", "unsigned"), fixture_id)
    if fixture_id is None:
        return _page("Receipt demo", intro + choices)
    if fixture_id not in adapters.RECEIPT_IDS:
        raise adapters.UnknownFixture(fixture_id)
    result = adapters.receipt_demo(fixture_id)
    status_class = "status fail" if result["integrity"] == "FAIL" else "status"
    report = "\n".join(result["report"])
    body = (intro + choices
        + f'<p class="{status_class}" role="status" aria-live="polite">'
        + "Fixture " + _e(fixture_id) + " · integrity " + _e(result["integrity"])
        + " · signature " + _e(result["signature"]) + "</p>"
        + '<section class="result" aria-label="Separate verification outcomes"><dl>'
        + "<dt>Structure, hash, fields, chain</dt><dd>" + _e(result["integrity"]) + "</dd>"
        + "<dt>Signature</dt><dd>" + _e(result["signature"]) + " — no public key check</dd>"
        + "<dt>Scientific validity</dt><dd>" + _e(result["scientific_validity"]) + "</dd>"
        + "<dt>Action authority</dt><dd>NONE</dd>"
        + "</dl></section>"
        + '<details><summary>Read package verifier report</summary><pre class="report">'
        + _e(report) + "</pre></details>"
        + '<p class="fine">The package verifier can return true while signature verification is SKIP. An unsigned hash is not issuer authentication.</p>')
    return _page("Receipt result", body)


def render(path: str) -> tuple[int, bytes] | None:
    """Resolve only the owned GET/HEAD paths. Existing Atlas routes stay unchanged."""
    if not (path == "/demos" or path.startswith("/demos/")):
        return None
    parts = path.strip("/").split("/")
    try:
        if parts == ["demos"]:
            return 200, _index()
        if parts == ["demos", "retrieval"]:
            return 200, _retrieval(None)
        if parts == ["demos", "receipts"]:
            return 200, _receipt(None)
        if len(parts) == 3 and parts[1] == "retrieval":
            return 200, _retrieval(unquote(parts[2]))
        if len(parts) == 3 and parts[1] == "receipts":
            return 200, _receipt(unquote(parts[2]))
    except adapters.UnknownFixture:
        # Unknown fixed IDs fall through to the escaped 404 below.
        pass
    except (adapters.DemoUnavailable, TimeoutError, OSError, ValueError, TypeError, KeyError, IndexError):
        return 503, _page("Demo unavailable", '<p class="eyebrow">Unavailable</p><h1>The bounded demo could not complete.</h1><p role="status">No successful result is claimed. <a href="/demos">Return to demos</a>.</p>')
    label = unquote(path[:80])
    return 404, _page("Fixture not found", '<p class="eyebrow">Not found</p><h1>Unknown demo fixture.</h1><p role="status">No adapter ran for <code>' + _e(label) + '</code>.</p><p><a href="/demos">Choose a fixed demo</a>.</p>')
