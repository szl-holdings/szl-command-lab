# SPDX-License-Identifier: Apache-2.0
"""Bounded public demo contracts: package truth, escaping, transport, and failure."""
from __future__ import annotations

import base64
import hashlib
import io
import json
from pathlib import Path
from unittest.mock import patch
from urllib.parse import quote

import demo_adapters
import gateway
import server
import visitor_views
from szl_guardrail_receipt._canonical import canonical_json, dsse_pae

ROOT = Path(__file__).parents[1]


def _capture(method: str, path: str):
    handler = object.__new__(gateway.Handler)
    handler.path = path
    handler.wfile = io.BytesIO()
    statuses = []
    headers = {}
    handler.send_response = statuses.append
    handler.send_header = lambda key, value: headers.__setitem__(key, value)
    handler.end_headers = lambda: None
    with (
        patch.object(server, "_request_bytes", side_effect=AssertionError("network")),
        patch.object(server, "recapture_catalog", side_effect=AssertionError("catalog")),
        patch.object(server, "recapture_estate", side_effect=AssertionError("estate")),
        patch.object(server, "evaluate_anatomy", side_effect=AssertionError("anatomy")),
    ):
        getattr(handler, method)()
    return statuses[0], headers, handler.wfile.getvalue()


def test_registry_uses_installed_distribution_and_surface_authority() -> None:
    payload = demo_adapters.registry_payload()
    assert payload["schema"] == "szl.atlas.adapters/v1"
    assert payload["surface_id"] == "szl-command-lab"
    assert payload["surface_href"] == next(row[2] for row in server.SURFACES if row[0] == "szl-command-lab")
    assert payload["authority"] == "NONE"
    assert payload["public_effectors"] == []
    assert len(payload["adapters"]) == 2
    for row in payload["adapters"]:
        assert row["state"] == "AVAILABLE"
        assert row["authority"] == "NONE"
        assert row["effects"] == []
        assert len(row["source_revision"]) == 40
        assert len(row["wheel_sha256"]) == 64


def test_retrieval_is_deterministic_and_bounded() -> None:
    for query_id in demo_adapters.QUERY_IDS:
        first = demo_adapters.retrieval_demo(query_id)
        assert first == demo_adapters.retrieval_demo(query_id)
        assert first["state"] == "FIXED_DEMO"
        assert first["authority"] == "NONE"
        assert first["scientific_validity"] == "NOT_EVALUATED"
        assert len(first["results"]) == 3
        assert len({item["id"] for item in first["results"]}) == 3
    assert demo_adapters.retrieval_demo("inventory")["results"][0]["id"] == "atlas"
    assert demo_adapters.retrieval_demo("product")["results"][0]["id"] == "a11oy"
    assert demo_adapters.retrieval_demo("proof")["results"][0]["id"] == "proof-registry"


def test_receipt_integrity_signature_and_validity_are_separate() -> None:
    intact = demo_adapters.receipt_demo("intact")
    tampered = demo_adapters.receipt_demo("tampered")
    unsigned = demo_adapters.receipt_demo("unsigned")
    assert intact["integrity"] == "PASS"
    assert intact["package_verifier_ok"] is True
    assert intact["signature"] == "SKIP"
    assert tampered["integrity"] == "FAIL"
    assert tampered["package_verifier_ok"] is False
    assert tampered["signature"] == "SKIP"
    assert unsigned["integrity"] == "PASS"
    assert unsigned["signature"] == "SKIP"
    assert all(row["scientific_validity"] == "NOT_EVALUATED" for row in (intact, tampered, unsigned))
    assert all(row["authority"] == "NONE" for row in (intact, tampered, unsigned))


def test_app_rechecks_body_digest_even_when_package_boolean_is_true() -> None:
    records = json.loads((ROOT / "demo_data" / "receipts" / "unsigned.json").read_text(encoding="utf-8"))
    envelope = records[0]["envelope"]
    body = json.loads(base64.b64decode(envelope["payload"]))
    body["digest"] = "0" * 64
    payload = canonical_json(body)
    envelope["payload"] = base64.b64encode(payload).decode("ascii")
    envelope["_pae_sha256"] = hashlib.sha256(dsse_pae(envelope["payloadType"], payload)).hexdigest()
    assert demo_adapters.verify_records(records)[0] is True
    with patch.object(demo_adapters, "_read_fixed", return_value=records):
        result = demo_adapters.receipt_demo("unsigned")
    assert result["package_verifier_ok"] is True
    assert result["integrity"] == "FAIL"
    assert result["signature"] == "SKIP"


def test_unknown_ids_never_invoke_packages_and_escape_output() -> None:
    malicious = "<img src=x onerror=alert(1)>"
    path = "/demos/retrieval/" + quote(malicious, safe="")
    with patch.object(demo_adapters, "retrieval_demo", side_effect=AssertionError("ran")):
        status, html = visitor_views.render(path)
    assert status == 404
    assert b"&lt;img" in html
    assert b"<img src=x" not in html
    assert b"No adapter ran" in html
    assert visitor_views.render("/demos/receipts/not-registered")[0] == 404


def test_rendering_escapes_package_results() -> None:
    dangerous = {"query_id": "inventory", "query": "<script>alert(1)</script>",
        "state": "FIXED_DEMO", "authority": "NONE", "results": [
            {"rank": 1, "score": 1.0, "id": "x", "title": "<b>unsafe</b>",
             "text": '" onmouseover="alert(1)', "source": "https://a11oy.net"}
        ]}
    with patch.object(demo_adapters, "retrieval_demo", return_value=dangerous):
        status, html = visitor_views.render("/demos/retrieval/inventory")
    assert status == 200
    assert b"<script>alert(1)</script>" not in html
    assert b"&lt;script&gt;" in html
    assert b"&lt;b&gt;unsafe&lt;/b&gt;" in html
    assert b"&quot; onmouseover=&quot;" in html


def test_timeouts_fail_closed() -> None:
    with patch.object(demo_adapters, "retrieval_demo", side_effect=TimeoutError):
        status, html = visitor_views.render("/demos/retrieval/inventory")
    assert status == 503
    assert b"No successful result is claimed" in html
    with patch.object(demo_adapters, "verify_records", side_effect=TimeoutError):
        status, html = visitor_views.render("/demos/receipts/intact")
    assert status == 503
    assert b"No successful result is claimed" in html


def test_get_head_and_existing_security_boundary() -> None:
    for path in ("/demos", "/demos/retrieval", "/demos/retrieval/inventory",
                 "/demos/receipts", "/demos/receipts/intact", "/demos/receipts/tampered",
                 "/demos/receipts/unsigned", "/demos/retrieval/unknown", "/api/demo-adapters"):
        get_status, get_headers, body = _capture("do_GET", path)
        head_status, head_headers, head_body = _capture("do_HEAD", path)
        assert get_status == head_status
        assert get_status in (200, 404)
        assert int(get_headers["Content-Length"]) == len(body)
        assert head_headers["Content-Length"] == get_headers["Content-Length"]
        assert head_body == b""
        assert "form-action 'none'" in get_headers["Content-Security-Policy"]
        assert get_headers["Cache-Control"] == "no-store"
        if path == "/api/demo-adapters":
            assert json.loads(body)["authority"] == "NONE"
        else:
            assert b"<form" not in body
    assert _capture("do_GET", "/launchpad")[0] == 200
    assert _capture("do_GET", "/")[0] == 200


def test_atlas_entry_and_status_accessibility() -> None:
    index = (ROOT / "space" / "index.html").read_text(encoding="utf-8")
    launchpad = (ROOT / "space" / "launchpad.html").read_text(encoding="utf-8")
    assert '<a class="nav-link" href="#loop">Try a demo</a>' in index
    assert 'id="loop-result" role="status" aria-live="polite" aria-atomic="true"' in index
    assert "alignDemoAnchor" in index
    assert "font: 14px/1.55 var(--sans)" in index
    assert 'href="/demos"' in launchpad
