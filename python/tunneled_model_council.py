"""Bounded, anonymous, synthetic-only observations of two preexisting SSH tunnels.

No provider credentials, GPU allocation, model training, data exchange, or
deployment authority. This does not prove that the service is on a GPU,
that its model weights are immutable, or that its source is production-ready.
The two local ports MUST already exist; this code does not create tunnels.
"""
from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import math
import time
from datetime import datetime, timezone
from typing import Callable, Any

HOST = "127.0.0.1"
MAX_RESPONSE_BYTES = 64_000
MAX_REQUEST_BYTES = 4_096
REQUEST_TIMEOUT_SECONDS = 40
ALLOWED = frozenset({
    ("GET", "/health"),
    ("GET", "/v1/models"),
    ("POST", "/v1/chat/completions"),
})
# Immutable *observed model identifier* hashes, NOT model-weight or image digests.
# The second service's identifier is an absolute server-side path and is never
# printed or included in receipts.
SEATS = (
    ("vm2_glm_advisory", 28088,
     "0d8724178b098d01df9c71a161bf380133fde5832d56d203a0f9ad03389970cc",
     "SZL_GPU_CANARY_OK"),
    ("vm1_bonsai_advisory", 28089,
     "50f89266e952c2bfef498d239473ccf1655a469e0bdcaddff0551ff6c11e28d4",
     "SZL_BONSAI_CANARY_OK"),
)
PORTS = frozenset(row[1] for row in SEATS)


class ObservationHold(ValueError):
    """No ambiguous or failed observation can become advisory success."""


def _unique_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for k, value in pairs:
        if k in result:
            raise ObservationHold("DUPLICATE_JSON_KEY")
        result[k] = value
    return result


def _reject_nonfinite(_: str) -> None:
    raise ObservationHold("NONFINITE_JSON_NUMBER")


def _require_finite(value: Any) -> None:
    # json.loads accepts overflowed JSON exponents such as 1e999 as Infinity.
    if isinstance(value, float) and not math.isfinite(value):
        raise ObservationHold("NONFINITE_JSON_NUMBER")
    if isinstance(value, list):
        for item in value:
            _require_finite(item)
    elif isinstance(value, dict):
        for item in value.values():
            _require_finite(item)


def parse_reply(raw: bytes) -> dict[str, Any]:
    try:
        data = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_pairs,
                          parse_constant=_reject_nonfinite)
        _require_finite(data)
    except ObservationHold:
        raise
    except (ValueError, UnicodeError, RecursionError):
        raise ObservationHold("INVALID_JSON_RESPONSE") from None
    if not isinstance(data, dict):
        raise ObservationHold("NONOBJECT_RESPONSE")
    return data


def api_call(port: int, method: str, path: str,
             payload: dict[str, Any] | None = None) -> dict[str, Any]:
    if type(port) is not int or port not in PORTS or (method, path) not in ALLOWED:
        raise ObservationHold("ENDPOINT_NOT_ALLOWLISTED")
    if (method == "POST") != (payload is not None):
        raise ObservationHold("METHOD_PAYLOAD_MISMATCH")
    body = None
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=True, allow_nan=False,
                          separators=(",", ":"), sort_keys=True).encode("utf-8")
        if len(body) > MAX_REQUEST_BYTES:
            raise ObservationHold("REQUEST_TOO_LARGE")
    conn = http.client.HTTPConnection(HOST, port, timeout=REQUEST_TIMEOUT_SECONDS)
    try:
        conn.request(method, path, body=body,
                     headers={"Content-Type": "application/json",
                              "Accept": "application/json"})
        response = conn.getresponse()
        if response.status != 200:
            raise ObservationHold("HTTP_NOT_200")
        if "json" not in response.getheader("Content-Type", "").lower():
            raise ObservationHold("UNEXPECTED_CONTENT_TYPE")
        raw = response.read(MAX_RESPONSE_BYTES + 1)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise ObservationHold("RESPONSE_TOO_LARGE")
        return parse_reply(raw)
    except ObservationHold:
        raise
    except (OSError, TimeoutError, http.client.HTTPException):
        raise ObservationHold("ENDPOINT_UNAVAILABLE") from None
    finally:
        conn.close()


def check_one(seat: tuple[str, int, str, str],
              call: Callable[..., dict[str, Any]] = api_call) -> dict[str, Any]:
    name, port, required_id_hash, exact_ack = seat
    result: dict[str, Any] = {
        "seat": name, "port": port, "status": "UNAVAILABLE",
        "authority": "NONE", "provider_writes": False,
        "gpu_hardware_verified": False, "weight_bytes_verified": False,
        "source_runtime_parity_verified": False,
        "model_id_sha256_pinned": required_id_hash,
    }
    start = time.monotonic()
    try:
        if not any(seat == allow for allow in SEATS):
            raise ObservationHold("SEAT_NOT_ALLOWLISTED")
        health = call(port, "GET", "/health")
        if health.get("status") not in ("ok", "healthy", "available"):
            raise ObservationHold("HEALTH_NOT_ASSERTED")
        collection = call(port, "GET", "/v1/models")
        models = collection.get("data")
        if not isinstance(models, list) or len(models) != 1:
            raise ObservationHold("MODEL_LIST_AMBIGUOUS")
        item = models[0]
        if not isinstance(item, dict) or type(item.get("id")) is not str:
            raise ObservationHold("MODEL_ID_UNAVAILABLE")
        ident = item["id"]
        if hashlib.sha256(ident.encode("utf-8")).hexdigest() != required_id_hash:
            raise ObservationHold("MODEL_IDENTITY_DRIFT")
        prompt = ("Public synthetic model check. Reply with exactly the text " +
                  exact_ack + ". Do not add any other words.")
        reply = call(port, "POST", "/v1/chat/completions", {
            "model": ident,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0, "max_tokens": 128, "stream": False,
        })
        choices = reply.get("choices")
        if not isinstance(choices, list) or len(choices) != 1:
            raise ObservationHold("COMPLETION_AMBIGUOUS")
        choice = choices[0]
        if not isinstance(choice, dict) or choice.get("finish_reason") != "stop":
            raise ObservationHold("COMPLETION_NOT_TERMINAL")
        message = choice.get("message")
        if (not isinstance(message, dict) or message.get("role") != "assistant"
                or message.get("tool_calls")):
            raise ObservationHold("COMPLETION_ROLE_OR_TOOL_INVALID")
        content = message.get("content")
        if type(content) is not str or content.strip() != exact_ack:
            raise ObservationHold("CANARY_MISMATCH")
        result.update(status="ADVISORY_ONLY",
                      public_reply_sha256=hashlib.sha256(
                          content.encode("utf-8")).hexdigest())
    except ObservationHold as exc:
        result["reason"] = str(exc)
    except (UnicodeError, TypeError, ValueError, RecursionError):
        result["reason"] = "INVALID_OBSERVATION"
    result["elapsed_ms"] = round((time.monotonic() - start) * 1000)
    return result


def observe(call: Callable[..., dict[str, Any]] = api_call) -> dict[str, Any]:
    return {
        "schema": "szl.tunneled-model-council/v1",
        "observed_utc": datetime.now(timezone.utc).isoformat(),
        "source": "existing_loopback_ssh_forwards_unverified_remote_gpu",
        "prompt": "fixed_public_synthetic_only",
        "model_bytes_verified": False,
        "gpu_hardware_verified": False,
        "training_verified": False,
        "deployment_authority": "NONE",
        "provider_writes": False,
        "seats": [check_one(seat, call) for seat in SEATS],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--smoke", action="store_true", required=True)
    parser.parse_args()
    result = observe()
    print(json.dumps(result, sort_keys=True, ensure_ascii=True))
    return 0 if all(x["status"] == "ADVISORY_ONLY" for x in result["seats"]) else 2


if __name__ == "__main__":
    raise SystemExit(main())
