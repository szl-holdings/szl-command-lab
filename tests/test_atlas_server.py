from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT))

import server


def test_five_organ_fallback_or_substrate_fail_closes() -> None:
    healthy = server.evaluate_anatomy(seed=11)
    tampered = server.evaluate_anatomy(tamper_chain=True, seed=11)
    assert healthy["live_count"] == 5
    assert healthy["blocked"] is False
    assert healthy["proven_trust"] is False
    assert tampered["blocked"] is True
    assert tampered["verdict"] == "BLOCKED"


def test_catalog_is_exact_public_inventory(monkeypatch) -> None:
    fixtures = {
        "models": [
            {
                "id": "SZLHOLDINGS/SZL-Khipu-1.5B",
                "downloads": 1102,
                "likes": 4,
                "lastModified": "2026-09-03T00:00:00Z",
                "pipeline_tag": "text-generation",
                "tags": ["transformers", "governed-ai"],
                "sha": "a" * 40,
            },
            {"id": "SZLHOLDINGS/private-model", "private": True},
        ],
        "datasets": [{"id": "SZLHOLDINGS/szl-lake", "downloads": 12}],
        "spaces": [{"id": "SZLHOLDINGS/a11oy", "sdk": "docker"}],
        "kernels": [{"id": "SZLHOLDINGS/szl-lambda-gate", "downloads": 8}],
    }

    monkeypatch.setattr(server, "_provider_rows", lambda kind: fixtures[kind])
    monkeypatch.setattr(server, "_catalog_cache", None)
    monkeypatch.setattr(server, "_catalog_at", 0.0)

    payload = server.recapture_catalog(force=True)
    assert payload["state"] == "VERIFIED_PUBLIC_LISTING"
    assert payload["counts"] == {
        "models": 1,
        "datasets": 1,
        "spaces": 1,
        "kernels": 1,
        "assets": 4,
    }
    assert all(not item["private"] for item in payload["assets"])
    assert {item["type"] for item in payload["assets"]} == {
        "model",
        "dataset",
        "space",
        "kernel",
    }


def test_catalog_partial_state_never_fabricates_missing_family(monkeypatch) -> None:
    def rows(kind: str):
        if kind == "models":
            return [{"id": "SZLHOLDINGS/szl-nemo"}]
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(server, "_provider_rows", rows)
    monkeypatch.setattr(server, "_catalog_cache", None)
    monkeypatch.setattr(server, "_catalog_at", 0.0)

    payload = server.recapture_catalog(force=True)
    assert payload["state"] == "PARTIAL"
    assert payload["counts"]["models"] == 1
    assert payload["counts"]["datasets"] == 0
    assert set(payload["errors"]) == {"datasets", "spaces", "kernels"}


def test_build_info_labels_missing_revision() -> None:
    info = server.build_info()
    assert info["surface"] == "SZL Atlas"
    assert info["source_repository"] == "szl-holdings/szl-command-lab"
    assert info["state"] in {"SOURCE_BOUND", "REVISION_UNAVAILABLE"}


def test_index_contains_accessible_atlas_contract() -> None:
    index = Path(__file__).parents[1] / "space" / "index.html"
    text = index.read_text(encoding="utf-8")
    assert 'data-szl-surface="atlas-v1"' in text
    assert "Every listed artifact. One search." in text
    assert "prefers-reduced-motion" in text
    assert "/api/catalog" in text
    assert "Skip to content" in text


def test_catalog_payload_is_json_serializable(monkeypatch) -> None:
    monkeypatch.setattr(server, "_provider_rows", lambda _kind: [])
    monkeypatch.setattr(server, "_catalog_cache", None)
    monkeypatch.setattr(server, "_catalog_at", 0.0)
    payload = server.recapture_catalog(force=True)
    json.dumps(payload, allow_nan=False)
