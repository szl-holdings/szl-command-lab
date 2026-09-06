#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Publish the exact protected-main SZL Atlas closure to Hugging Face.

The publisher never prints credentials, never creates a second target, and
does not treat a provider commit or HTTP 200 as readiness. It succeeds only
after the public runtime exposes the exact GitHub source revision, the scoped
deployment receipt, and the Launchpad marker.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE_REPOSITORY = "szl-holdings/szl-command-lab"
TARGET_REPO_ID = "SZLHOLDINGS/szl-command-lab"
TARGET_ORIGIN = "https://szlholdings-szl-command-lab.hf.space"
SHA_LENGTH = 40
MAX_READ_BYTES = 2_000_000
PAYLOAD_MAPPING = (
    (".gitattributes", ".gitattributes"),
    ("Dockerfile", "Dockerfile"),
    ("Dockerfile.dockerignore", "Dockerfile.dockerignore"),
    ("README.md", "README.md"),
    ("server.py", "server.py"),
    ("space/index.html", "space/index.html"),
    ("space/launchpad.html", "space/launchpad.html"),
)
EXPECTED_FILES = {destination for _, destination in PAYLOAD_MAPPING} | {"deployment.json"}


class PublishError(RuntimeError):
    """Fail-closed publication error."""


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_sha(value: str) -> str:
    normalized = value.strip().lower()
    if len(normalized) != SHA_LENGTH or any(char not in "0123456789abcdef" for char in normalized):
        raise PublishError("source revision must be exactly 40 lowercase hexadecimal characters")
    return normalized


def run(command: list[str]) -> str:
    result = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise PublishError(f"{command[0]} failed: {detail}")
    return result.stdout.strip()


def exact_main_revision() -> str:
    local = require_sha(run(["git", "rev-parse", "HEAD"]))
    remote_line = run(["git", "ls-remote", "--exit-code", "origin", "refs/heads/main"])
    remote = require_sha(remote_line.split()[0])
    if local != remote:
        raise PublishError(f"local revision {local} is not current origin/main {remote}")

    event_sha = os.environ.get("GITHUB_SHA", "").strip().lower()
    if event_sha:
        event_sha = require_sha(event_sha)
        if event_sha != local:
            raise PublishError(
                f"workflow event revision {event_sha} does not equal checked-out main {local}"
            )
    if run(["git", "status", "--porcelain"]):
        raise PublishError("publication requires a clean source checkout")
    return local


def deployment_receipt(source_sha: str) -> dict[str, Any]:
    revision = require_sha(source_sha)
    return {
        "schema": "szl.source-deployment/v1",
        "source": {
            "repository": SOURCE_REPOSITORY,
            "revision": revision,
        },
        "target": {
            "repo_id": TARGET_REPO_ID,
            "repo_type": "space",
            "origin": TARGET_ORIGIN,
        },
        "state": "SOURCE_BOUND",
        "generated_at": utc_now(),
        "claim_boundary": (
            "This receipt binds one public artifact closure to one GitHub revision. "
            "It does not prove correctness, safety, performance, authorization, or readiness."
        ),
    }


def materialize(destination: Path, source_sha: str) -> dict[str, Any]:
    revision = require_sha(source_sha)
    destination.mkdir(parents=True, exist_ok=True)
    if any(destination.iterdir()):
        raise PublishError("materialization destination must be empty")

    for source_name, target_name in PAYLOAD_MAPPING:
        source = ROOT / source_name
        target = destination / target_name
        if not source.is_file():
            raise PublishError(f"required source file is missing: {source_name}")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

    receipt = deployment_receipt(revision)
    (destination / "deployment.json").write_text(
        json.dumps(receipt, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    actual = {
        path.relative_to(destination).as_posix()
        for path in destination.rglob("*")
        if path.is_file()
    }
    if actual != EXPECTED_FILES:
        raise PublishError(
            f"materialized file set differs: missing={sorted(EXPECTED_FILES - actual)} "
            f"unexpected={sorted(actual - EXPECTED_FILES)}"
        )

    files = [
        {
            "path": relative,
            "bytes": (destination / relative).stat().st_size,
            "sha256": sha256_file(destination / relative),
        }
        for relative in sorted(actual)
    ]
    return {
        "schema": "szl.hf-publication-plan/v1",
        "state": "MATERIALIZED",
        "source_repository": SOURCE_REPOSITORY,
        "source_revision": revision,
        "target_repo_id": TARGET_REPO_ID,
        "file_count": len(files),
        "files": files,
    }


def _org_names(identity: dict[str, Any]) -> set[str]:
    value = identity.get("orgs") or []
    if isinstance(value, str):
        return {item.strip() for item in value.split(",") if item.strip()}
    result: set[str] = set()
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                name = item.get("name")
                if isinstance(name, str):
                    result.add(name)
            elif isinstance(item, str):
                result.add(item)
    return result


def fetch_bytes(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json, text/html;q=0.9",
            "Cache-Control": "no-cache",
            "User-Agent": "szl-command-lab-source-witness/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        final = response.geturl()
        if not final.startswith(TARGET_ORIGIN + "/") and final != TARGET_ORIGIN:
            raise PublishError(f"cross-origin readback redirect rejected: {final}")
        payload = response.read(MAX_READ_BYTES + 1)
        if len(payload) > MAX_READ_BYTES:
            raise PublishError(f"readback exceeded {MAX_READ_BYTES} bytes: {url}")
        return payload


def fetch_json(url: str) -> dict[str, Any]:
    try:
        payload = json.loads(fetch_bytes(url))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise PublishError(f"readback is not valid JSON: {url}") from exc
    if not isinstance(payload, dict):
        raise PublishError(f"readback is not an object: {url}")
    return payload


def runtime_stage(info: Any) -> str:
    runtime = getattr(info, "runtime", None)
    if runtime is None:
        return "UNKNOWN"
    stage = getattr(runtime, "stage", None)
    if stage is None and isinstance(runtime, dict):
        stage = runtime.get("stage")
    return str(stage or "UNKNOWN")


def publish(payload_dir: Path, source_sha: str, timeout: float) -> dict[str, Any]:
    try:
        from huggingface_hub import HfApi
    except ImportError as exc:
        raise PublishError("huggingface_hub is required for --apply") from exc

    token = os.environ.get("HF_TOKEN", "")
    if not token:
        raise PublishError("HF_TOKEN is not configured")

    api = HfApi(token=token)
    identity = api.whoami()
    if "SZLHOLDINGS" not in _org_names(identity):
        raise PublishError("active Hugging Face identity is not a SZLHOLDINGS member")

    before = api.space_info(TARGET_REPO_ID, files_metadata=True)
    if bool(getattr(before, "private", True)):
        raise PublishError("target Space must remain public")
    if str(getattr(before, "sdk", "")).lower() != "docker":
        raise PublishError("target Space SDK must remain docker")
    parent_commit = str(getattr(before, "sha", "") or "")
    if not parent_commit:
        raise PublishError("target Space has no provider revision")
    before_files = {
        str(item.rfilename)
        for item in (getattr(before, "siblings", None) or [])
        if getattr(item, "rfilename", None)
    }
    stale_files = sorted(before_files - EXPECTED_FILES)

    commit = api.upload_folder(
        repo_id=TARGET_REPO_ID,
        repo_type="space",
        folder_path=str(payload_dir),
        path_in_repo=".",
        parent_commit=parent_commit,
        delete_patterns=stale_files or None,
        commit_message=f"deploy: exact source {source_sha[:12]}",
        commit_description=(
            f"Canonical source: https://github.com/{SOURCE_REPOSITORY}/commit/{source_sha}\n"
            "Generated by the source-owned protected-main publisher."
        ),
    )

    deadline = time.monotonic() + timeout
    observations: list[dict[str, Any]] = []
    last_error = "runtime has not been observed"
    terminal_stages = {"BUILD_ERROR", "CONFIG_ERROR", "RUNTIME_ERROR", "PAUSED", "STOPPED"}

    while time.monotonic() < deadline:
        try:
            info = api.space_info(TARGET_REPO_ID, files_metadata=True)
            stage = runtime_stage(info)
            siblings = {
                str(item.rfilename)
                for item in (getattr(info, "siblings", None) or [])
                if getattr(item, "rfilename", None)
            }
            observation = {
                "observed_at": utc_now(),
                "provider_sha": getattr(info, "sha", None),
                "stage": stage,
                "file_count": len(siblings),
            }
            observations.append(observation)

            if stage in terminal_stages or "ERROR" in stage:
                raise PublishError(f"target Space entered terminal stage {stage}")
            if stage != "RUNNING":
                last_error = f"target stage is {stage}"
                time.sleep(10)
                continue
            if siblings != EXPECTED_FILES:
                last_error = (
                    f"provider file set differs: missing={sorted(EXPECTED_FILES - siblings)} "
                    f"unexpected={sorted(siblings - EXPECTED_FILES)}"
                )
                time.sleep(10)
                continue

            build = fetch_json(TARGET_ORIGIN + "/api/build-info")
            receipt = fetch_json(TARGET_ORIGIN + "/deployment.json")
            launchpad = fetch_bytes(TARGET_ORIGIN + "/launchpad")
            receipt_source = receipt.get("source") if isinstance(receipt.get("source"), dict) else {}

            if build.get("source_repository") != SOURCE_REPOSITORY:
                last_error = "build-info source repository differs"
            elif build.get("source_revision") != source_sha:
                last_error = "build-info source revision differs"
            elif build.get("state") != "SOURCE_BOUND":
                last_error = f"build-info state is {build.get('state')!r}"
            elif receipt.get("schema") != "szl.source-deployment/v1":
                last_error = "deployment receipt schema differs"
            elif receipt_source.get("repository") != SOURCE_REPOSITORY:
                last_error = "deployment receipt repository differs"
            elif receipt_source.get("revision") != source_sha:
                last_error = "deployment receipt revision differs"
            elif b'data-szl-surface="launchpad-v1"' not in launchpad:
                last_error = "Launchpad source marker is missing"
            else:
                return {
                    "schema": "szl.hf-publication-result/v1",
                    "state": "VERIFIED_PUBLIC_READBACK",
                    "source_repository": SOURCE_REPOSITORY,
                    "source_revision": source_sha,
                    "target_repo_id": TARGET_REPO_ID,
                    "target_origin": TARGET_ORIGIN,
                    "provider_commit": str(
                        getattr(commit, "oid", "") or getattr(commit, "commit_url", "")
                    ),
                    "provider_sha": getattr(info, "sha", None),
                    "runtime_stage": stage,
                    "files": sorted(siblings),
                    "build_info": build,
                    "deployment_receipt": receipt,
                    "observations": observations,
                    "verified_at": utc_now(),
                    "boundary": (
                        "Exact-source public readback is verified. This is not a production, "
                        "safety, compliance, performance, or authorization certificate."
                    ),
                }
        except PublishError:
            raise
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            last_error = f"{type(exc).__name__}: {exc}"
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
        time.sleep(10)

    raise PublishError(f"public runtime did not converge before timeout: {last_error}")


def write_report(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True, default=str) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Publish and verify the exact closure")
    parser.add_argument("--source-sha", help="Explicit source SHA for dry materialization only")
    parser.add_argument("--materialize", type=Path, help="Optional empty materialization directory")
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("reports/szl-command-lab-publication.json"),
    )
    parser.add_argument("--timeout", type=float, default=1200.0)
    args = parser.parse_args()

    try:
        if args.apply and args.source_sha:
            raise PublishError("--source-sha cannot override protected-main verification during --apply")
        source_sha = exact_main_revision() if args.apply else require_sha(args.source_sha or ("0" * 40))
        if args.materialize:
            plan = materialize(args.materialize, source_sha)
            result = (
                plan
                if not args.apply
                else {
                    "plan": plan,
                    "publication": publish(args.materialize, source_sha, args.timeout),
                }
            )
        else:
            with tempfile.TemporaryDirectory(prefix="szl-command-lab-") as temp:
                plan = materialize(Path(temp), source_sha)
                result = (
                    plan
                    if not args.apply
                    else {
                        "plan": plan,
                        "publication": publish(Path(temp), source_sha, args.timeout),
                    }
                )
        write_report(args.report, result)
        print(
            json.dumps(
                {
                    "state": result.get("state")
                    or result.get("publication", {}).get("state"),
                    "report": str(args.report),
                },
                sort_keys=True,
            )
        )
        return 0
    except Exception as exc:
        failure = {
            "schema": "szl.hf-publication-result/v1",
            "state": "BLOCKED",
            "error_type": type(exc).__name__,
            "error": str(exc),
            "observed_at": utc_now(),
        }
        write_report(args.report, failure)
        print(json.dumps(failure, sort_keys=True))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
