# SPDX-License-Identifier: Apache-2.0
"""Source-binding, route, and publication regressions for the SZL Launchpad."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]

import server  # noqa: E402

PUBLISHER_PATH = ROOT / "scripts" / "publish_hf_space.py"
SPEC = importlib.util.spec_from_file_location("publish_hf_space", PUBLISHER_PATH)
assert SPEC and SPEC.loader
publisher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(publisher)


def receipt(revision: str) -> dict:
    return {
        "schema": "szl.source-deployment/v1",
        "source": {
            "repository": "szl-holdings/szl-command-lab",
            "revision": revision,
        },
        "target": {
            "repo_id": "SZLHOLDINGS/szl-command-lab",
            "repo_type": "space",
            "origin": "https://szlholdings-szl-command-lab.hf.space",
        },
        "state": "SOURCE_BOUND",
        "claim_boundary": "test fixture",
    }


def test_exact_deployment_receipt_binds_build_info(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    revision = "a" * 40
    (tmp_path / "deployment.json").write_text(
        json.dumps(receipt(revision)),
        encoding="utf-8",
    )
    monkeypatch.setattr(server, "HERE", tmp_path)
    monkeypatch.delenv("SZL_GIT_SHA", raising=False)
    monkeypatch.delenv("GITHUB_SHA", raising=False)

    build = server.build_info()
    assert build["state"] == "SOURCE_BOUND"
    assert build["source_repository"] == "szl-holdings/szl-command-lab"
    assert build["source_revision"] == revision
    assert build["binding"] == "deployment.json"


def test_conflicting_environment_and_receipt_fail_closed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / "deployment.json").write_text(
        json.dumps(receipt("a" * 40)),
        encoding="utf-8",
    )
    monkeypatch.setattr(server, "HERE", tmp_path)
    monkeypatch.setenv("SZL_GIT_SHA", "b" * 40)
    monkeypatch.delenv("GITHUB_SHA", raising=False)

    build = server.build_info()
    assert build["state"] == "SOURCE_CONFLICT"
    assert build["source_revision"] is None


def test_invalid_or_placeholder_receipt_does_not_claim_source_bound(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    placeholder = receipt("a" * 40)
    placeholder["source"]["revision"] = None
    (tmp_path / "deployment.json").write_text(
        json.dumps(placeholder),
        encoding="utf-8",
    )
    monkeypatch.setattr(server, "HERE", tmp_path)
    monkeypatch.delenv("SZL_GIT_SHA", raising=False)
    monkeypatch.delenv("GITHUB_SHA", raising=False)

    assert server._deployment_receipt() is None
    assert server.build_info()["state"] == "REVISION_UNAVAILABLE"


def test_launchpad_is_accessible_dynamic_and_dependency_free() -> None:
    text = (ROOT / "space" / "launchpad.html").read_text(encoding="utf-8")
    assert 'data-szl-surface="launchpad-v1"' in text
    assert "Skip to content" in text
    assert "min-height:44px" in text
    assert "prefers-reduced-motion" in text
    assert 'fetch("/api/catalog"' in text
    assert 'fetch("/api/build-info"' in text
    assert "fonts.googleapis.com" not in text
    assert "SZLHOLDINGS/szl-command-center" not in text
    assert "Vessels Console" not in text
    assert "/launchpad" in server.HTML_PATHS
    assert "/deployment.json" in server.JSON_PATHS


def test_html_loader_rejects_path_escape(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(server, "HERE", tmp_path)
    with pytest.raises(ValueError, match="unsupported HTML asset"):
        server._load_html("../secret")


def test_materialized_publication_closure_is_exact(tmp_path: Path) -> None:
    revision = "c" * 40
    plan = publisher.materialize(tmp_path, revision)
    actual = {
        path.relative_to(tmp_path).as_posix()
        for path in tmp_path.rglob("*")
        if path.is_file()
    }
    assert actual == publisher.EXPECTED_FILES
    assert plan["state"] == "MATERIALIZED"
    assert plan["source_revision"] == revision
    generated = json.loads(
        (tmp_path / "deployment.json").read_text(encoding="utf-8")
    )
    assert generated["source"]["repository"] == publisher.SOURCE_REPOSITORY
    assert generated["source"]["revision"] == revision
    assert generated["state"] == "SOURCE_BOUND"


def test_checked_in_deployment_document_is_honestly_unbound() -> None:
    document = json.loads((ROOT / "deployment.json").read_text(encoding="utf-8"))
    assert document["schema"] == "szl.source-deployment/v1"
    assert document["source"]["repository"] == "szl-holdings/szl-command-lab"
    assert document["source"]["revision"] is None
    assert document["state"] == "REVISION_UNAVAILABLE"
