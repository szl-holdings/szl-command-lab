#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 SZL Holdings
# Signed-off-by: Lutar, Stephen P. <stephenlutar2@gmail.com>
"""SZL Atlas public estate gateway for the Hugging Face Space.

The server deliberately uses the Python standard library for transport and serves
one static, accessible interface. Public Hub inventory is recaptured at runtime;
missing provider data is labeled PARTIAL or UNAVAILABLE rather than synthesized.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import stat
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "python"))

from atlas_energy import measure_run, probe  # noqa: E402

HF_ORG = "SZLHOLDINGS"
HF_API_ORIGIN = "https://huggingface.co"
RESERVED_PROFILE_ID = f"{HF_ORG}/README"
RESERVED_PROFILE_URL = f"{HF_API_ORIGIN}/api/spaces/{RESERVED_PROFILE_ID}"
USER_AGENT = "szl-atlas/1.0 (+https://github.com/szl-holdings/szl-command-lab)"
MAX_PROVIDER_BYTES = 8_000_000
MAX_INDEX_BYTES = 2_000_000
CATALOG_TTL_SECONDS = 120
CATALOG_SNAPSHOT_MAX_AGE_SECONDS = 900
ESTATE_TTL_SECONDS = 30
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
YARQA_SOURCE_REPOSITORY = "szl-holdings/yarqa"
YARQA_SOURCE_REVISION = "a5e74026ee0c24f45a0b0405ee849720ca520302"
YARQA_RUNTIME_VERSION = "0.5.0"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _load_yarqa_runtime() -> tuple[Any, Any, Any, Any, str]:
    import numpy as np  # type: ignore
    import yarqa  # type: ignore
    from yarqa import Mesh, compartmentalize_with_receipt, verify  # type: ignore

    return np, Mesh, compartmentalize_with_receipt, verify, str(yarqa.__version__)


def run_yarqa_demo() -> dict[str, Any]:
    """Execute one bounded synthetic YARQA run and replay its integrity receipt."""
    observed_revision = os.environ.get("SZL_YARQA_SHA", "")
    source_binding = "BOUND" if observed_revision == YARQA_SOURCE_REVISION else "UNBOUND_LOCAL"
    if observed_revision and observed_revision != YARQA_SOURCE_REVISION:
        return {
            "schema": "szl.atlas.yarqa/v1",
            "ok": False,
            "state": "FAILED_CLOSED",
            "failure_code": "YARQA_SOURCE_MISMATCH",
            "source": {
                "repository": YARQA_SOURCE_REPOSITORY,
                "revision": YARQA_SOURCE_REVISION,
                "binding": "MISMATCH",
            },
            "boundary": "No result is admitted when the installed source binding differs.",
        }

    try:
        np, Mesh, compartmentalize_with_receipt, verify, runtime_version = _load_yarqa_runtime()
        if runtime_version != YARQA_RUNTIME_VERSION:
            raise RuntimeError("unexpected YARQA runtime version")
        centers = np.asarray(
            [[0.0, 0.0], [1.0, 0.0], [2.0, 0.0], [3.0, 0.0], [4.0, 0.0], [5.0, 0.0]],
            dtype=float,
        )
        velocities = np.asarray(
            [[1.0, 0.0], [1.0, 0.0], [1.0, 0.0], [0.8, 0.2], [0.8, 0.2], [0.8, 0.2]],
            dtype=float,
        )
        neighbors = [
            np.asarray([1], dtype=int),
            np.asarray([0, 2], dtype=int),
            np.asarray([1, 3], dtype=int),
            np.asarray([2, 4], dtype=int),
            np.asarray([3, 5], dtype=int),
            np.asarray([4], dtype=int),
        ]
        mesh = Mesh(centers=centers, velocities=velocities, neighbors=neighbors)
        labels, receipt = compartmentalize_with_receipt(mesh, align_threshold=0.0)
        verification = verify(mesh, receipt)
        admitted = bool(verification.get("ok")) and len(labels) == len(centers)
        if not admitted:
            raise RuntimeError("receipt replay did not admit the result")
        return {
            "schema": "szl.atlas.yarqa/v1",
            "ok": True,
            "state": "READY",
            "failure_code": None,
            "source": {
                "repository": YARQA_SOURCE_REPOSITORY,
                "revision": YARQA_SOURCE_REVISION,
                "version": runtime_version,
                "binding": source_binding,
            },
            "input": {
                "kind": "SYNTHETIC_CANONICAL",
                "cells": int(len(centers)),
                "align_threshold": 0.0,
            },
            "result": {
                "labels": [int(value) for value in labels.tolist()],
                "n_compartments": int(receipt.n_compartments),
            },
            "receipt": {
                "digest": receipt.receipt_digest(),
                "claim_tier": receipt.claim_tier,
                "verification": verification,
                "signed": False,
            },
            "boundary": (
                "The replay verifies integrity and reproducibility for this synthetic input; "
                "it does not prove CFD correctness or authorize an external action."
            ),
        }
    except Exception:
        return {
            "schema": "szl.atlas.yarqa/v1",
            "ok": False,
            "state": "UNAVAILABLE",
            "failure_code": "YARQA_RUNTIME_UNAVAILABLE",
            "source": {
                "repository": YARQA_SOURCE_REPOSITORY,
                "revision": YARQA_SOURCE_REVISION,
                "version": YARQA_RUNTIME_VERSION,
                "binding": source_binding,
            },
            "boundary": "No labels or receipt are fabricated when the pinned runtime cannot execute.",
        }


# Prefer the source-bound substrate modules installed by the Dockerfile. The
# fallback keeps this Space auditable and operational if an older flattened
# publication omits those modules.
try:
    from kernel import evaluate_anatomy, selftest  # type: ignore
except ImportError:
    LOCKED_EIGHT = ("F1", "F4", "F7", "F11", "F12", "F18", "F19", "F22")
    YUYAY_FLOORS = (0.95, 0.95) + (0.90,) * 11
    ZERO = "0" * 64
    CHAIN_OPS = ("anatomy.brain", "anatomy.heart", "anatomy.skeleton")


    def _wgm(values: list[float], weights: list[float]) -> float:
        if len(values) != len(weights) or not values:
            return 0.0
        if any((not math.isfinite(value)) or value <= 0.0 for value in values):
            return 0.0
        if abs(sum(weights) - 1.0) >= 1e-9:
            return 0.0
        result = math.exp(sum(weight * math.log(value) for value, weight in zip(values, weights)))
        return result if math.isfinite(result) else 0.0

    def _yawar_chain(seed: int, tamper: bool) -> dict[str, Any]:
        hops: list[dict[str, Any]] = []
        previous = ZERO
        for sequence, operation in enumerate(CHAIN_OPS):
            digest = sha256_hex(f"{sequence}|{operation}|{previous}|{seed}")
            hops.append(
                {
                    "seq": sequence,
                    "op": operation,
                    "prev": previous,
                    "digest": digest,
                }
            )
            previous = digest
        if tamper and len(hops) > 1:
            hops[1] = dict(hops[1])
            hops[1]["prev"] = "deadbeef" + str(hops[1]["prev"])[8:]
        cursor = ZERO
        valid = True
        for hop in hops:
            expected = sha256_hex(f"{hop['seq']}|{hop['op']}|{hop['prev']}|{seed}")
            if hop["prev"] != cursor or expected != hop["digest"]:
                valid = False
                break
            cursor = hop["digest"]
        return {"ok": valid, "head": hops[-1]["digest"] if hops else ZERO}

    def evaluate_anatomy(
        *,
        zero_heart: bool = False,
        tamper_chain: bool = False,
        fabricate_joule: bool = False,
        seed: int = 11,
    ) -> dict[str, Any]:
        axes = list(YUYAY_FLOORS)
        if zero_heart:
            axes[0] = 0.0
        weights = [1.0 / len(axes)] * len(axes)
        lambda_value = _wgm(axes, weights)
        chain = _yawar_chain(int(seed), bool(tamper_chain))
        organs = [
            {"name": "BRAIN", "status": "LIVE", "honesty": "LIVE"},
            {
                "name": "HEART",
                "status": "DOWN" if lambda_value == 0.0 else "LIVE",
                "honesty": "ADVISORY",
            },
            {
                "name": "CIRCULATORY",
                "status": "DOWN" if not chain["ok"] else "LIVE",
                "honesty": "LIVE",
            },
            {
                "name": "NERVOUS",
                "status": "DOWN" if fabricate_joule else "LIVE",
                "honesty": "UNAVAILABLE",
            },
            {"name": "SKELETON", "status": "LIVE", "honesty": "ADVISORY"},
        ]
        live_count = sum(1 for organ in organs if organ["status"] == "LIVE")
        blocked = any(organ["status"] == "DOWN" for organ in organs)
        return {
            "organs": organs,
            "live_count": live_count,
            "blocked": blocked,
            "verdict": "BLOCKED" if blocked else "ADVISORY_BODY",
            "lambda_value": lambda_value,
            "energy": "UNAVAILABLE",
            "energy_j": None,
            "conjecture_1": "OPEN",
            "locked_proven": 8,
            "locked_ids": list(LOCKED_EIGHT),
            "proven_trust": False,
            "chain_head": chain["head"],
            "reason": (
                f"organ integrity {live_count}/5 LIVE · Lambda advisory · energy UNAVAILABLE"
                if not blocked
                else "organ integrity failed; the body stopped before effect"
            ),
            "checked_at": utc_now(),
        }

    def selftest() -> dict[str, Any]:
        healthy = evaluate_anatomy(seed=11)
        assert healthy["live_count"] == 5 and healthy["blocked"] is False
        assert evaluate_anatomy(zero_heart=True)["blocked"] is True
        assert evaluate_anatomy(tamper_chain=True)["blocked"] is True
        assert evaluate_anatomy(fabricate_joule=True)["blocked"] is True
        return {"ok": True, "cases": 4, "healthy_head": healthy["chain_head"]}


# These probes are a deliberately small, curated operational layer. The complete
# estate is enumerated independently by /api/catalog from the live Hub APIs.
SURFACES: tuple[tuple[str, str, str, str | None], ...] = (
    (
        "szl-command-lab",
        "Public estate atlas",
        "https://huggingface.co/spaces/SZLHOLDINGS/szl-command-lab",
        None,
    ),
    (
        "a11oy",
        "Governed command fabric",
        "https://huggingface.co/spaces/SZLHOLDINGS/a11oy",
        "https://szlholdings-a11oy.hf.space/healthz",
    ),
    (
        "killinchu",
        "Defense and maritime intelligence",
        "https://huggingface.co/spaces/SZLHOLDINGS/killinchu",
        "https://szlholdings-killinchu.hf.space/healthz",
    ),
    (
        "lyte",
        "Business observability",
        "https://huggingface.co/spaces/SZLHOLDINGS/lyte",
        "https://szlholdings-lyte.hf.space/healthz",
    ),
    (
        "finance",
        "Financial intelligence",
        "https://huggingface.co/spaces/SZLHOLDINGS/finance",
        "https://szlholdings-finance.hf.space/healthz",
    ),
    (
        "counsel",
        "Legal matter intelligence",
        "https://huggingface.co/spaces/SZLHOLDINGS/counsel",
        "https://szlholdings-counsel.hf.space/",
    ),
    (
        "sentra",
        "Cyber defense intelligence",
        "https://huggingface.co/spaces/SZLHOLDINGS/sentra",
        "https://szlholdings-sentra.hf.space/healthz",
    ),
    (
        "terra",
        "Real-estate intelligence",
        "https://huggingface.co/spaces/SZLHOLDINGS/terra",
        "https://szlholdings-terra.hf.space/healthz",
    ),
    (
        "szl-khipu",
        "Governed kernel runtime",
        "https://huggingface.co/spaces/SZLHOLDINGS/szl-khipu",
        "https://szlholdings-szl-khipu.hf.space/",
    ),
)

_catalog_cache: dict[str, Any] | None = None
_catalog_at = 0.0
_catalog_lock = threading.Lock()
_catalog_snapshots: dict[str, dict[str, Any]] = {}
_estate_cache: dict[str, Any] | None = None
_estate_at = 0.0
_estate_lock = threading.Lock()


def _request_bytes(
    url: str, *, timeout: float = 8.0, max_bytes: int = MAX_PROVIDER_BYTES, exact_url: bool = False
) -> bytes:
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Cache-Control": "no-cache",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        if exact_url and (
            response.status != 200 or response.geturl() != url or response.headers.get("Link")
        ):
            raise ValueError("unexpected reserved profile endpoint response")
        data = response.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise ValueError(f"provider response exceeded {max_bytes} bytes")
        return data


def _reserved_profile() -> tuple[dict[str, Any] | None, dict[str, Any]]:
    """Observe the public organization profile omitted by the author-list API."""
    evidence: dict[str, Any] = {"endpoint": RESERVED_PROFILE_URL}
    try:
        raw = _request_bytes(RESERVED_PROFILE_URL, max_bytes=MAX_INDEX_BYTES, exact_url=True)
    except HTTPError as exc:
        if exc.code != 404 or exc.geturl() != RESERVED_PROFILE_URL:
            raise
        return None, {**evidence, "state": "NOT_PUBLICLY_OBSERVABLE", "http_status": 404}
    row = json.loads(raw)
    if not isinstance(row, dict) or row.get("id") != RESERVED_PROFILE_ID:
        raise ValueError("invalid reserved profile identity")
    evidence.update(http_status=200, response_sha256=hashlib.sha256(raw).hexdigest())
    if row.get("private") is True:
        return None, {**evidence, "state": "EXPLICITLY_NON_PUBLIC"}
    if row.get("private") is not False:
        raise ValueError("reserved profile visibility is unknown")
    return row, {**evidence, "state": "PUBLIC_METADATA"}


def _provider_rows(kind: str) -> list[dict[str, Any]]:
    """Read one first-class public Hub repository family.

    Kernels are a first-class repository type on the Hub. Older deployments may
    return 404 for the kernels endpoint; callers record that as unavailable and
    still publish the remaining exact inventory.
    """
    queries = (
        {"author": HF_ORG, "limit": 100, "full": "true", "sort": "lastModified", "direction": "-1"},
        {"author": HF_ORG, "limit": 100, "full": "true"},
    )
    last_error: Exception | None = None
    for params in queries:
        url = f"{HF_API_ORIGIN}/api/{kind}?{urlencode(params)}"
        try:
            payload = json.loads(_request_bytes(url))
            if isinstance(payload, dict) and isinstance(payload.get("items"), list):
                payload = payload["items"]
            if not isinstance(payload, list):
                raise ValueError(f"{kind} API did not return a list")
            return [row for row in payload if isinstance(row, dict)]
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            last_error = exc
            if isinstance(exc, HTTPError) and exc.code not in {400, 404, 429, 500, 502, 503, 504}:
                break
    if last_error is None:
        raise RuntimeError(f"{kind} inventory unavailable")
    raise RuntimeError(f"{kind} inventory unavailable: {type(last_error).__name__}") from last_error


def _clean_tags(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        if isinstance(item, str):
            tag = item.strip()
            if tag and len(tag) <= 80 and tag not in result:
                result.append(tag)
        if len(result) >= 18:
            break
    return result


def _number(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return max(0, int(value))
    return 0


def _repo_id(row: dict[str, Any], kind: str) -> str:
    candidates = (
        row.get("id"),
        row.get("modelId"),
        row.get("datasetId"),
        row.get("spaceId"),
        row.get("kernelId"),
    )
    for candidate in candidates:
        if isinstance(candidate, str) and candidate.startswith(f"{HF_ORG}/"):
            return candidate
    slug = row.get("name")
    if isinstance(slug, str) and slug:
        return f"{HF_ORG}/{slug}"
    return f"{HF_ORG}/unknown-{kind}"


def _normalize_asset(row: dict[str, Any], kind: str) -> dict[str, Any]:
    repo_id = _repo_id(row, kind)
    slug = repo_id.split("/", 1)[-1]
    tags = _clean_tags(row.get("tags"))
    last_modified = row.get("lastModified") or row.get("last_modified") or row.get("updatedAt")
    if not isinstance(last_modified, str):
        last_modified = None
    pipeline = row.get("pipeline_tag") or row.get("pipelineTag")
    if not isinstance(pipeline, str):
        pipeline = None
    library = row.get("library_name") or row.get("libraryName")
    if not isinstance(library, str):
        library = None
    sdk = row.get("sdk")
    if not isinstance(sdk, str):
        card_data = row.get("cardData")
        sdk = card_data.get("sdk") if isinstance(card_data, dict) and isinstance(card_data.get("sdk"), str) else None
    sha = row.get("sha")
    if not isinstance(sha, str) or not SHA_RE.fullmatch(sha):
        sha = None
    return {
        "id": repo_id,
        "slug": slug,
        "type": kind[:-1] if kind.endswith("s") else kind,
        "role": "organization_profile" if kind == "spaces" and repo_id == RESERVED_PROFILE_ID else "artifact",
        "role_label": "Organization profile" if kind == "spaces" and repo_id == RESERVED_PROFILE_ID else None,
        "href": (
            f"https://huggingface.co/spaces/{repo_id}"
            if kind == "spaces"
            else f"https://huggingface.co/datasets/{repo_id}"
            if kind == "datasets"
            else f"https://huggingface.co/kernels/{repo_id}"
            if kind == "kernels"
            else f"https://huggingface.co/{repo_id}"
        ),
        "downloads": _number(row.get("downloads")),
        "likes": _number(row.get("likes")),
        "last_modified": last_modified,
        "pipeline": pipeline,
        "library": library,
        "sdk": sdk,
        "tags": tags,
        "private": bool(row.get("private", False)),
        "gated": bool(row.get("gated", False)),
        "sha": sha,
    }


def _asset_score(asset: dict[str, Any]) -> tuple[int, int, str]:
    return (
        _number(asset.get("downloads")),
        _number(asset.get("likes")),
        str(asset.get("last_modified") or ""),
    )


def recapture_catalog(*, force: bool = False) -> dict[str, Any]:
    global _catalog_cache, _catalog_at
    with _catalog_lock:
        now = time.monotonic()
        if not force and _catalog_cache is not None and now - _catalog_at < CATALOG_TTL_SECONDS:
            cached_families = [
                family for family, observation in _catalog_cache.get("family_observations", {}).items()
                if observation["state"] == "CACHED"
            ]
            if all(now - _catalog_snapshots[family]["monotonic"] <= CATALOG_SNAPSHOT_MAX_AGE_SECONDS for family in cached_families):
                return _catalog_cache

        families = ("models", "datasets", "spaces", "kernels")
        rows_by_family: dict[str, list[dict[str, Any]]] = {}
        errors: dict[str, str] = {}
        with ThreadPoolExecutor(max_workers=len(families)) as executor:
            futures = {executor.submit(_provider_rows, family): family for family in families}
            for future in as_completed(futures):
                family = futures[future]
                try:
                    rows_by_family[family] = future.result()
                except Exception as exc:
                    rows_by_family[family] = []
                    errors[family] = str(exc)

        profile_evidence: dict[str, Any] = {"id": RESERVED_PROFILE_ID, "state": "UNAVAILABLE"}
        if "spaces" not in errors:
            spaces = rows_by_family["spaces"]
            listed_profile = next((row for row in spaces if row.get("id") == RESERVED_PROFILE_ID and row.get("private") is False), None)
            # Unknown visibility must not become a public record through normalization.
            rows_by_family["spaces"] = [row for row in spaces if _repo_id(row, "spaces") != RESERVED_PROFILE_ID]
            if listed_profile is not None:
                rows_by_family["spaces"].append(listed_profile)
                profile_evidence["state"] = "AUTHOR_LIST"
            else:
                try:
                    profile, evidence = _reserved_profile()
                    profile_evidence.update(evidence)
                    if profile is not None:
                        rows_by_family["spaces"].append(profile)
                except Exception as exc:
                    errors["reserved_profile"] = f"reserved profile unavailable: {type(exc).__name__}"

        captured_at = utc_now()
        captured_mono = time.monotonic()
        assets: list[dict[str, Any]] = []
        observations: dict[str, dict[str, Any]] = {}
        counts: dict[str, int | None] = {}
        for family in families:
            snapshot = _catalog_snapshots.get(family)
            observation = {"state": "UNAVAILABLE", "observed_at": None, "checked_at": captured_at, "age_seconds": None}
            family_assets: list[dict[str, Any]] = []
            if family not in errors:
                normalized = [_normalize_asset(row, family) for row in rows_by_family[family]]
                public = [asset for asset in normalized if not asset["private"] and not asset["slug"].startswith("unknown-")]
                family_assets = list({asset["id"]: asset for asset in public}.values())
                partial = family == "spaces" and "reserved_profile" in errors
                observation.update(state="PARTIAL" if partial else "FRESH", observed_at=captured_at, age_seconds=0)
                if not partial:
                    _catalog_snapshots[family] = {
                        "assets": family_assets, "observed_at": captured_at, "monotonic": captured_mono,
                        "reserved_profile": dict(profile_evidence) if family == "spaces" else None,
                    }
            elif snapshot is not None:
                age = max(0, captured_mono - snapshot["monotonic"])
                observation["last_success_at"] = snapshot["observed_at"]
                if age <= CATALOG_SNAPSHOT_MAX_AGE_SECONDS:
                    family_assets = snapshot["assets"]
                    observation.update(state="CACHED", observed_at=snapshot["observed_at"], age_seconds=int(age))
                    if family == "spaces":
                        previous = snapshot["reserved_profile"]
                        profile_evidence = {**previous, "source_state": previous["state"], "state": "CACHED", "observed_at": snapshot["observed_at"]}
            # A model tag cannot establish native kernel namespace membership.
            counts[family] = None if observation["state"] == "UNAVAILABLE" else len(family_assets)
            observations[family] = {**observation, "count": counts[family]}
            assets.extend({**asset, "observation_state": observation["state"], "observed_at": observation["observed_at"]} for asset in family_assets)
        assets.sort(key=_asset_score, reverse=True)
        counts["assets"] = len(assets)
        any_observed = any(observation["state"] != "UNAVAILABLE" for observation in observations.values())
        state = "VERIFIED_PUBLIC_LISTING" if not errors else ("PARTIAL" if any_observed else "UNAVAILABLE")
        payload = {
            "schema": "szl.atlas.catalog/v1",
            "organization": HF_ORG,
            "captured_at": captured_at,
            "state": state,
            "counts": counts,
            "family_observations": observations,
            "snapshot_max_age_seconds": CATALOG_SNAPSHOT_MAX_AGE_SECONDS,
            "errors": errors,
            "reserved_profile": profile_evidence,
            "assets": assets,
            "links": {
                "organization": f"https://huggingface.co/{HF_ORG}",
                "models": f"https://huggingface.co/{HF_ORG}/models",
                "datasets": f"https://huggingface.co/{HF_ORG}/datasets",
                "spaces": f"https://huggingface.co/{HF_ORG}/spaces",
                "kernels": f"https://huggingface.co/{HF_ORG}/kernels",
                "collections": f"https://huggingface.co/{HF_ORG}/collections",
            },
            "boundary": (
                "Counts are repository records by namespace; model and kernel IDs may overlap. "
                "Null counts are unavailable. Cached records retain their last successful observation time; "
                "the observed record total may mix fresh and cached families. "
                "The reserved README Space is the organization profile. "
                "Listing and reachability are not benchmark superiority, production authorization, "
                "regulatory approval, customer adoption, or investment performance."
            ),
        }
        _catalog_cache = payload
        _catalog_at = captured_mono
        return payload


def _hit(url: str, *, timeout: float = 4.5) -> tuple[int | None, str]:
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/html;q=0.8",
            "Cache-Control": "no-cache",
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status, response.read(512).decode("utf-8", "replace")
    except HTTPError as exc:
        return exc.code, ""
    except (URLError, TimeoutError, OSError):
        return None, ""


def recapture_estate(*, force: bool = False) -> dict[str, Any]:
    global _estate_cache, _estate_at
    now = time.monotonic()
    with _estate_lock:
        if not force and _estate_cache is not None and now - _estate_at < ESTATE_TTL_SECONDS:
            return _estate_cache

        energy = probe()
        body = evaluate_anatomy(seed=11)
        kernel_ok = (
            type(body.get("live_count")) is int
            and body["live_count"] == 5
            and body.get("blocked") is False
        )

        def one(row: tuple[str, str, str, str | None]) -> dict[str, Any]:
            ident, role, href, url = row
            if url is None:
                return {
                    "id": ident,
                    "role": role,
                    "href": href,
                    "honesty": (
                        "BLOCKED" if body.get("blocked") is True
                        else "SIMULATED" if kernel_ok else "UNAVAILABLE"
                    ),
                    "detail": "Synthetic local kernel; no runtime capability or authorization asserted",
                    "http": None,
                    "reachable": None,
                    "evidence_scope": "synthetic_kernel",
                }
            # Response shape is not a health contract: error JSON, malformed
            # JSON, and an HTML application error can all arrive with HTTP 200.
            status, _text = _hit(url)
            honesty = "UNAVAILABLE"
            detail = "no response" if status is None else f"HTTP {status}"
            if status == 200:
                honesty = "MEASURED"
                detail = "HTTP 200; reachability only, capability UNKNOWN"
            return {
                "id": ident,
                "role": role,
                "href": href,
                "honesty": honesty,
                "detail": detail,
                "http": status,
                "reachable": status == 200,
                "evidence_scope": "http_reachability",
            }

        with ThreadPoolExecutor(max_workers=8) as executor:
            surfaces = list(executor.map(one, SURFACES))

        payload = {
            "schema": "szl.atlas.estate/v1",
            "captured_at": utc_now(),
            "source": "SZLHOLDINGS/szl-command-lab",
            "kernel": {
                "ok": kernel_ok,
                "live_count": body.get("live_count"),
                "blocked": body.get("blocked"),
                "verdict": body.get("verdict"),
                "conjecture_1": "OPEN",
                "proven_trust": False,
                "reason": body.get("reason"),
                "organs": body.get("organs", []),
                "energy": energy,
            },
            "surfaces": surfaces,
            # Retained for v1 readers; this probe cannot establish live capability.
            "live_surfaces": 0,
            "reachable_surfaces": sum(1 for item in surfaces if item["reachable"] is True),
            "simulated_surfaces": sum(1 for item in surfaces if item["honesty"] == "SIMULATED"),
            "boundary": "HTTP 200 proves reachability only; each surface owns its capability evidence.",
        }
        _estate_cache = payload
        _estate_at = now
        return payload


def _flag(query: dict[str, list[str]], name: str) -> bool:
    value = (query.get(name) or ["0"])[0].lower()
    return value in {"1", "true", "on", "yes"}


def build_info() -> dict[str, Any]:
    revision = os.environ.get("SZL_GIT_SHA") or os.environ.get("GITHUB_SHA") or ""
    source_revision = revision if SHA_RE.fullmatch(revision) else None
    payload: dict[str, Any] = {
        "schema": "szl.atlas.build/v1",
        "service": "szl-command-lab",
        "surface": "SZL Atlas",
        "source_repository": "szl-holdings/szl-command-lab",
        "source_revision": source_revision,
        "state": "SOURCE_BOUND" if source_revision else "REVISION_UNAVAILABLE",
        "receipt_minted": False,
        "components": {
            "yarqa": {
                "repository": YARQA_SOURCE_REPOSITORY,
                "revision": YARQA_SOURCE_REVISION,
                "version": YARQA_RUNTIME_VERSION,
                "binding": (
                    "BOUND"
                    if os.environ.get("SZL_YARQA_SHA") == YARQA_SOURCE_REVISION
                    else "UNBOUND_OR_MISMATCHED"
                ),
            }
        },
        "generated_at": utc_now(),
    }
    if source_revision:
        payload["build"] = {
            "state": "OBSERVED",
            "revision": source_revision,
        }
    return payload


def _load_index() -> tuple[int, bytes]:
    """Read the bounded Atlas entrypoint from runtime or source layout."""
    for path in (HERE / "index.html", HERE / "space" / "index.html"):
        try:
            if path.is_symlink():
                continue
            metadata = path.stat(follow_symlinks=False)
            if not stat.S_ISREG(metadata.st_mode):
                continue
            if metadata.st_size <= 0 or metadata.st_size > MAX_INDEX_BYTES:
                continue
            with path.open("rb") as handle:
                raw = handle.read(MAX_INDEX_BYTES + 1)
            if len(raw) != metadata.st_size or len(raw) > MAX_INDEX_BYTES:
                continue
            text = raw.decode("utf-8")
            if 'data-szl-surface="atlas-v1"' not in text:
                continue
            return 200, raw
        except (OSError, UnicodeDecodeError):
            continue
    return 503, (
        "<!doctype html><html lang='en'><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>SZL Atlas</title><body><main><h1>SZL Atlas</h1>"
        "<p>The public interface is temporarily unavailable. Check /healthz separately.</p>"
        "</main></body></html>"
    ).encode("utf-8")


JSON_PATHS = {
    "/healthz",
    "/readyz",
    "/api/build-info",
    "/api/catalog",
    "/api/estate",
    "/api/energy",
    "/api/yarqa",
    "/api/organs/integrity",
    "/v1/organs/integrity",
}
HTML_PATHS = {"/", "/index.html"}


class Handler(BaseHTTPRequestHandler):
    server_version = "SZLAtlas/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:  # noqa: A003
        sys.stderr.write(f"{self.address_string()} - {fmt % args}\n")

    def _common_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; base-uri 'none'; frame-ancestors 'self' https://huggingface.co; "
            "form-action 'none'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; "
            "script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:",
        )

    def do_HEAD(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        content_length = "0"
        if path in HTML_PATHS:
            status, raw = _load_index()
            content_length = str(len(raw))
        elif path in {"/readyz", "/api/yarqa"}:
            status = 200 if run_yarqa_demo().get("ok") is True else 503
        else:
            status = 200 if path in JSON_PATHS else 404
        self.send_response(status)
        self.send_header(
            "Content-Type",
            "text/html; charset=utf-8" if path in HTML_PATHS else "application/json; charset=utf-8",
        )
        self.send_header("Content-Length", content_length)
        self.send_header("Cache-Control", "no-store")
        self._common_headers()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = parse_qs(parsed.query)

        if path in {"/healthz", "/readyz"}:
            body = evaluate_anatomy(seed=11)
            yarqa = run_yarqa_demo()
            ready = yarqa.get("ok") is True
            status = 200 if path == "/healthz" or ready else 503
            self._send_json(
                status,
                {
                    "ok": True if path == "/healthz" else ready,
                    "ready": ready,
                    "service": "szl-command-lab",
                    "surface": "SZL Atlas",
                    "organs": body.get("live_count"),
                    "energy": probe(),
                    "yarqa": {
                        "state": yarqa.get("state"),
                        "source_revision": YARQA_SOURCE_REVISION,
                        "receipt_replay": bool(
                            (yarqa.get("receipt") or {}).get("verification", {}).get("ok")
                        ),
                    },
                    "proven_trust": False,
                    "channel": "LIVE",
                },
            )
            return
        if path == "/api/build-info":
            self._send_json(200, build_info())
            return
        if path == "/api/catalog":
            force = _flag(query, "refresh")
            payload = recapture_catalog(force=force)
            status = 503 if payload["state"] == "UNAVAILABLE" else 200
            self._send_json(status, payload)
            return
        if path == "/api/estate":
            self._send_json(200, recapture_estate(force=_flag(query, "refresh")))
            return
        if path == "/api/energy":
            self._send_json(200, probe())
            return
        if path == "/api/yarqa":
            payload = run_yarqa_demo()
            self._send_json(200 if payload.get("ok") is True else 503, payload)
            return
        if path in {"/api/organs/integrity", "/v1/organs/integrity"}:

            def run() -> dict[str, Any]:
                return evaluate_anatomy(
                    zero_heart=_flag(query, "zero_heart"),
                    tamper_chain=_flag(query, "tamper_chain"),
                    fabricate_joule=_flag(query, "fabricate_joule"),
                    seed=11,
                )

            body, energy = measure_run(run)
            if _flag(query, "fabricate_joule"):
                energy = {
                    "channel": "LIVE",
                    "honesty": "UNAVAILABLE",
                    "energy_j": None,
                    "inference_energy_j": None,
                    "note": "A fabricated energy claim was refused.",
                }
                body["blocked"] = True
                body["verdict"] = "BLOCKED"
            body["energy"] = energy.get("honesty")
            body["energy_j"] = energy.get("energy_j")
            self._send_json(200, {"ok": True, "body": body, "energy": energy})
            return
        if path in HTML_PATHS:
            status, raw = _load_index()
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self._common_headers()
            self.end_headers()
            self.wfile.write(raw)
            return
        self._send_json(404, {"ok": False, "error": "not found"})

    def _send_json(self, status: int, obj: Any) -> None:
        raw = (json.dumps(obj, indent=2, sort_keys=True, default=str) + "\n").encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self._common_headers()
        self.end_headers()
        self.wfile.write(raw)


def main() -> int:
    selftest()
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "7860"))
    httpd = ThreadingHTTPServer((host, port), Handler)
    httpd.daemon_threads = True
    print(
        f"[szl-atlas] {host}:{port} · live Hub catalog + governed loop · no fabricated claims",
        file=sys.stderr,
    )
    httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
