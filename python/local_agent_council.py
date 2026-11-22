"""SZL's *advisory-only* local model council, with no external authority.

Runs against a loopback Ollama endpoint and a FIXED PUBLIC synthetic prompt.
Never reads GitHub/HF credentials, browser state, filesystem inputs, or private
repository contents. Model-generated advice is untrusted data and is never
executed, merged, published, or promoted to training/deployment evidence.

Upstream weights are external to this repository and have separate licenses:
- Mistral AI Ministral 3 3B: Apache-2.0 (official Ollama 3 GB quant)
- Moonshot Kimi-VL A3B Thinking 2506: MIT, GGML-org quantized GGUF (~10.5 GB)
- Claude, GPT/Astra, Perplexity: external provider roles remain UNAVAILABLE.
"""
from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import re
import time
from typing import Any, Callable

HOST = "127.0.0.1"
PORT = 11434
MAX_REPLY_BYTES = 64_000
MAX_REPLY_CHARS = 1800
MAX_TOKENS = 96
TIMEOUT_SECONDS = 180
HEX64 = re.compile(r"^[a-f0-9]{64}$")

# No provider integration can be selected by a model response or CLI argument.
ROLES = (
    ("mistral_architect", "ministral-3:3b",
     "Suggest Python acceptance tests, with no tool use or provider claims."),
    ("kimi_reviewer", "hf.co/ggml-org/Kimi-VL-A3B-Thinking-2506-GGUF:Q4_K_M",
     "Challenge unsupported readiness claims and propose negative controls."),
)

# Immutable digests observed from the authorized Ollama tags readback on 2026-11-21.
# A retagged or otherwise changed weight is unavailable until this map is reviewed.
EXPECTED_DIGESTS = {
    "ministral-3:3b": "f04aa1c738f64e13c625b82ae92504fc0260fa6723b509ed1ece0fa188179b1d",
    "hf.co/ggml-org/Kimi-VL-A3B-Thinking-2506-GGUF:Q4_K_M": "e447dad4acfcb8f16c7021fedde7620feec8c1d5c878815771df28ad8a4cdc2d",
}
EXTERNAL_ROLES = {"claude": "UNAVAILABLE", "astra": "UNAVAILABLE",
                  "perplexity": "UNAVAILABLE"}

PUBLIC_BRIEF = (
    "Public synthetic design exercise for SZL Holdings. GitHub source is "
    "authoritative, Hugging Face Spaces are deployment targets. A provider "
    "RUNNING label is not proof of app functionality, trained weights or "
    "source parity. Give TWO CPU-only, falsifiable checks that detect false "
    "source-to-runtime readiness claims. Use no private source or credentials. "
    "Do not assume any test has been executed. Reply in under 65 words."
)
SYSTEM_POLICY = (
    "You are a LOCAL ADVISORY research worker. Never execute commands, request "
    "credentials, fetch private data, claim that synthetic tests are live proof, "
    "or grant action authority. If uncertain mark UNKNOWN. Return short plain text."
)


class CouncilError(Exception):
    """A bounded local model request did not complete safely."""


def _api_json(method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """The only network destination is the hard-coded loopback Ollama socket."""
    if (method, path) not in {("GET", "/api/tags"), ("POST", "/api/chat")}:
        raise CouncilError("API_NOT_ALLOWLISTED")
    body = None if payload is None else json.dumps(
        payload, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")
    if body is not None and len(body) > 16_384:
        raise CouncilError("REQUEST_TOO_LARGE")
    conn = http.client.HTTPConnection(HOST, PORT, timeout=TIMEOUT_SECONDS)
    try:
        conn.request(method, path, body=body, headers={
            "Content-Type": "application/json", "Accept": "application/json",
        })
        response = conn.getresponse()
        if response.status != 200:
            raise CouncilError("OLLAMA_HTTP_NOT_200")
        raw = response.read(MAX_REPLY_BYTES + 1)
        if len(raw) > MAX_REPLY_BYTES:
            raise CouncilError("OLLAMA_REPLY_TOO_LARGE")
        obj = json.loads(raw)
    except CouncilError:
        raise
    except (OSError, TimeoutError, ValueError, UnicodeError, http.client.HTTPException):
        raise CouncilError("OLLAMA_UNAVAILABLE_OR_INVALID") from None
    finally:
        conn.close()
    if not isinstance(obj, dict):
        raise CouncilError("OLLAMA_REPLY_NOT_OBJECT")
    return obj


def listed_digests(call: Callable[..., dict[str, Any]] = _api_json) -> dict[str, str]:
    data = call("GET", "/api/tags")
    models = data.get("models")
    if not isinstance(models, list):
        raise CouncilError("OLLAMA_MODEL_LIST_UNKNOWN")
    result: dict[str, str] = {}
    for item in models:
        if not isinstance(item, dict):
            continue
        name, digest = item.get("name"), item.get("digest")
        if isinstance(name, str) and isinstance(digest, str) and HEX64.fullmatch(digest):
            result[name] = digest
    return result


def ask_local(model: str, role_instruction: str,
              call: Callable[..., dict[str, Any]] = _api_json) -> str:
    if model not in {item[1] for item in ROLES}:
        raise CouncilError("MODEL_NOT_ALLOWLISTED")
    reply = call("POST", "/api/chat", {
        "model": model,
        "stream": False,
        "messages": [
            {"role": "system", "content": SYSTEM_POLICY + " " + role_instruction},
            {"role": "user", "content": PUBLIC_BRIEF},
        ],
        # This lane is explicitly CPU-only and unloads each seat before the next one.
        "options": {"temperature": 0, "num_ctx": 1024, "num_predict": MAX_TOKENS,
                     "num_gpu": 0},
        "keep_alive": 0,
    })
    if reply.get("done") is not True:
        raise CouncilError("OLLAMA_REPLY_NOT_FINAL")
    if reply.get("model") != model:
        raise CouncilError("OLLAMA_MODEL_IDENTITY_MISMATCH")
    message = reply.get("message")
    if isinstance(message, dict) and message.get("tool_calls"):
        raise CouncilError("OLLAMA_TOOL_CALL_REFUSED")
    if not isinstance(message, dict) or not isinstance(message.get("content"), str):
        raise CouncilError("NO_TEXT_FROM_MODEL")
    result = message["content"].strip()
    if not result:
        raise CouncilError("EMPTY_MODEL_TEXT")
    if reply.get("done_reason") != "stop":
        raise CouncilError("OLLAMA_REPLY_NOT_STOPPED")
    if any(marker in result.casefold() for marker in ("◁think▷", "<think>", "</think>", "[think]")):
        raise CouncilError("OLLAMA_THINKING_TEXT")
    if len(result) > MAX_REPLY_CHARS:
        raise CouncilError("OLLAMA_REPLY_TOO_LONG")
    return result


def run_council(call: Callable[..., dict[str, Any]] = _api_json) -> dict[str, Any]:
    """Sequential CPU calls avoid disrupting preexisting model workloads."""
    digests = listed_digests(call)
    decisions: list[dict[str, Any]] = []
    for name, model, instruction in ROLES:
        entry: dict[str, Any] = {
            "seat": name, "model": model, "authority": "NONE", "status": "UNAVAILABLE",
        }
        digest = digests.get(model)
        if digest is None:
            entry["reason"] = "MODEL_MISSING_OR_UNPINNED"
            decisions.append(entry)
            continue
        entry["model_digest"] = digest
        if digest != EXPECTED_DIGESTS[model]:
            entry["reason"] = "MODEL_DIGEST_MISMATCH"
            decisions.append(entry)
            continue
        start = time.monotonic()
        try:
            advice = ask_local(model, instruction, call)
            entry.update(status="ADVISORY_ONLY", observation="LOCAL_MODEL_TEXT",
                         response_sha256=hashlib.sha256(advice.encode("utf-8")).hexdigest(),
                         advice=advice)
        except CouncilError as exc:
            entry.update(status="UNAVAILABLE", reason=str(exc))
        entry["elapsed_ms"] = round((time.monotonic() - start) * 1000)
        decisions.append(entry)
    return {
        "schema": "szl.local-council-readonly/v1",
        "inference_execution_host_verified": False,
        "endpoint_transport": "loopback_endpoint_may_be_forwarded",
        "source": "public_synthetic_fixed_prompt",
        "public_brief_sha256": hashlib.sha256(PUBLIC_BRIEF.encode("utf-8")).hexdigest(),
        "actual_source_audited": False,
        "huggingface_runtime_verified": False,
        "model_training_verified": False,
        "deployment_authority": "NONE",
        "network_allowed": ["127.0.0.1:11434"],
        "external_agents": dict(EXTERNAL_ROLES),
        "seats": decisions,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--smoke", action="store_true", required=True,
                        help="Use only the bundled public synthetic prompt")
    parser.parse_args()
    try:
        report = run_council()
    except CouncilError as exc:
        print(json.dumps({"schema": "szl.local-council-readonly/v1",
                          "status": "UNAVAILABLE", "reason": str(exc)},
                         sort_keys=True))
        return 2
    print(json.dumps(report, sort_keys=True, ensure_ascii=True))
    return 0 if all(item["status"] == "ADVISORY_ONLY" for item in report["seats"]) else 2


if __name__ == "__main__":
    raise SystemExit(main())
