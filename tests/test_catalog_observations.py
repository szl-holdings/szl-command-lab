# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 SZL Holdings
"""Provider failures must not look like zero repositories or fresh observations."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest

import server


@pytest.fixture
def catalog(monkeypatch):
    clock = {"seconds": 1000.0}
    epoch = datetime(2026, 10, 4, tzinfo=timezone.utc)
    families = {
        "models": [{"id": "SZLHOLDINGS/model-a", "private": False}],
        "kernels": [], "datasets": [], "spaces": [],
    }
    failed = set()

    def rows(family):
        if family in failed:
            raise RuntimeError(f"{family} inventory unavailable: TimeoutError")
        return list(families[family])

    monkeypatch.setattr(server, "_catalog_cache", None)
    monkeypatch.setattr(server, "_catalog_at", 0.0)
    monkeypatch.setattr(server, "_catalog_snapshots", {})
    monkeypatch.setattr(server.time, "monotonic", lambda: clock["seconds"])
    monkeypatch.setattr(server, "utc_now", lambda: (epoch + timedelta(seconds=clock["seconds"])).isoformat().replace("+00:00", "Z"))
    monkeypatch.setattr(server, "_provider_rows", rows)
    monkeypatch.setattr(server, "_reserved_profile", lambda: (None, {"state": "NOT_PUBLICLY_OBSERVABLE"}))
    return families, failed, clock


def model_rows(payload):
    return [asset for asset in payload["assets"] if asset["type"] == "model"]


def test_cold_failure_is_unknown_while_successful_empty_family_is_zero(catalog):
    _, failed, _ = catalog
    failed.add("models")
    result = server.recapture_catalog(force=True)
    assert result["state"] == "PARTIAL"
    assert result["counts"]["models"] is None
    assert result["family_observations"]["models"]["state"] == "UNAVAILABLE"
    assert result["family_observations"]["models"]["observed_at"] is None
    assert result["counts"]["datasets"] == 0
    assert result["family_observations"]["datasets"]["state"] == "FRESH"
    assert result["counts"]["assets"] == 0
    json.dumps(result, allow_nan=False)


def test_all_cold_failures_are_unavailable_without_fabricated_assets(catalog):
    families, failed, _ = catalog
    failed.update(families)
    result = server.recapture_catalog(force=True)
    assert result["state"] == "UNAVAILABLE"
    assert all(result["counts"][family] is None for family in families)
    assert result["assets"] == []


def test_failed_refresh_retains_only_public_rows_and_original_observation(catalog):
    families, failed, clock = catalog
    families["models"].append({"id": "SZLHOLDINGS/private-model", "private": True})
    first = server.recapture_catalog(force=True)
    clock["seconds"] += 60
    failed.add("models")
    second = server.recapture_catalog(force=True)
    assert second["state"] == "PARTIAL"
    assert second["counts"]["models"] == 1
    assert second["errors"]["models"].endswith("TimeoutError")
    observed = second["family_observations"]["models"]
    assert observed["state"] == "CACHED"
    assert observed["observed_at"] == first["captured_at"]
    assert observed["checked_at"] == second["captured_at"] != first["captured_at"]
    assert observed["age_seconds"] == 60
    assert model_rows(second)[0]["id"] == "SZLHOLDINGS/model-a"
    assert model_rows(second)[0]["observation_state"] == "CACHED"
    assert model_rows(second)[0]["observed_at"] == first["captured_at"]
    # Returning an observation must not mutate the previous response or snapshot.
    assert model_rows(first)[0]["observation_state"] == "FRESH"
    assert second["family_observations"]["datasets"]["state"] == "FRESH"


def test_repeated_failures_do_not_renew_expired_snapshot(catalog):
    _, failed, clock = catalog
    first = server.recapture_catalog(force=True)
    failed.add("models")
    clock["seconds"] += 700
    second = server.recapture_catalog(force=True)
    assert second["family_observations"]["models"]["state"] == "CACHED"
    clock["seconds"] += 201
    expired = server.recapture_catalog(force=True)
    assert expired["counts"]["models"] is None
    assert expired["family_observations"]["models"]["last_success_at"] == first["captured_at"]
    assert model_rows(expired) == []


def test_response_cache_cannot_extend_snapshot_lifetime(catalog):
    _, failed, clock = catalog
    server.recapture_catalog(force=True)
    failed.add("models")
    clock["seconds"] += 899
    cached = server.recapture_catalog(force=True)
    assert cached["counts"]["models"] == 1
    clock["seconds"] += 2
    expired = server.recapture_catalog()
    assert expired["counts"]["models"] is None
    assert model_rows(expired) == []


def test_success_replaces_snapshot_membership_and_timestamp(catalog):
    families, failed, clock = catalog
    first = server.recapture_catalog(force=True)
    clock["seconds"] += 90
    families["models"] = [{"id": "SZLHOLDINGS/model-b", "private": False}]
    fresh = server.recapture_catalog(force=True)
    assert fresh["family_observations"]["models"]["state"] == "FRESH"
    assert [row["id"] for row in model_rows(fresh)] == ["SZLHOLDINGS/model-b"]
    assert fresh["captured_at"] != first["captured_at"]
    failed.add("models")
    clock["seconds"] += 10
    cached = server.recapture_catalog(force=True)
    assert [row["id"] for row in model_rows(cached)] == ["SZLHOLDINGS/model-b"]
    assert cached["family_observations"]["models"]["observed_at"] == fresh["captured_at"]
    failed.clear()
    families["models"] = []
    empty = server.recapture_catalog(force=True)
    assert empty["counts"]["models"] == 0
    assert empty["family_observations"]["models"]["state"] == "FRESH"
    assert model_rows(empty) == []


def test_native_kernel_membership_is_not_inferred_from_model_tags(catalog):
    families, failed, _ = catalog
    families["models"][0]["tags"] = ["kernel", "kernels", "custom_code"]
    failed.add("kernels")
    result = server.recapture_catalog(force=True)
    assert result["counts"]["models"] == 1
    assert result["counts"]["kernels"] is None
    assert not any(row["type"] == "kernel" for row in result["assets"])


def test_cached_profile_keeps_exact_identity_and_old_evidence_time(catalog, monkeypatch):
    _, failed, clock = catalog
    profile = {"id": "SZLHOLDINGS/README", "private": False}
    monkeypatch.setattr(server, "_reserved_profile", lambda: (profile, {"state": "PUBLIC_METADATA", "response_sha256": "a" * 64}))
    first = server.recapture_catalog(force=True)
    failed.add("spaces")
    clock["seconds"] += 90
    cached = server.recapture_catalog(force=True)
    assert cached["counts"]["spaces"] == 1
    assert cached["reserved_profile"]["state"] == "CACHED"
    assert cached["reserved_profile"]["source_state"] == "PUBLIC_METADATA"
    assert cached["reserved_profile"]["observed_at"] == first["captured_at"]
    assert len([row for row in cached["assets"] if row["id"] == profile["id"]]) == 1


def test_partial_profile_lookup_does_not_replace_last_complete_space_snapshot(catalog, monkeypatch):
    families, failed, clock = catalog
    first = server.recapture_catalog(force=True)
    def unavailable():
        raise TimeoutError()
    monkeypatch.setattr(server, "_reserved_profile", unavailable)
    families["spaces"] = [{"id": "SZLHOLDINGS/new-space", "private": False}]
    clock["seconds"] += 60
    partial = server.recapture_catalog(force=True)
    assert partial["family_observations"]["spaces"]["state"] == "PARTIAL"
    assert partial["counts"]["spaces"] == 1
    failed.add("spaces")
    clock["seconds"] += 30
    cached = server.recapture_catalog(force=True)
    assert cached["counts"]["spaces"] == 0
    assert cached["family_observations"]["spaces"]["state"] == "CACHED"
    assert cached["family_observations"]["spaces"]["observed_at"] == first["captured_at"]
