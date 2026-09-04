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
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "python"))

HF_ORG = "SZLHOLDINGS"
HF_API_ORIGIN = "https://huggingface.co"
USER_AGENT = "szl-atlas/1.0 (+https://github.com/szl-holdings/szl-command-lab)"
MAX_PROVIDER_BYTES = 8_000_000
CATALOG_TTL_SECONDS = 120
ESTATE_TTL_SECONDS = 30
SHA_RE = re.compile(r"^[0-9a-f]{40}$")


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


# Prefer the source-bound substrate modules installed by the Dockerfile. The
# fallback keeps this Space auditable and operational if an older flattened
# publication omits those modules.
try:
    from energy import measure_run, probe  # type: ignore
    from kernel import evaluate_anatomy, selftest  # type: ignore
except ImportError:
    LOCKED_EIGHT = ("F1", "F4", "F7", "F11", "F12", "F18", "F19", "F22")
    YUYAY_FLOORS = (0.95, 0.95) + (0.90,) * 11
    ZERO = "0" * 64
    CHAIN_OPS = ("anatomy.brain", "anatomy.heart", "anatomy.skeleton")
    POWERCAP = Path("/sys/class/powercap")
    RAPL = Path("/sys/class/powercap/intel-rapl:0/energy_uj")

    def _rapl_uj() -> int | None:
        candidates = [RAPL]
        try:
            if POWERCAP.is_dir():
                candidates.extend(sorted(POWERCAP.glob("intel-rapl:*/energy_uj")))
        except OSError:
            pass
        seen: set[Path] = set()
        for path in candidates:
            if path in seen:
                continue
            seen.add(path)
            try:
                if path.is_file():
                    return int(path.read_text(encoding="utf-8").strip())
            except (OSError, ValueError):
                continue
        return None

    def _nvml_mj() -> float | None:
        try:
            import pynvml  # type: ignore
        except ImportError:
            return None
        try:
            pynvml.nvmlInit()
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            value = float(pynvml.nvmlDeviceGetTotalEnergyConsumption(handle))
            pynvml.nvmlShutdown()
            return value
        except Exception:
            try:
                pynvml.nvmlShutdown()
            except Exception:
                pass
            return None

    def probe(*, sample_s: float = 0.05) -> dict[str, Any]:
        start = _rapl_uj()
        if start is not None:
            time.sleep(max(0.0, sample_s))
            end = _rapl_uj()
            if end is None:
                end = start
            return {
                "channel": "LIVE",
                "honesty": "MEASURED",
                "source": "intel-rapl",
                "package_energy_j": end / 1_000_000.0,
                "sample_delta_j": max(0.0, (end - start) / 1_000_000.0),
                "inference_energy_j": None,
                "energy_j": None,
                "note": "RAPL package counter measured on this runtime.",
            }
        nvml_mj = _nvml_mj()
        if nvml_mj is not None:
            return {
                "channel": "LIVE",
                "honesty": "MEASURED",
                "source": "nvml",
                "package_energy_j": nvml_mj / 1000.0,
                "sample_delta_j": None,
                "inference_energy_j": None,
                "energy_j": None,
                "note": "NVML total-energy counter measured on this runtime.",
            }
        return {
            "channel": "LIVE",
            "honesty": "UNAVAILABLE",
            "source": None,
            "package_energy_j": None,
            "sample_delta_j": None,
            "inference_energy_j": None,
            "energy_j": None,
            "note": "No readable RAPL or NVML counter; no joule value is inferred.",
        }

    def measure_run(fn: Callable[[], Any]) -> tuple[Any, dict[str, Any]]:
        start = _rapl_uj()
        t0 = time.perf_counter()
        result = fn()
        duration = time.perf_counter() - t0
        end = _rapl_uj()
        energy = probe(sample_s=0.0)
        energy["duration_s"] = duration
        if start is not None and end is not None:
            measured = max(0.0, (end - start) / 1_000_000.0)
            energy.update(
                {
                    "honesty": "MEASURED",
                    "inference_energy_j": measured,
                    "energy_j": measured,
                    "note": f"RAPL delta around the bounded kernel ({duration:.4f}s).",
                }
            )
        return result, energy

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
        "anatomy",
        "Living system anatomy",
        "https://huggingface.co/spaces/SZLHOLDINGS/anatomy",
        "https://szlholdings-anatomy.hf.space/healthz",
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
_estate_cache: dict[str, Any] | None = None
_estate_at = 0.0
_estate_lock = threading.Lock()


def _request_bytes(url: str, *, timeout: float = 8.0, max_bytes: int = MAX_PROVIDER_BYTES) -> bytes:
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Cache-Control": "no-cache",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        data = response.read(max_bytes + 1)
        if len(data) > max_bytes:
            raise ValueError(f"provider response exceeded {max_bytes} bytes")
        return data


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
    now = time.monotonic()
    with _catalog_lock:
        if not force and _catalog_cache is not None and now - _catalog_at < CATALOG_TTL_SECONDS:
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

        assets: list[dict[str, Any]] = []
        for family in families:
            assets.extend(_normalize_asset(row, family) for row in rows_by_family[family])

        # Some provider generations exposed kernel cards through the model API.
        # Include those as kernels only when no first-class kernel endpoint was
        # available, while retaining the original model records in the catalog.
        if not rows_by_family["kernels"]:
            inferred = []
            for asset in assets:
                if asset["type"] != "model":
                    continue
                tags = {str(tag).lower() for tag in asset.get("tags", [])}
                library = str(asset.get("library") or "").lower()
                if "kernel" in tags or "kernels" in tags or library == "kernels":
                    clone = dict(asset)
                    clone["type"] = "kernel"
                    clone["href"] = f"https://huggingface.co/{asset['id']}"
                    inferred.append(clone)
            assets.extend(inferred)

        # Public catalog must never expose private artifacts even if a provider
        # changes its unauthenticated response contract.
        assets = [asset for asset in assets if not asset["private"] and not asset["slug"].startswith("unknown-")]
        assets.sort(key=_asset_score, reverse=True)

        counts = {
            family: sum(1 for asset in assets if asset["type"] == family[:-1])
            for family in families
        }
        # Correct plural key names for the public contract.
        counts = {
            "models": counts["models"],
            "datasets": counts["datasets"],
            "spaces": counts["spaces"],
            "kernels": counts["kernels"],
            "assets": len(assets),
        }
        state = "VERIFIED_PUBLIC_LISTING" if not errors else ("PARTIAL" if assets else "UNAVAILABLE")
        payload = {
            "schema": "szl.atlas.catalog/v1",
            "organization": HF_ORG,
            "captured_at": utc_now(),
            "state": state,
            "counts": counts,
            "errors": errors,
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
                "Listing and reachability are not benchmark superiority, production authorization, "
                "regulatory approval, customer adoption, or investment performance."
            ),
        }
        _catalog_cache = payload
        _catalog_at = now
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

        def one(row: tuple[str, str, str, str | None]) -> dict[str, Any]:
            ident, role, href, url = row
            if url is None:
                return {
                    "id": ident,
                    "role": role,
                    "href": href,
                    "honesty": "LIVE" if body.get("live_count") == 5 else "UNAVAILABLE",
                    "detail": f"local kernel {body.get('live_count', 0)}/5",
                    "http": 200,
                }
            status, text = _hit(url)
            honesty = "UNAVAILABLE"
            detail = "no response" if status is None else f"HTTP {status}"
            if status == 200:
                sample = text.strip().lower()
                if sample.startswith("{") or sample.startswith("["):
                    honesty = "LIVE"
                    detail = "structured health response"
                elif "<html" in sample or "<!doctype" in sample:
                    honesty = "REACHABLE"
                    detail = "HTML 200; runtime-specific health not asserted"
                else:
                    honesty = "REACHABLE"
                    detail = "HTTP 200"
            return {
                "id": ident,
                "role": role,
                "href": href,
                "honesty": honesty,
                "detail": detail,
                "http": status,
            }

        with ThreadPoolExecutor(max_workers=8) as executor:
            surfaces = list(executor.map(one, SURFACES))

        payload = {
            "schema": "szl.atlas.estate/v1",
            "captured_at": utc_now(),
            "source": "SZLHOLDINGS/szl-command-lab",
            "kernel": {
                "ok": body.get("live_count") == 5 and not body.get("blocked", True),
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
            "live_surfaces": sum(1 for item in surfaces if item["honesty"] == "LIVE"),
            "reachable_surfaces": sum(1 for item in surfaces if item["honesty"] == "REACHABLE"),
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
    return {
        "schema": "szl.atlas.build/v1",
        "service": "szl-command-lab",
        "surface": "SZL Atlas",
        "source_repository": "szl-holdings/szl-command-lab",
        "source_revision": revision if SHA_RE.fullmatch(revision) else None,
        "state": "SOURCE_BOUND" if SHA_RE.fullmatch(revision) else "REVISION_UNAVAILABLE",
        "generated_at": utc_now(),
    }


def _load_index() -> bytes:
    path = HERE / "index.html"
    try:
        data = path.read_bytes()
        if not data or len(data) > 2_000_000:
            raise ValueError("index.html missing or outside size boundary")
        return data
    except (OSError, ValueError):
        return (
            "<!doctype html><html lang='en'><meta charset='utf-8'>"
            "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            "<title>SZL Atlas</title><body><main><h1>SZL Atlas</h1>"
            "<p>The public interface is temporarily unavailable. API health remains at /healthz.</p>"
            "</main></body></html>"
        ).encode("utf-8")


JSON_PATHS = {
    "/healthz",
    "/readyz",
    "/api/build-info",
    "/api/catalog",
    "/api/estate",
    "/api/energy",
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
        status = 200 if path in HTML_PATHS or path in JSON_PATHS else 404
        self.send_response(status)
        self.send_header(
            "Content-Type",
            "text/html; charset=utf-8" if path in HTML_PATHS else "application/json; charset=utf-8",
        )
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self._common_headers()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = parse_qs(parsed.query)

        if path in {"/healthz", "/readyz"}:
            body = evaluate_anatomy(seed=11)
            self._send_json(
                200,
                {
                    "ok": True,
                    "service": "szl-command-lab",
                    "surface": "SZL Atlas",
                    "organs": body.get("live_count"),
                    "energy": probe(),
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
            raw = _load_index()
            self.send_response(200)
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
