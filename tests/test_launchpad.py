from __future__ import annotations

import io
import json
import re
from pathlib import Path

import pytest

import gateway
import launchpad_views
import server

ROOT = Path(__file__).parents[1]
INDEX = ROOT / "space" / "index.html"
LAUNCHPAD = ROOT / "space" / "launchpad.html"
DOCKERFILE = ROOT / "Dockerfile"
DEPLOY_WORKFLOW = ROOT / ".github" / "workflows" / "hf-sync.yml"
REUSABLE_DEPLOY_SHA = "3537cba978d018c7c924ab1f90e18c0f879eb886"
HF_PUBLISHER_SECRET_EXPRESSION = (
    "HF_TOKEN: ${{ secrets.HF_ORG_TOKEN || secrets.HF_ORG_TOKEN1 || "
    "secrets.HF_WRITE_TOKEN || secrets.HF_TOKEN || secrets.HUGGINGFACE_TOKEN || "
    "secrets.HUGGING_FACE_HUB_TOKEN }}"
)
HF_PUBLISHER_ALIAS_ORDER = (
    "secrets.HF_ORG_TOKEN",
    "secrets.HF_ORG_TOKEN1",
    "secrets.HF_WRITE_TOKEN",
    "secrets.HF_TOKEN",
    "secrets.HUGGINGFACE_TOKEN",
    "secrets.HUGGING_FACE_HUB_TOKEN",
)


def test_launchpad_payload_is_navigation_only_and_source_controlled() -> None:
    payload = gateway.launchpad_payload()

    assert payload["schema"] == "szl.atlas.launchpad/v1"
    assert payload["state"] == "REGISTERED_NAVIGATION"
    assert payload["source_repository"] == "szl-holdings/szl-command-lab"
    assert payload["source_state"] in {"SOURCE_BOUND", "REVISION_UNAVAILABLE"}
    assert payload["surface_count"] == len(server.SURFACES)
    assert payload["errors"] == []
    assert payload["public_effectors"] == []
    assert payload["authorization"] == "NONE"
    assert "verified independently" in payload["claim_boundary"]

    surfaces = payload["surfaces"]
    assert len(surfaces) == len({row["id"] for row in surfaces})
    assert len(surfaces) == len({row["href"] for row in surfaces})
    assert surfaces == sorted(surfaces, key=lambda item: (item["id"].casefold(), item["href"]))
    assert all(set(row) == {"id", "role", "href"} for row in surfaces)
    assert all(row["href"].startswith("https://") for row in surfaces)
    assert all("health" not in row and "live" not in row for row in surfaces)


def test_launchpad_file_load_is_bounded_and_contract_checked() -> None:
    status, raw, state = gateway._load_launchpad()

    assert status == 200
    assert state == "SOURCE_CONTROLLED"
    assert 0 < len(raw) <= gateway.MAX_LAUNCHPAD_BYTES
    assert b'data-szl-surface="atlas-launchpad-v1"' in raw
    assert gateway.LAUNCHPAD_HTML_PATHS == frozenset({"/launchpad", "/launchpad.html"})
    assert gateway.LAUNCHPAD_API_PATH == "/api/launchpad"


def test_launchpad_html_is_accessible_and_evidence_honest() -> None:
    text = LAUNCHPAD.read_text(encoding="utf-8")

    for marker in (
        'lang="en"',
        'name="viewport"',
        "Skip to Launchpad",
        ":focus-visible",
        "min-height: 44px",
        "prefers-reduced-motion: reduce",
        "forced-colors: active",
        'aria-live="polite"',
        "<!-- SZL_REGISTERED_SURFACES -->",
        "GET /api/launchpad",
        "Navigation does not certify availability",
        "navigation is not runtime proof",
        "Conjecture 1 — OPEN",
    ):
        assert marker in text

    for forbidden in (
        "fonts.googleapis.com",
        "fonts.gstatic.com",
        ".innerHTML",
        "document.write",
        "every link on this page resolves",
        "production ready",
        "Fleet health:",
    ):
        assert forbidden not in text

    assert "<script" not in text
    assert 'fetch("/api/launchpad"' not in text
    assert "html { min-width: 0;" in text


def test_gateway_preserves_existing_atlas_handler_and_routes() -> None:
    assert issubclass(gateway.Handler, server.Handler)
    assert gateway.Handler.server_version == "SZLAtlasGateway/1.0"
    assert "main" in gateway.__dict__


def test_holographic_assets_are_source_bound_and_runtime_served() -> None:
    index = INDEX.read_text(encoding="utf-8")
    assert 'href="/szl-holo-v2.css"' in index
    assert 'src="/szl-holo-v2.js"' in index
    assert gateway.PUBLIC_ASSET_PATHS == frozenset(
        {"/szl-holo-v2.css", "/szl-holo-v2.js"}
    )

    for path, expected_type in (
        ("/szl-holo-v2.css", "text/css; charset=utf-8"),
        ("/szl-holo-v2.js", "text/javascript; charset=utf-8"),
    ):
        status, raw, content_type = gateway._load_public_asset(path)
        assert status == 200
        assert 0 < len(raw) <= gateway.MAX_PUBLIC_ASSET_BYTES
        assert content_type == expected_type

    assert gateway._load_public_asset("/not-allowlisted.txt")[0] == 404


def test_docker_runtime_ships_and_starts_the_permanent_gateway() -> None:
    text = DOCKERFILE.read_text(encoding="utf-8")

    for marker in (
        "COPY server.py ./server.py",
        "COPY gateway.py ./gateway.py",
        "COPY space/index.html ./index.html",
        "COPY space/launchpad.html ./launchpad.html",
        "COPY space/szl-holo-v2.css ./szl-holo-v2.css",
        "COPY space/szl-holo-v2.js ./szl-holo-v2.js",
        'CMD ["python", "-u", "gateway.py"]',
    ):
        assert marker in text
    assert 'CMD ["python", "-u", "server.py"]' not in text


def test_hugging_face_deploy_uses_the_central_exact_source_publisher() -> None:
    text = DEPLOY_WORKFLOW.read_text(encoding="utf-8")

    for marker in (
        "branches: [main]",
        "group: hf-write/space/SZLHOLDINGS/szl-command-lab",
        "cancel-in-progress: false",
        f"reusable-hf-deploy.yml@{REUSABLE_DEPLOY_SHA}",
        "hf-repo: SZLHOLDINGS/szl-command-lab",
        "ref: ${{ github.sha }}",
        "require-default-branch-tip: true",
        "source-revision-variable: SZL_GIT_SHA",
        "source-revision-probe-path: /api/build-info",
        "wait-running: 1200",
        "prune: true",
        'smoke-paths: \'["/","/launchpad","/api/build-info","/api/launchpad","/healthz","/readyz","/api/yarqa"]\'',
        HF_PUBLISHER_SECRET_EXPRESSION,
    ):
        assert marker in text

    assert "secrets: inherit" not in text
    assert "huggingface-cli" not in text
    assert "hf upload" not in text
    assert ".upload_file(" not in text


def test_hugging_face_publisher_aliases_are_complete_ordered_and_not_logged() -> None:
    text = DEPLOY_WORKFLOW.read_text(encoding="utf-8")

    offsets = [text.index(alias) for alias in HF_PUBLISHER_ALIAS_ORDER]
    assert offsets == sorted(offsets)
    assert len(set(offsets)) == len(HF_PUBLISHER_ALIAS_ORDER)
    assert text.count("HF_TOKEN: ${{") == 1
    assert "echo ${{ secrets." not in text
    assert "print(${{ secrets." not in text
    assert "GITHUB_ENV" not in text
    assert "GITHUB_OUTPUT" not in text


def test_runtime_base_image_is_digest_pinned() -> None:
    from_lines = [
        line.strip()
        for line in DOCKERFILE.read_text(encoding="utf-8").splitlines()
        if line.strip().upper().startswith("FROM ")
    ]

    assert len(from_lines) == 1
    assert re.fullmatch(
        r"FROM mirror\.gcr\.io/library/python:3\.14-slim@sha256:[0-9a-f]{64}",
        from_lines[0],
    )


def test_one_surface_list_governs_every_published_space_link() -> None:
    prefix = "https://huggingface.co/spaces/SZLHOLDINGS/"
    ids = [ident for ident, _role, _href, _url in server.SURFACES]

    assert len(ids) == len(set(ids))
    for ident, _role, href, url in server.SURFACES:
        assert href == f"{prefix}{ident}"
        assert url is None or url.startswith(f"https://szlholdings-{ident}.hf.space/")

    # The Atlas flagship cards may only name Spaces that the runtime probes, so
    # retiring a Space from SURFACES retires it from the published page too.
    index = INDEX.read_text(encoding="utf-8")
    block = index[index.index("const FLAGSHIPS = [") :]
    block = block[: block.index("];")]
    slugs = re.findall(r'slug: "([^"]+)"', block)
    assert slugs
    assert set(slugs) <= set(ids)


def _capture_launchpad(method: str, path: str) -> tuple[int, dict[str, str], bytes]:
    handler = object.__new__(gateway.Handler)
    handler.path = path
    handler.wfile = io.BytesIO()
    statuses: list[int] = []
    headers: dict[str, str] = {}
    handler.send_response = statuses.append
    handler.send_header = lambda key, value: headers.__setitem__(key, value)
    handler.end_headers = lambda: None
    getattr(handler, method)()
    return statuses[0], headers, handler.wfile.getvalue()


def test_launchpad_renders_registered_cards_and_source_status_without_script() -> None:
    status, raw, state = gateway._load_launchpad()
    text = raw.decode("utf-8")
    payload = gateway.launchpad_payload()

    assert (status, state) == (200, "SOURCE_CONTROLLED")
    assert 'data-state="REGISTERED_NAVIGATION"' in text
    assert '<span id="registry-status-text">Registry observed</span>' in text
    assert f'{len(server.SURFACES)} registered surfaces' in text
    assert 'aria-busy="false"' in text
    assert "GET /api/launchpad" in text
    assert "<script" not in text
    assert not any(marker in text for marker in launchpad_views.MARKERS)
    assert text.count('class="card external"') == payload["surface_count"]
    for row in payload["surfaces"]:
        assert f'href="{row["href"]}" target="_blank" rel="noopener noreferrer"' in text
        assert f'<strong>{row["id"]}</strong>' in text
    assert "Navigation does not certify availability" in text
    assert "navigation is not runtime proof" in text


def test_launchpad_escapes_all_registry_text_and_url_attributes() -> None:
    payload = gateway.launchpad_payload()
    payload["source_repository"] = '<repo title="unsafe">'
    payload["source_revision"] = '<script>alert("revision")</script>'
    payload["surfaces"] = [{
        "id": '<img src=x onerror="x">',
        "role": '<b onclick="x">role</b>',
        "href": 'https://example.org/?next="<script>&x=1',
    }]
    payload["surface_count"] = 1
    status, raw, _state = launchpad_views.render(LAUNCHPAD.read_text(encoding="utf-8"), payload)
    text = raw.decode("utf-8")

    assert status == 200
    assert '<img src=x' not in text
    assert '<script>alert("revision")</script>' not in text
    assert '&lt;repo title=&quot;unsafe&quot;&gt;' in text
    assert '&lt;script&gt;alert(&quot;revision&quot;)&lt;/script&gt;' in text
    assert '&lt;b onclick=&quot;x&quot;&gt;role&lt;/b&gt;' in text
    assert 'href="https://example.org/?next=&quot;&lt;script&gt;&amp;x=1"' in text
    assert '&lt;img src=x onerror=&quot;x&quot;&gt;' in text


def test_launchpad_bad_registry_fails_closed_without_partial_links(monkeypatch) -> None:
    base = gateway.launchpad_payload()
    bad_cases = (
        {"schema": "unknown"},
        {"state": '<svg onload="x">'},
        {"authorization": "LIVE"},
        {"surface_count": base["surface_count"] + 1},
        {"surfaces": "not a list"},
        {"errors": ["malformed-source-row"]},
    )
    template = LAUNCHPAD.read_text(encoding="utf-8")
    for changes in bad_cases:
        payload = {**base, **changes}
        status, raw, state = launchpad_views.render(template, payload)
        assert (status, state) == (503, "UNAVAILABLE")
        assert b"Registry unavailable. No destination state is inferred." in raw
        assert b'class="card external"' not in raw
        assert b'<svg onload="x">' not in raw

    malformed = {**base, "surfaces": [{"id": "safe", "role": "view", "href": "javascript:alert(1)"}],
                 "surface_count": 1}
    status, raw, _state = launchpad_views.render(template, malformed)
    assert status == 503
    assert b"javascript:alert" not in raw
    monkeypatch.setattr(gateway, "launchpad_payload", lambda: malformed)
    get_status, headers, body = _capture_launchpad("do_GET", "/launchpad")
    assert get_status == 503
    assert int(headers["Content-Length"]) == len(body)
    assert b'class="card external"' not in body


def test_launchpad_template_markers_are_exact_and_fail_closed() -> None:
    template = LAUNCHPAD.read_text(encoding="utf-8")
    payload = gateway.launchpad_payload()
    for marker in launchpad_views.MARKERS:
        with pytest.raises(ValueError):
            launchpad_views.render(template.replace(marker, "", 1), payload)
        with pytest.raises(ValueError):
            launchpad_views.render(template + marker, payload)


def test_launchpad_get_head_routes_and_csp_remain_equivalent() -> None:
    for path in ("/launchpad", "/launchpad.html", "/launchpad/", "/launchpad.html?view=1"):
        get_status, get_headers, body = _capture_launchpad("do_GET", path)
        head_status, head_headers, head_body = _capture_launchpad("do_HEAD", path)
        assert (get_status, head_status) == (200, 200)
        assert body.startswith(b"<!doctype html>")
        assert head_body == b""
        assert int(get_headers["Content-Length"]) == len(body)
        assert head_headers["Content-Length"] == get_headers["Content-Length"]
        assert get_headers["Cache-Control"] == "no-store"
        assert "form-action 'none'" in get_headers["Content-Security-Policy"]
        assert b"<form" not in body
        assert b'href="/"' in body
    assert _capture_launchpad("do_GET", "/api/launchpad")[0] == 200


def test_launchpad_render_module_is_shipped_and_triggers_sync() -> None:
    docker = DOCKERFILE.read_text(encoding="utf-8")
    workflow = DEPLOY_WORKFLOW.read_text(encoding="utf-8")
    assert "COPY launchpad_views.py ./launchpad_views.py" in docker
    assert "      - launchpad_views.py\n" in workflow


def test_launchpad_invalid_unicode_fails_closed() -> None:
    payload = gateway.launchpad_payload()
    payload["source_revision"] = "\ud800"
    status, raw, state = launchpad_views.render(LAUNCHPAD.read_text(encoding="utf-8"), payload)
    assert (status, state) == (503, "UNAVAILABLE")
    assert b'class="card external"' not in raw
    assert b"Registry unavailable" in raw


def test_launchpad_rejects_empty_url_userinfo() -> None:
    payload = gateway.launchpad_payload()
    template = LAUNCHPAD.read_text(encoding="utf-8")
    for href in ("https://@example.org/", "https://:@example.org/"):
        payload["surfaces"] = [{"id": "surface", "role": "view", "href": href}]
        payload["surface_count"] = 1
        status, raw, state = launchpad_views.render(template, payload)
        assert (status, state) == (503, "UNAVAILABLE")
        assert b'class="card external"' not in raw
        assert href.encode("utf-8") not in raw


def test_launchpad_registry_timeout_has_no_partial_cards(monkeypatch) -> None:
    def timed_out() -> None:
        raise TimeoutError("registry observation timed out")

    monkeypatch.setattr(gateway, "launchpad_payload", timed_out)
    get_status, get_headers, body = _capture_launchpad("do_GET", "/launchpad")
    head_status, head_headers, head_body = _capture_launchpad("do_HEAD", "/launchpad.html")
    assert (get_status, head_status) == (503, 503)
    assert b"Registry unavailable. No destination state is inferred." in body
    assert b'class="card external"' not in body
    assert head_body == b""
    assert head_headers["Content-Length"] == get_headers["Content-Length"]
    assert "form-action 'none'" in get_headers["Content-Security-Policy"]


@pytest.mark.parametrize(
    "href",
    (
        "https://@example.org/",
        "https://:@example.org/",
        "https://example.org/a b",
        "https://example.org\\route",
        "https://[::",
    ),
)
def test_launchpad_api_and_html_reject_unsafe_source_urls(monkeypatch, href: str) -> None:
    monkeypatch.setattr(server, "SURFACES", (("unsafe", "view", href, None),))
    payload = gateway.launchpad_payload()
    assert payload["schema"] == "szl.atlas.launchpad/v1"
    assert payload["state"] == "UNAVAILABLE"
    assert payload["surface_count"] == 0
    assert payload["surfaces"] == []
    assert payload["errors"] == ["unsafe-href:unsafe"]
    assert payload["authorization"] == "NONE"

    api_status, api_headers, api_body = _capture_launchpad("do_GET", "/api/launchpad")
    html_status, html_headers, html_body = _capture_launchpad("do_GET", "/launchpad")
    assert (api_status, html_status) == (503, 503)
    assert json.loads(api_body)["surfaces"] == []
    assert int(api_headers["Content-Length"]) == len(api_body)
    assert int(html_headers["Content-Length"]) == len(html_body)
    assert b'class="card external"' not in html_body
    assert b"Registry unavailable. No destination state is inferred." in html_body
