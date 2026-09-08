#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 SZL Holdings
"""Compose the Atlas server with a bounded, source-controlled Launchpad.

The Launchpad is a navigation registry only. It derives its public links from
``server.SURFACES`` and deliberately omits health, liveness, authorization, and
capability claims. Every pre-existing Atlas route remains owned by
``server.Handler``.
"""
from __future__ import annotations

import json
import os
import stat
import sys
from http.server import ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import server

HERE = Path(__file__).resolve().parent
RUNTIME_LAUNCHPAD_PATH = HERE / "launchpad.html"
SOURCE_LAUNCHPAD_PATH = HERE / "space" / "launchpad.html"
MAX_LAUNCHPAD_BYTES = 512 * 1024
LAUNCHPAD_HTML_PATHS = frozenset({"/launchpad", "/launchpad.html"})
LAUNCHPAD_API_PATH = "/api/launchpad"
MAX_PUBLIC_ASSET_BYTES = 512 * 1024
PUBLIC_ASSET_SPECS: dict[str, tuple[tuple[Path, ...], str, tuple[str, ...]]] = {
    "/szl-holo-v2.css": (
        (HERE / "szl-holo-v2.css", HERE / "space" / "szl-holo-v2.css"),
        "text/css; charset=utf-8",
        ("SZL Public Experience v3", "--szl-touch-target"),
    ),
    "/szl-holo-v2.js": (
        (HERE / "szl-holo-v2.js", HERE / "space" / "szl-holo-v2.js"),
        "text/javascript; charset=utf-8",
        ("__SZL_PUBLIC_EXPERIENCE_V3__", "szlPublicExperienceV3"),
    ),
}
PUBLIC_ASSET_PATHS = frozenset(PUBLIC_ASSET_SPECS)


def _unavailable_launchpad(reason: str) -> bytes:
    """Return a minimal fail-closed page without inferred destination state."""
    safe_reason = reason.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return (
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<meta name='color-scheme' content='dark'><title>Atlas Launchpad unavailable</title>"
        "</head><body><main><h1>Atlas Launchpad unavailable</h1>"
        "<p>No route state is inferred while the source-controlled navigation "
        "artifact is unavailable.</p><p>Reason: "
        f"{safe_reason}</p><p><a href='/'>Return to SZL Atlas</a></p>"
        "</main></body></html>"
    ).encode("utf-8")


def _load_launchpad() -> tuple[int, bytes, str]:
    """Read one regular, bounded Launchpad file; otherwise fail closed."""
    failures: list[str] = []
    for path in (RUNTIME_LAUNCHPAD_PATH, SOURCE_LAUNCHPAD_PATH):
        try:
            if path.is_symlink():
                failures.append(f"{path.name}:symlink")
                continue
            metadata = path.stat(follow_symlinks=False)
            if not stat.S_ISREG(metadata.st_mode):
                failures.append(f"{path.name}:not-regular")
                continue
            if metadata.st_size <= 0 or metadata.st_size > MAX_LAUNCHPAD_BYTES:
                failures.append(f"{path.name}:size-boundary")
                continue
            raw = path.read_bytes()
            if len(raw) != metadata.st_size or len(raw) > MAX_LAUNCHPAD_BYTES:
                failures.append(f"{path.name}:unstable-read")
                continue
            text = raw.decode("utf-8")
            required = (
                'data-szl-surface="atlas-launchpad-v1"',
                "Navigation does not certify availability",
                "navigation is not runtime proof",
                'fetch("/api/launchpad"',
            )
            if any(marker not in text for marker in required):
                failures.append(f"{path.name}:contract-mismatch")
                continue
            return 200, raw, "SOURCE_CONTROLLED"
        except (OSError, UnicodeDecodeError):
            failures.append(f"{path.name}:unavailable")
    reason = ",".join(failures) or "no-candidate"
    return 503, _unavailable_launchpad(reason), "UNAVAILABLE"


def _load_public_asset(request_path: str) -> tuple[int, bytes, str]:
    """Load one allowlisted, bounded asset and fail closed on source drift."""
    spec = PUBLIC_ASSET_SPECS.get(request_path)
    if spec is None:
        return 404, b"not found\n", "text/plain; charset=utf-8"

    candidates, content_type, required_markers = spec
    failures: list[str] = []
    for path in candidates:
        try:
            if path.is_symlink():
                failures.append(f"{path.name}:symlink")
                continue
            metadata = path.stat(follow_symlinks=False)
            if not stat.S_ISREG(metadata.st_mode):
                failures.append(f"{path.name}:not-regular")
                continue
            if metadata.st_size <= 0 or metadata.st_size > MAX_PUBLIC_ASSET_BYTES:
                failures.append(f"{path.name}:size-boundary")
                continue
            raw = path.read_bytes()
            if len(raw) != metadata.st_size or len(raw) > MAX_PUBLIC_ASSET_BYTES:
                failures.append(f"{path.name}:unstable-read")
                continue
            text = raw.decode("utf-8")
            if any(marker not in text for marker in required_markers):
                failures.append(f"{path.name}:contract-mismatch")
                continue
            return 200, raw, content_type
        except (OSError, UnicodeDecodeError):
            failures.append(f"{path.name}:unavailable")

    reason = ",".join(failures) or "no-candidate"
    return 503, f"asset unavailable: {reason}\n".encode("utf-8"), "text/plain; charset=utf-8"


def launchpad_payload() -> dict[str, Any]:
    """Build the deterministic navigation-only registry from Atlas source."""
    build = server.build_info()
    surfaces: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    seen_hrefs: set[str] = set()
    errors: list[str] = []

    for row in server.SURFACES:
        if not isinstance(row, tuple) or len(row) != 4:
            errors.append("malformed-source-row")
            continue
        ident, role, href, _health_url = row
        if not all(isinstance(value, str) and value.strip() for value in (ident, role, href)):
            errors.append("malformed-source-value")
            continue
        parsed = urlparse(href)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            errors.append(f"unsafe-href:{ident}")
            continue
        normalized_id = ident.strip()
        normalized_href = href.strip()
        if normalized_id in seen_ids or normalized_href in seen_hrefs:
            errors.append(f"duplicate-source-row:{normalized_id}")
            continue
        seen_ids.add(normalized_id)
        seen_hrefs.add(normalized_href)
        surfaces.append(
            {
                "id": normalized_id,
                "role": role.strip(),
                "href": normalized_href,
            }
        )

    surfaces.sort(key=lambda item: (item["id"].casefold(), item["href"]))
    state = "REGISTERED_NAVIGATION" if not errors else "UNAVAILABLE"
    return {
        "schema": "szl.atlas.launchpad/v1",
        "state": state,
        "captured_at": server.utc_now(),
        "source_repository": "szl-holdings/szl-command-lab",
        "source_revision": build.get("source_revision"),
        "source_state": build.get("state"),
        "surface_count": len(surfaces) if not errors else 0,
        "surfaces": surfaces if not errors else [],
        "errors": errors,
        "public_effectors": [],
        "authorization": "NONE",
        "claim_boundary": (
            "Registration is navigation metadata only; availability, freshness, "
            "capability, authorization, and production readiness are verified independently."
        ),
    }


class Handler(server.Handler):
    """Add Launchpad GET/HEAD routes while preserving the Atlas handler."""

    server_version = "SZLAtlasGateway/1.0"

    def _send_public_asset(self, path: str, *, include_body: bool) -> None:
        status, raw, content_type = _load_public_asset(path)
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header(
            "Cache-Control",
            "public, max-age=300, must-revalidate" if status == 200 else "no-store",
        )
        self._common_headers()
        self.end_headers()
        if include_body:
            self.wfile.write(raw)

    def do_HEAD(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path in PUBLIC_ASSET_PATHS:
            self._send_public_asset(path, include_body=False)
            return
        if path in LAUNCHPAD_HTML_PATHS:
            status, raw, _state = _load_launchpad()
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self._common_headers()
            self.end_headers()
            return
        if path == LAUNCHPAD_API_PATH:
            payload = launchpad_payload()
            raw = (json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n").encode(
                "utf-8"
            )
            self.send_response(200 if payload["state"] == "REGISTERED_NAVIGATION" else 503)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self._common_headers()
            self.end_headers()
            return
        super().do_HEAD()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path in PUBLIC_ASSET_PATHS:
            self._send_public_asset(path, include_body=True)
            return
        if path in LAUNCHPAD_HTML_PATHS:
            status, raw, _state = _load_launchpad()
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self._common_headers()
            self.end_headers()
            self.wfile.write(raw)
            return
        if path == LAUNCHPAD_API_PATH:
            payload = launchpad_payload()
            status = 200 if payload["state"] == "REGISTERED_NAVIGATION" else 503
            self._send_json(status, payload)
            return
        super().do_GET()


def main() -> int:
    """Start the composed Atlas gateway after the existing kernel self-test."""
    server.selftest()
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "7860"))
    httpd = ThreadingHTTPServer((host, port), Handler)
    httpd.daemon_threads = True
    print(
        f"[szl-atlas-gateway] {host}:{port} · Atlas + source-bound Launchpad · no inferred liveness",
        file=sys.stderr,
    )
    httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
