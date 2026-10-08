#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Versioned, read-only public demo adapters over fixed committed fixtures."""
from __future__ import annotations

import hashlib
import json
import math
import stat
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from szl_retrieval_bench.bm25 import BM25
from szl_guardrail_receipt.receipt import decode_decision
from szl_guardrail_receipt.verify import (
    check_chain,
    check_content_hash,
    check_decision_fields,
    check_dsse_structure,
    check_signature,
    verify_records,
)

import server

HERE = Path(__file__).resolve().parent
CORPUS_PATHS = (HERE / "corpus.json", HERE / "demo_data" / "corpus.json")
RECEIPT_ROOTS = (HERE / "receipts", HERE / "demo_data" / "receipts")
MAX_CORPUS_BYTES = 16_384
MAX_RECEIPT_BYTES = 16_384
QUERY_IDS = frozenset({"inventory", "product", "proof"})
RECEIPT_IDS = frozenset({"intact", "tampered", "unsigned"})
SOURCE_SURFACE_ID = "szl-command-lab"

# These artifact identities are pinned in requirements-public-demos.txt.
ADAPTERS = (
    {
        "id": "retrieval-bm25",
        "distribution": "szl-retrieval-bench",
        "version": "0.3.1",
        "source_revision": "fd7bdd79573a5045934e6d65cfaf86f619cdd15c",
        "wheel_sha256": "a9dd8aceb048e6e0c6f5f01a4b6d44fd0a755dbcf649224d91a155952563a043",
        "method": "BM25 lexical ranking",
        "limits": {"documents": 5, "queries": 3, "results": 3, "input": "fixed committed IDs"},
    },
    {
        "id": "receipt-verification",
        "distribution": "szl-guardrail-receipt",
        "version": "0.1.2",
        "source_revision": "340cafd3178e80ef6ebc5ba19f389f0ce4a3253f",
        "wheel_sha256": "e1814fa8b021f900aa3c39c0a503c58e7d8fa93165e32427d998576e044d8085",
        "method": "Offline DSSE structure, hash, fields, and chain checks",
        "limits": {"fixtures": 3, "records_per_fixture": 2, "input": "fixed committed IDs"},
    },
)


class UnknownFixture(ValueError):
    """An unregistered fixture ID has no execution path."""


class DemoUnavailable(RuntimeError):
    """A fixed artifact or qualified distribution is unavailable."""


def _distribution_ready(spec: dict[str, Any]) -> bool:
    try:
        return version(spec["distribution"]) == spec["version"]
    except PackageNotFoundError:
        return False


def _require_distribution(adapter_id: str) -> None:
    spec = next(row for row in ADAPTERS if row["id"] == adapter_id)
    if not _distribution_ready(spec):
        raise DemoUnavailable("Qualified package version unavailable")


def registry_payload() -> dict[str, Any]:
    """One registry, source-linked to the existing SURFACES navigation authority."""
    source_rows = [row for row in server.SURFACES if row[0] == SOURCE_SURFACE_ID]
    if len(source_rows) != 1:
        raise DemoUnavailable("Atlas navigation source unavailable")
    source_href = source_rows[0][2]
    adapters = [
        {
            **spec,
            "state": "AVAILABLE" if _distribution_ready(spec) else "UNAVAILABLE",
            "authority": "NONE",
            "effects": [],
            "surface_id": SOURCE_SURFACE_ID,
        }
        for spec in ADAPTERS
    ]
    return {
        "schema": "szl.atlas.adapters/v1",
        "source_repository": "szl-holdings/szl-command-lab",
        "source_revision": server.build_info().get("source_revision"),
        "surface_id": SOURCE_SURFACE_ID,
        "surface_href": source_href,
        "adapters": adapters,
        "authority": "NONE",
        "public_effectors": [],
        "claim_boundary": "Fixed read-only demonstrations; no scientific validity or action authority follows.",
    }


def _read_fixed(paths: tuple[Path, ...], limit: int) -> Any:
    for path in paths:
        try:
            if path.is_symlink():
                continue
            metadata = path.stat(follow_symlinks=False)
            if not stat.S_ISREG(metadata.st_mode) or not 0 < metadata.st_size <= limit:
                continue
            raw = path.read_bytes()
            if len(raw) != metadata.st_size:
                continue
            return json.loads(raw.decode("utf-8"))
        except (OSError, UnicodeError, ValueError):
            continue
    raise DemoUnavailable("Committed fixture unavailable")


def _corpus() -> tuple[list[dict[str, str]], dict[str, str]]:
    data = _read_fixed(CORPUS_PATHS, MAX_CORPUS_BYTES)
    if not isinstance(data, dict) or data.get("schema") != "szl.atlas.public-corpus/v1":
        raise DemoUnavailable("Corpus contract mismatch")
    documents = data.get("documents")
    queries = data.get("queries")
    if not isinstance(documents, list) or len(documents) != 5:
        raise DemoUnavailable("Corpus document bound mismatch")
    if not isinstance(queries, list) or len(queries) != 3:
        raise DemoUnavailable("Corpus query bound mismatch")
    for row in documents:
        if not isinstance(row, dict) or not all(
            isinstance(row.get(key), str) and 0 < len(row[key]) <= 512
            for key in ("id", "title", "text", "source")
        ):
            raise DemoUnavailable("Corpus row invalid")
        source = urlparse(row["source"])
        if (source.scheme != "https" or source.hostname not in {"github.com", "a-11-oy.com", "a11oy.net"}
                or source.username or source.password or source.port not in (None, 443)):
            raise DemoUnavailable("Corpus source invalid")
        if source.hostname == "github.com" and not source.path.startswith("/szl-holdings/szl-command-lab/"):
            raise DemoUnavailable("Corpus source invalid")
    if len({row["id"] for row in documents}) != len(documents):
        raise DemoUnavailable("Duplicate document IDs")
    query_map: dict[str, str] = {}
    for row in queries:
        if not isinstance(row, dict) or row.get("id") not in QUERY_IDS:
            raise DemoUnavailable("Query contract mismatch")
        query = row.get("text")
        if not isinstance(query, str) or not 0 < len(query) <= 96:
            raise DemoUnavailable("Query bound mismatch")
        query_map[row["id"]] = query
    if set(query_map) != QUERY_IDS:
        raise DemoUnavailable("Query IDs mismatch")
    return documents, query_map


def retrieval_demo(query_id: str) -> dict[str, Any]:
    if query_id not in QUERY_IDS:
        raise UnknownFixture(query_id)
    _require_distribution("retrieval-bm25")
    documents, queries = _corpus()
    doc_ids = [row["id"] for row in documents]
    query = queries[query_id]
    ranker = BM25([row["text"] for row in documents])
    scores = ranker.score(query)
    ranked = ranker.rank(query, doc_ids)
    if len(scores) != len(documents) or set(ranked) != set(doc_ids):
        raise DemoUnavailable("Retrieval output invalid")
    by_id = {row["id"]: row for row in documents}
    score_by_id = dict(zip(doc_ids, scores, strict=True))
    results = []
    for rank, document_id in enumerate(ranked[:3], start=1):
        score = score_by_id[document_id]
        if not math.isfinite(score):
            raise DemoUnavailable("Retrieval score invalid")
        results.append({"rank": rank, "score": round(score, 4), **by_id[document_id]})
    return {
        "query_id": query_id,
        "query": query,
        "results": results,
        "state": "FIXED_DEMO",
        "method": "BM25 lexical ranking",
        "scientific_validity": "NOT_EVALUATED",
        "authority": "NONE",
    }


def receipt_demo(fixture_id: str) -> dict[str, Any]:
    if fixture_id not in RECEIPT_IDS:
        raise UnknownFixture(fixture_id)
    _require_distribution("receipt-verification")
    records = _read_fixed(tuple(root / f"{fixture_id}.json" for root in RECEIPT_ROOTS), MAX_RECEIPT_BYTES)
    if not isinstance(records, list) or not 1 <= len(records) <= 2:
        raise DemoUnavailable("Receipt fixture bound mismatch")
    decisions = []
    integrity_checks = []
    signature_checks = []
    for record in records:
        if not isinstance(record, dict):
            raise DemoUnavailable("Receipt record invalid")
        envelope = record.get("envelope")
        structure_ok, _ = check_dsse_structure(envelope)
        if not structure_ok or not isinstance(envelope, dict):
            integrity_checks.append(False)
            continue
        hash_ok, _ = check_content_hash(envelope)
        hash_ok = hash_ok and isinstance(envelope.get("_pae_sha256"), str) and len(envelope["_pae_sha256"]) == 64
        decision = decode_decision(record)
        if not isinstance(decision, dict):
            integrity_checks.append(False)
            continue
        fields_ok, _ = check_decision_fields(decision)
        body_without_digest = {key: value for key, value in decision.items() if key != "digest"}
        canonical = json.dumps(body_without_digest, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        digest_ok = hashlib.sha256(canonical).hexdigest() == decision.get("digest")
        decisions.append(decision)
        signature_ok, _ = check_signature(decision, envelope, None)
        signature_checks.append(signature_ok)
        integrity_checks.append(structure_ok and hash_ok and fields_ok and digest_ok)
    chain_ok, _ = check_chain(decisions)
    package_ok, report = verify_records(records)
    integrity_ok = all(integrity_checks) and chain_ok and package_ok and len(decisions) == len(records)
    if False in signature_checks:
        signature = "FAIL"
    elif signature_checks and all(item is True for item in signature_checks):
        signature = "PASS"
    else:
        signature = "SKIP"
    return {
        "fixture_id": fixture_id,
        "records": len(records),
        "integrity": "PASS" if integrity_ok else "FAIL",
        "signature": signature,
        "scientific_validity": "NOT_EVALUATED",
        "authority": "NONE",
        "package_verifier_ok": package_ok,
        "report": report,
    }
