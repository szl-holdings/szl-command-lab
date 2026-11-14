# SPDX-License-Identifier: Apache-2.0
"""A successful transport must not hide incorrect demo behavior."""
import copy
import importlib.util
import json
from pathlib import Path

import pytest
import demo_adapters
import visitor_views

spec = importlib.util.spec_from_file_location("check_public_demo", Path(__file__).parents[1] / "scripts" / "check_public_demo.py")
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)
SHA = "4d5e904a369a20839005f595c17188868f79b67c"


@pytest.mark.parametrize("path", [path for path in preflight.PATHS if path.startswith("/demos")])
def test_shipped_demo_renderer_satisfies_preflight(path):
    status, body = visitor_views.render(path)
    assert preflight.validate(path, status, "text/html", body.decode(), SHA) == []


def test_login_page_with_http_200_is_not_a_demo():
    assert preflight.validate("/demos", 200, "text/html", "<h1>Sign in</h1>", SHA)


@pytest.mark.parametrize("fixture", ["intact", "tampered", "unsigned"])
def test_wrong_receipt_outcome_or_signature_never_passes(fixture):
    path = f"/demos/receipts/{fixture}"
    _, body = visitor_views.render(path)
    text = body.decode().replace("signature SKIP", "signature PASS")
    assert preflight.validate(path, 200, "text/html", text, SHA)
    text = body.decode().replace("integrity FAIL", "integrity PASS") if fixture == "tampered" else body.decode().replace("integrity PASS", "integrity FAIL")
    assert preflight.validate(path, 200, "text/html", text, SHA)


def test_unavailable_response_is_not_recovered_by_valid_body():
    _, body = visitor_views.render("/demos/receipts/intact")
    assert preflight.validate("/demos/receipts/intact", 503, "text/html", body.decode(), SHA)


def test_adapter_drift_and_malformed_responses_fail():
    data = demo_adapters.registry_payload()
    data["source_revision"] = SHA
    path = "/api/demo-adapters"
    assert preflight.validate(path, 200, "application/json", json.dumps(data), SHA) == []
    for field, value in (("version", "0.0.0"), ("state", "UNAVAILABLE"), ("effects", ["execute"]), ("wheel_sha256", "0" * 64)):
        changed = copy.deepcopy(data)
        changed["adapters"][0][field] = value
        assert preflight.validate(path, 200, "application/json", json.dumps(changed), SHA)
    changed = copy.deepcopy(data)
    changed["adapters"][1] = changed["adapters"][0]
    assert preflight.validate(path, 200, "application/json", json.dumps(changed), SHA)
    assert preflight.validate(path, 200, "application/json", json.dumps(data), "0" * 40)
    for text in ("<html>error</html>", "[]", "null", '{"adapters": [null, null]}'):
        assert preflight.validate(path, 200, "application/json", text, SHA)


def test_false_readiness_stays_failed():
    assert preflight.validate("/readyz", 200, "application/json", '{"ok":true,"ready":false}', SHA)
