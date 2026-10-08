#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Escaped, source-bound rendering for the Atlas Launchpad visitor page."""
from __future__ import annotations

import re
from html import escape
from typing import Any
from urllib.parse import urlsplit

SCHEMA = "szl.atlas.launchpad/v1"
MARKERS = (
    "__SZL_REGISTRY_STATE__",
    "__SZL_REGISTRY_STATUS_TEXT__",
    "__SZL_BINDING_STATE__",
    "__SZL_BINDING_SOURCE__",
    "__SZL_BINDING_REVISION__",
    "__SZL_BINDING_COUNT__",
    "<!-- SZL_REGISTERED_SURFACES -->",
)
_MARKER_PATTERN = re.compile("|".join(re.escape(marker) for marker in MARKERS))


def _e(value: str) -> str:
    return escape(value, quote=True)


def _validated(payload: Any) -> tuple[str, str, list[dict[str, str]]]:
    """Validate the whole registry before producing a single destination link."""
    if not isinstance(payload, dict):
        raise ValueError("registry is not an object")
    if (
        payload.get("schema") != SCHEMA
        or payload.get("state") != "REGISTERED_NAVIGATION"
        or payload.get("authorization") != "NONE"
        or payload.get("public_effectors") != []
        or payload.get("errors") != []
    ):
        raise ValueError("registry contract mismatch")
    source = payload.get("source_repository")
    revision = payload.get("source_revision")
    rows = payload.get("surfaces")
    if not isinstance(source, str) or not source.strip():
        raise ValueError("missing source")
    if revision is not None and not isinstance(revision, str):
        raise ValueError("malformed revision")
    source.encode("utf-8")
    if revision is not None:
        revision.encode("utf-8")
    if not isinstance(rows, list) or type(payload.get("surface_count")) is not int:
        raise ValueError("malformed surfaces")
    if payload["surface_count"] != len(rows):
        raise ValueError("surface count mismatch")

    seen_ids: set[str] = set()
    seen_hrefs: set[str] = set()
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"id", "role", "href"}:
            raise ValueError("malformed surface")
        if not all(isinstance(row[key], str) and row[key].strip() for key in ("id", "role", "href")):
            raise ValueError("malformed surface value")
        for value in (row["id"], row["role"], row["href"]):
            value.encode("utf-8")
        href = row["href"]
        if any(character.isspace() or ord(character) < 32 for character in href) or "\\" in href:
            raise ValueError("unsafe surface URL")
        parsed = urlsplit(href)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
        ):
            raise ValueError("unsafe surface URL")
        if row["id"] in seen_ids or href in seen_hrefs:
            raise ValueError("duplicate surface")
        seen_ids.add(row["id"])
        seen_hrefs.add(href)
    return source, revision or "REVISION_UNAVAILABLE", rows


def _card(row: dict[str, str]) -> str:
    ident, role, href = row["id"], row["role"], row["href"]
    route = href.removeprefix("https://")
    return (
        '<a class="card external" href="' + _e(href)
        + '" target="_blank" rel="noopener noreferrer" aria-label="'
        + _e(ident + " — registered public surface, opens in a new tab")
        + '"><span><span class="tag">' + _e(role) + '</span><strong>'
        + _e(ident) + '</strong><small>Registered route. Availability and capability '
        + 'are verified separately.</small></span><span class="route">'
        + _e(route) + '</span></a>'
    )


def render(template: str, payload: Any) -> tuple[int, bytes, str]:
    """Fill each known template marker once; malformed data shows no links."""
    if any(template.count(marker) != 1 for marker in MARKERS):
        raise ValueError("Launchpad template contract mismatch")
    try:
        source, revision, rows = _validated(payload)
    except (TypeError, ValueError):
        status = 503
        state = "UNAVAILABLE"
        values = (
            "UNAVAILABLE",
            "Registry unavailable",
            "UNAVAILABLE",
            "szl-holdings/szl-command-lab",
            "UNAVAILABLE",
            "UNAVAILABLE",
            '<div class="empty">Registry unavailable. No destination state is inferred.</div>',
        )
    else:
        status = 200
        state = "SOURCE_CONTROLLED"
        cards = "".join(_card(row) for row in rows)
        values = (
            "REGISTERED_NAVIGATION",
            "Registry observed",
            "REGISTERED_NAVIGATION",
            _e(source),
            _e(revision),
            f"{len(rows)} registered surfaces",
            cards or '<div class="empty">The source-controlled registry is empty; no routes are inferred.</div>',
        )
    replacements = dict(zip(MARKERS, values, strict=True))
    html = _MARKER_PATTERN.sub(lambda match: replacements[match.group(0)], template)
    return status, html.encode("utf-8"), state
