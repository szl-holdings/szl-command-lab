# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 SZL Holdings
"""Reserved-profile membership must follow public metadata, never a fixed offset."""
from __future__ import annotations

import io
import json
from urllib.error import HTTPError, URLError

import pytest

import server


PROFILE = {"id": "SZLHOLDINGS/README", "private": False, "sdk": "static", "sha": "a" * 40}


def catalog_fixture(monkeypatch, spaces=None):
    monkeypatch.setattr(server, "_catalog_cache", None)
    monkeypatch.setattr(server, "_catalog_at", 0.0)
    monkeypatch.setattr(server, "_catalog_snapshots", {})
    families = {
        "models": [{"id": "SZLHOLDINGS/shared-kernel", "private": False}],
        "kernels": [{"id": "SZLHOLDINGS/shared-kernel", "private": False}],
        "datasets": [{"id": "SZLHOLDINGS/data", "private": False}],
        "spaces": spaces if spaces is not None else [{"id": "SZLHOLDINGS/a11oy", "private": False}],
    }
    monkeypatch.setattr(server, "_provider_rows", lambda kind: list(families[kind]))
    return families


def profile_response(monkeypatch, row):
    def read(url, **kwargs):
        assert url == "https://huggingface.co/api/spaces/SZLHOLDINGS/README"
        assert kwargs == {"max_bytes": server.MAX_INDEX_BYTES, "exact_url": True}
        return json.dumps(row).encode()
    monkeypatch.setattr(server, "_request_bytes", read)


def test_missing_author_entry_is_added_from_exact_public_metadata(monkeypatch):
    catalog_fixture(monkeypatch)
    profile_response(monkeypatch, PROFILE)
    result = server.recapture_catalog(force=True)
    assert result["state"] == "VERIFIED_PUBLIC_LISTING"
    assert result["counts"] == {"models": 1, "kernels": 1, "datasets": 1, "spaces": 2, "assets": 5}
    profile = next(row for row in result["assets"] if row["id"] == PROFILE["id"])
    assert profile["type"] == "space"
    assert profile["role"] == "organization_profile"
    assert profile["role_label"] == "Organization profile"
    assert profile["href"] == "https://huggingface.co/spaces/SZLHOLDINGS/README"
    assert profile["sha"] == PROFILE["sha"]
    assert result["reserved_profile"]["state"] == "PUBLIC_METADATA"
    assert len(result["reserved_profile"]["response_sha256"]) == 64
    # The same ID in two native namespaces remains two records, never two models.
    assert len([row for row in result["assets"] if row["id"].endswith("shared-kernel")]) == 2


def test_already_listed_profile_is_not_requested_or_counted_twice(monkeypatch):
    catalog_fixture(monkeypatch, [dict(PROFILE), dict(PROFILE)])
    def unexpected():
        raise AssertionError("author-listed public profile needs no supplemental request")
    monkeypatch.setattr(server, "_reserved_profile", unexpected)
    result = server.recapture_catalog(force=True)
    assert result["state"] == "VERIFIED_PUBLIC_LISTING"
    assert result["counts"]["spaces"] == 1
    assert result["reserved_profile"]["state"] == "AUTHOR_LIST"


def test_404_is_observed_absence_and_adds_no_record(monkeypatch):
    catalog_fixture(monkeypatch)
    def missing(url, **_kwargs):
        raise HTTPError(url, 404, "Not Found", {}, io.BytesIO())
    monkeypatch.setattr(server, "_request_bytes", missing)
    result = server.recapture_catalog(force=True)
    assert result["state"] == "VERIFIED_PUBLIC_LISTING"
    assert result["counts"]["spaces"] == 1
    assert result["reserved_profile"]["state"] == "NOT_PUBLICLY_OBSERVABLE"
    assert result["reserved_profile"]["http_status"] == 404


def test_explicit_private_profile_is_excluded(monkeypatch):
    catalog_fixture(monkeypatch)
    profile_response(monkeypatch, {**PROFILE, "private": True})
    result = server.recapture_catalog(force=True)
    assert result["state"] == "VERIFIED_PUBLIC_LISTING"
    assert result["counts"]["spaces"] == 1
    assert result["reserved_profile"]["state"] == "EXPLICITLY_NON_PUBLIC"
    assert not any(row["id"] == PROFILE["id"] for row in result["assets"])


@pytest.mark.parametrize("error", [
    HTTPError(server.RESERVED_PROFILE_URL, 403, "Forbidden", {}, io.BytesIO()),
    HTTPError(server.RESERVED_PROFILE_URL, 503, "Unavailable", {}, io.BytesIO()),
    URLError("unavailable"),
    TimeoutError(),
])
def test_unavailable_lookup_preserves_observed_rows_but_marks_partial(monkeypatch, error):
    catalog_fixture(monkeypatch)
    def unavailable(_url, **_kwargs):
        raise error
    monkeypatch.setattr(server, "_request_bytes", unavailable)
    result = server.recapture_catalog(force=True)
    assert result["state"] == "PARTIAL"
    assert result["counts"] == {"models": 1, "kernels": 1, "datasets": 1, "spaces": 1, "assets": 4}
    assert set(result["errors"]) == {"reserved_profile"}
    assert result["reserved_profile"]["state"] == "UNAVAILABLE"


@pytest.mark.parametrize("row", [
    None, [], {"id": "OTHER/README", "private": False},
    {"id": PROFILE["id"]}, {**PROFILE, "private": "false"}, {**PROFILE, "private": 0},
])
def test_wrong_identity_or_unknown_visibility_cannot_inflate_count(monkeypatch, row):
    catalog_fixture(monkeypatch)
    profile_response(monkeypatch, row)
    result = server.recapture_catalog(force=True)
    assert result["state"] == "PARTIAL"
    assert result["counts"]["spaces"] == 1
    assert not any(asset["id"] == PROFILE["id"] for asset in result["assets"])


def test_author_entry_with_unknown_visibility_requires_public_confirmation(monkeypatch):
    catalog_fixture(monkeypatch, [{"id": PROFILE["id"]}])
    profile_response(monkeypatch, {**PROFILE, "private": True})
    result = server.recapture_catalog(force=True)
    assert result["counts"]["spaces"] == 0
    assert result["reserved_profile"]["state"] == "EXPLICITLY_NON_PUBLIC"


def test_slug_fallback_cannot_substitute_for_reserved_profile_identity(monkeypatch):
    catalog_fixture(monkeypatch, [{"id": "OTHER/README", "name": "README", "private": False}])
    profile_response(monkeypatch, {**PROFILE, "private": True})
    result = server.recapture_catalog(force=True)
    assert result["counts"]["spaces"] == 0
    assert result["reserved_profile"]["state"] == "EXPLICITLY_NON_PUBLIC"


@pytest.mark.parametrize("url,status,headers", [
    ("https://example.com/not-the-profile", 200, {}),
    (server.RESERVED_PROFILE_URL, 202, {}),
    (server.RESERVED_PROFILE_URL, 200, {"Link": '<https://example.com/next>; rel="next"'}),
])
def test_metadata_must_come_from_the_exact_complete_endpoint(monkeypatch, url, status, headers):
    class Response(io.BytesIO):
        def geturl(self):
            return url
    response = Response(json.dumps(PROFILE).encode())
    response.status = status
    response.headers = headers
    monkeypatch.setattr(server, "urlopen", lambda *_args, **_kwargs: response)
    with pytest.raises(ValueError, match="endpoint response"):
        server._reserved_profile()


def test_profile_role_is_specific_to_the_reserved_space():
    assert server._normalize_asset(PROFILE, "models")["role"] == "artifact"
    assert server._normalize_asset({**PROFILE, "id": "SZLHOLDINGS/a11oy"}, "spaces")["role"] == "artifact"
