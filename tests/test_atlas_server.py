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


def test_build_info_labels_missing_revision(monkeypatch) -> None:
    monkeypatch.delenv("SZL_GIT_SHA", raising=False)
    monkeypatch.delenv("GITHUB_SHA", raising=False)
    info = server.build_info()
    assert info["surface"] == "SZL Atlas"
    assert info["source_repository"] == "szl-holdings/szl-command-lab"
    assert info["source_revision"] is None
    assert info["state"] == "REVISION_UNAVAILABLE"
    assert info["receipt_minted"] is False
    assert "build" not in info
    assert info["components"]["yarqa"] == {
        "repository": "szl-holdings/yarqa",
        "revision": "a5e74026ee0c24f45a0b0405ee849720ca520302",
        "version": "0.5.0",
        "binding": "UNBOUND_OR_MISMATCHED",
    }


def test_build_info_exposes_canonical_observed_build(monkeypatch) -> None:
    revision = "b5dd00adb30889830661c621f437fdedf29a8ae2"
    monkeypatch.setenv("SZL_GIT_SHA", revision)
    monkeypatch.setenv("GITHUB_SHA", "f" * 40)

    info = server.build_info()

    assert info["source_revision"] == revision
    assert info["state"] == "SOURCE_BOUND"
    assert info["build"] == {"state": "OBSERVED", "revision": revision}
    assert info["receipt_minted"] is False


def test_build_info_uses_github_revision_only_when_primary_is_absent(monkeypatch) -> None:
    revision = "a" * 40
    monkeypatch.delenv("SZL_GIT_SHA", raising=False)
    monkeypatch.setenv("GITHUB_SHA", revision)

    info = server.build_info()

    assert info["build"] == {"state": "OBSERVED", "revision": revision}
    assert info["source_revision"] == revision


def test_build_info_fails_closed_on_malformed_primary_revision(monkeypatch) -> None:
    monkeypatch.setenv("GITHUB_SHA", "a" * 40)
    for malformed in ("", "abc", "A" * 40, "g" * 40, " " + "b" * 40, "b" * 40 + "\n"):
        monkeypatch.setenv("SZL_GIT_SHA", malformed)
        info = server.build_info()
        if malformed == "":
            assert info["build"] == {"state": "OBSERVED", "revision": "a" * 40}
            continue
        assert info["source_revision"] is None
        assert info["state"] == "REVISION_UNAVAILABLE"
        assert info["receipt_minted"] is False
        assert "build" not in info


def test_yarqa_runtime_fails_closed_when_dependency_is_unavailable(monkeypatch) -> None:
    def unavailable():
        raise ImportError("test-only unavailable runtime")

    monkeypatch.delenv("SZL_YARQA_SHA", raising=False)
    monkeypatch.setattr(server, "_load_yarqa_runtime", unavailable)
    payload = server.run_yarqa_demo()
    assert payload["ok"] is False
    assert payload["state"] == "UNAVAILABLE"
    assert payload["failure_code"] == "YARQA_RUNTIME_UNAVAILABLE"
    assert "labels" not in payload
    assert "receipt" not in payload


def test_yarqa_source_and_deployment_contract_are_exact() -> None:
    root = Path(__file__).parents[1]
    dockerfile = (root / "Dockerfile").read_text(encoding="utf-8")
    workflow = (root / ".github" / "workflows" / "hf-sync.yml").read_text(encoding="utf-8")
    revision = server.YARQA_SOURCE_REVISION
    assert revision in dockerfile
    assert "YARQA_ARCHIVE_SHA256=8aa133830078eb519d0806ce197ec45d62f19fe363ac5d1d968a65705c315483" in dockerfile
    assert "NUMPY_VERSION=2.5.2" in dockerfile
    assert "SZLHOLDINGS/szl-command-lab" in workflow
    assert "/api/yarqa" in workflow
    assert "require-default-branch-tip: true" in workflow
    assert "source-revision-probe-path: /api/build-info" in workflow


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
