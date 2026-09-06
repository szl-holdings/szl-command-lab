from __future__ import annotations

from pathlib import Path

import gateway
import server

ROOT = Path(__file__).parents[1]
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
        'fetch("/api/launchpad"',
        "Navigation does not certify availability",
        "navigation is not runtime proof",
        "Availability and capability are verified separately.",
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

    assert 'link.rel = "noopener noreferrer"' in text
    assert "replaceChildren" in text
    assert "textContent" in text


def test_gateway_preserves_existing_atlas_handler_and_routes() -> None:
    assert issubclass(gateway.Handler, server.Handler)
    assert gateway.Handler.server_version == "SZLAtlasGateway/1.0"
    assert "main" in gateway.__dict__


def test_docker_runtime_ships_and_starts_the_permanent_gateway() -> None:
    text = DOCKERFILE.read_text(encoding="utf-8")

    for marker in (
        "COPY server.py ./server.py",
        "COPY gateway.py ./gateway.py",
        "COPY space/index.html ./index.html",
        "COPY space/launchpad.html ./launchpad.html",
        'CMD ["python", "-u", "gateway.py"]',
    ):
        assert marker in text
    assert 'CMD ["python", "-u", "server.py"]' not in text


def test_hugging_face_deploy_uses_the_central_exact_source_publisher() -> None:
    text = DEPLOY_WORKFLOW.read_text(encoding="utf-8")

    for marker in (
        "branches: [main]",
        "group: szl-command-lab-hf-release",
        f"reusable-hf-deploy.yml@{REUSABLE_DEPLOY_SHA}",
        "hf-repo: SZLHOLDINGS/szl-command-lab",
        "ref: ${{ github.sha }}",
        "require-default-branch-tip: true",
        "source-revision-variable: SZL_GIT_SHA",
        "source-revision-probe-path: /api/build-info",
        "wait-running: 1200",
        "prune: true",
        'smoke-paths: \'["/","/launchpad","/api/build-info","/api/launchpad","/healthz"]\'',
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
