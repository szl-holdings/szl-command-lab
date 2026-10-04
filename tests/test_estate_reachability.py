"""An HTTP probe measures reachability, never a remote capability verdict."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT))

import server


LOCAL = ("local", "Synthetic local kernel", "https://example.invalid/local", None)
REMOTE = (
    "remote",
    "Remote surface",
    "https://example.invalid/remote",
    "https://example.invalid/healthz",
)


@pytest.fixture(autouse=True)
def isolated_estate(monkeypatch):
    """No provider, hardware, or actual network access is allowed in this suite."""
    body = {
        "live_count": 5,
        "blocked": False,
        "verdict": "ADVISORY_BODY",
        "reason": "Synthetic fixture only",
        "organs": [],
    }
    clock = {"now": 1000.0}

    def no_network(*_args, **_kwargs):
        pytest.fail("unexpected external network request")

    monkeypatch.setattr(server, "urlopen", no_network)
    monkeypatch.setattr(server, "probe", lambda: {"honesty": "UNAVAILABLE"})
    monkeypatch.setattr(server, "evaluate_anatomy", lambda **_kwargs: body)
    monkeypatch.setattr(server, "SURFACES", (LOCAL, REMOTE))
    monkeypatch.setattr(server, "_estate_cache", None)
    monkeypatch.setattr(server, "_estate_at", 0.0)
    monkeypatch.setattr(server.time, "monotonic", lambda: clock["now"])
    return body, clock


@pytest.mark.parametrize(
    "response_body",
    [
        "{broken",
        '{"ok": false, "ready": false, "error": "unavailable"}',
        "[]",
        '[{"ok": true}]',
        "<!doctype html><html><body>Application error</body></html>",
        " \n\t ",
        '{"ok": true, "ready": true, "status": "LIVE"}',
        "plain response",
    ],
    ids=[
        "malformed-json",
        "json-error",
        "empty-array",
        "healthy-looking-array",
        "html",
        "whitespace",
        "healthy-looking-json",
        "plain-text",
    ],
)
def test_remote_http_200_is_only_reachability(monkeypatch, response_body):
    monkeypatch.setattr(server, "_hit", lambda _url: (200, response_body))

    payload = server.recapture_estate(force=True)
    local, remote = payload["surfaces"]

    assert remote["honesty"] == "MEASURED"
    assert remote["http"] == 200
    assert remote["reachable"] is True
    assert remote["evidence_scope"] == "http_reachability"
    assert remote["detail"] == "HTTP 200; reachability only, capability UNKNOWN"
    assert local["honesty"] == "SIMULATED"
    assert local["http"] is None
    assert local["reachable"] is None
    assert local["evidence_scope"] == "synthetic_kernel"
    assert payload["live_surfaces"] == 0
    assert payload["simulated_surfaces"] == 1
    assert payload["reachable_surfaces"] == 1
    assert payload["kernel"]["proven_trust"] is False
    assert "HTTP 200 proves reachability only" in payload["boundary"]


@pytest.mark.parametrize("status", [201, 301, 401, 404, 500, 503, None])
def test_non_200_or_missing_response_is_unavailable(monkeypatch, status):
    monkeypatch.setattr(server, "_hit", lambda _url: (status, '{"ok":true}'))

    payload = server.recapture_estate(force=True)
    remote = payload["surfaces"][1]

    assert remote["honesty"] == "UNAVAILABLE"
    assert remote["http"] == status
    assert remote["reachable"] is False
    assert remote["evidence_scope"] == "http_reachability"
    assert remote["detail"] == ("no response" if status is None else f"HTTP {status}")
    assert payload["live_surfaces"] == 0
    assert payload["reachable_surfaces"] == 0


def test_transport_timeout_is_unavailable(monkeypatch):
    def timed_out(*_args, **_kwargs):
        raise TimeoutError("offline test timeout")

    monkeypatch.setattr(server, "urlopen", timed_out)

    payload = server.recapture_estate(force=True)

    assert payload["surfaces"][1]["honesty"] == "UNAVAILABLE"
    assert payload["surfaces"][1]["http"] is None
    assert payload["reachable_surfaces"] == 0


@pytest.mark.parametrize(
    "live_count,blocked,expected",
    [
        (5, False, "SIMULATED"),
        (5, True, "BLOCKED"),
        (4, True, "BLOCKED"),
        (0, True, "BLOCKED"),
        (None, True, "BLOCKED"),
        (4, False, "UNAVAILABLE"),
        (None, False, "UNAVAILABLE"),
        (5, None, "UNAVAILABLE"),
        (5, 0, "UNAVAILABLE"),
        (5, "false", "UNAVAILABLE"),
        (5.0, False, "UNAVAILABLE"),
        ("5", False, "UNAVAILABLE"),
        (True, False, "UNAVAILABLE"),
    ],
)
def test_local_kernel_is_a_strictly_bounded_simulation(
    monkeypatch, isolated_estate, live_count, blocked, expected
):
    body, _clock = isolated_estate
    body["live_count"] = live_count
    body["blocked"] = blocked
    monkeypatch.setattr(server, "_hit", lambda _url: (200, "{}"))

    payload = server.recapture_estate(force=True)

    local = payload["surfaces"][0]
    assert local["honesty"] == expected
    assert local["detail"] == "Synthetic local kernel; no runtime capability or authorization asserted"
    assert local["http"] is None
    assert local["reachable"] is None
    assert payload["kernel"]["ok"] is (expected == "SIMULATED")
    assert payload["kernel"]["proven_trust"] is False
    assert payload["live_surfaces"] == 0
    assert payload["simulated_surfaces"] == (1 if expected == "SIMULATED" else 0)
    assert payload["reachable_surfaces"] == 1


def test_mixed_estate_counts_do_not_promote_remote_json(monkeypatch):
    rows = [LOCAL]
    replies = [(200, "{broken"), (200, "{}"), (200, "<html>"), (503, "{}"), (None, "")]
    by_url = {}
    for index, reply in enumerate(replies):
        url = f"https://example.invalid/{index}/healthz"
        rows.append((f"remote-{index}", "Remote surface", url, url))
        by_url[url] = reply
    monkeypatch.setattr(server, "SURFACES", tuple(rows))
    monkeypatch.setattr(server, "_hit", lambda url: by_url[url])

    payload = server.recapture_estate(force=True)

    assert [surface["honesty"] for surface in payload["surfaces"]] == [
        "SIMULATED", "MEASURED", "MEASURED", "MEASURED", "UNAVAILABLE", "UNAVAILABLE"
    ]
    assert payload["live_surfaces"] == 0
    assert payload["simulated_surfaces"] == 1
    assert payload["reachable_surfaces"] == 3


def test_cache_reuse_forced_refresh_and_expiry(monkeypatch, isolated_estate):
    _body, clock = isolated_estate
    reply = {"value": (200, "{broken")}
    calls = []

    def hit(url):
        calls.append(url)
        return reply["value"]

    monkeypatch.setattr(server, "_hit", hit)
    first = server.recapture_estate(force=True)
    assert first["reachable_surfaces"] == 1
    assert first["live_surfaces"] == 0
    assert len(calls) == 1

    reply["value"] = (503, "{}")
    cached = server.recapture_estate()
    assert cached is first
    assert len(calls) == 1

    refreshed = server.recapture_estate(force=True)
    assert refreshed is not first
    assert refreshed["reachable_surfaces"] == 0
    assert refreshed["surfaces"][1]["honesty"] == "UNAVAILABLE"
    assert len(calls) == 2

    reply["value"] = (200, "[]")
    clock["now"] += server.ESTATE_TTL_SECONDS + 1
    expired = server.recapture_estate()
    assert expired is not refreshed
    assert expired["reachable_surfaces"] == 1
    assert expired["live_surfaces"] == 0
    assert len(calls) == 3
