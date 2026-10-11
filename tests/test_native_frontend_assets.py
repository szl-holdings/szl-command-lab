"""Guard the actual Docker/static boundary and native identity projection."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pytest

import gateway
import visitor_views

ROOT = Path(__file__).resolve().parents[1]
SPACE = ROOT / "space"


def test_native_asset_projection_retains_exact_accepted_bytes() -> None:
    projection = json.loads((SPACE / "szl-brand-PROJECTION.json").read_text())
    upstream = json.loads((SPACE / "szl-brand-SOURCE.json").read_text())
    assert projection["canonical_token_source"] == upstream["source_commit"] == "27d12e77fc0f9f1a0e5fae8b34adf2380d51d070"
    assert projection["bundle_commit"] == "4309f6fce89179331b0b3ed8c99494e76c5be256"
    expected = {
        "szl-tokens.css": "81f7c9baeef0b435e6e3f9d0c4e0d70e40fa17df5d1f30697f623cd3ef5f8eab",
        "szl-brand-SOURCE.json": "967a77235227f1d75852fb61873e46336e67403cbc0e7e12b141e31c83fbd93d",
        "szl-orbit-icon.svg": "6e2b7d72a3af3d9602b79de41df0194ede6496a9661f057108ec224c0efc92e6",
        "szl-orbit-holo.svg": "66bbf937cb3cd257ec4ab5e7b016e4c09b5d6ea97f735453833a04c534a63b37",
    }
    assert set(projection["installed"]) == set(expected)
    for name, digest in expected.items():
        assert hashlib.sha256((SPACE / name).read_bytes()).hexdigest() == digest
        assert projection["installed"][name]["sha256"] == digest


@pytest.mark.parametrize("document,style", [
    ("space/index.html", "atlas.css"),
    ("space/launchpad.html", "launchpad.css"),
    ("visitor_views.py", "atlas-demos.css"),
])
def test_served_styles_have_content_versioned_urls(document: str, style: str) -> None:
    text = (ROOT / document).read_text()
    digest = hashlib.sha256((SPACE / style).read_bytes()).hexdigest()[:12]
    assert f'href="/{style}?v={digest}"' in text
    token_digest = hashlib.sha256((SPACE / "szl-tokens.css").read_bytes()).hexdigest()[:12]
    assert f'href="/szl-tokens.css?v={token_digest}"' in text
    assert text.index('href="/szl-tokens.css') < text.index(f'href="/{style}')
    assert "<style>" not in text


def test_every_allowlisted_asset_is_shipped_and_no_generic_route_is_added() -> None:
    docker = (ROOT / "Dockerfile").read_text()
    for path in gateway.PUBLIC_ASSET_PATHS:
        name = path.removeprefix("/")
        assert re.fullmatch(r"[A-Za-z0-9_.-]+", name)
        assert f"COPY space/{name} ./{name}" in docker
        status, raw, mime = gateway._load_public_asset(path)
        assert status == 200 and raw == (SPACE / name).read_bytes()
        assert mime != "text/plain; charset=utf-8"
    for path in ("/../server.py", "/atlas.css/..", "/space/index.html", "/Dockerfile"):
        assert gateway._load_public_asset(path)[0] == 404


@pytest.mark.parametrize("kind", ["symlink", "oversize", "marker-drift"])
def test_new_style_uses_existing_fail_closed_asset_loader(tmp_path: Path, monkeypatch, kind: str) -> None:
    candidate = tmp_path / "atlas.css"
    if kind == "symlink":
        candidate.symlink_to(SPACE / "atlas.css")
    elif kind == "oversize":
        candidate.write_bytes(b"x" * (gateway.MAX_PUBLIC_ASSET_BYTES + 1))
    else:
        candidate.write_text("body { color: red; }")
    monkeypatch.setitem(gateway.PUBLIC_ASSET_SPECS, "/atlas.css", ((candidate,), "text/css; charset=utf-8", ("SZL Atlas native components",)))
    assert gateway._load_public_asset("/atlas.css")[0] == 503


def test_demo_frame_keeps_escaped_content_and_native_assets() -> None:
    body = visitor_views._page('<script>alert("fixture")</script>', "<p>Fixed local fixture</p>").decode()
    assert "&lt;script&gt;" in body and '<script>alert("fixture")</script>' not in body
    assert 'src="/szl-orbit-icon.svg"' in body
    assert 'href="/atlas-demos.css?v=' in body
    assert 'data-surface="dark"' in body


def test_atlas_uses_native_orbit_asset_once_without_redrawing() -> None:
    html = (SPACE / "index.html").read_text()
    assert html.count('src="/szl-orbit-holo.svg"') == 1
    assert 'id="szl-orbit"' not in html
    assert 'aria-label="SZL governed command fabric visualization"' in html
    assert "Models propose" in html and "Humans bind" in html
