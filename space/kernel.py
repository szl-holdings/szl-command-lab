#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 SZL Holdings
# Signed-off-by: Lutar, Stephen P. <stephenlutar2@gmail.com>
"""Command-lab fail-closed integrity kernel.

Stdlib only. Real SHA-256. Advisory Λ. Energy UNAVAILABLE.
Locked-proven stays exactly 8. Λ uniqueness is Conjecture 1 OPEN.
proven_trust is False. Not a-11-oy.com. Not an ATO.
"""
from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from typing import Any, Sequence

LOCKED_EIGHT = ("F1", "F4", "F7", "F11", "F12", "F18", "F19", "F22")
YUYAY_FLOORS = (0.95, 0.95) + (0.90,) * 11
ZERO = "0" * 64
CHAIN_OPS = ("anatomy.brain", "anatomy.heart", "anatomy.skeleton")
proven_trust = False


def _sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def wgm(xs: Sequence[float], ws: Sequence[float]) -> float:
    if len(xs) != len(ws) or not xs:
        return 0.0
    if any((not math.isfinite(x)) or x <= 0.0 for x in xs):
        return 0.0
    if any((not math.isfinite(w)) or w < 0.0 for w in ws):
        return 0.0
    if abs(sum(ws) - 1.0) >= 1e-9:
        return 0.0
    value = math.exp(sum(w * math.log(x) for x, w in zip(xs, ws)))
    return value if math.isfinite(value) else 0.0


def evaluate_lambda(axes: Sequence[float]) -> dict[str, Any]:
    n = len(axes)
    weights = tuple(1.0 / n for _ in range(n)) if n else ()
    value = wgm(axes, weights)
    blocked = value == 0.0
    return {
        "value": float(value),
        "blocked": bool(blocked),
        "reason": "zero-routed" if blocked else "advisory pass — Conjecture 1 OPEN",
    }


def yawar_chain(seed: int, tamper: bool) -> dict[str, Any]:
    hops = []
    prev = ZERO
    for seq, op in enumerate(CHAIN_OPS):
        material = f"{seq}|{op}|{prev}|{int(seed)}"
        digest = _sha256_hex(material)
        hops.append({"seq": seq, "op": op, "prev": prev, "digest": digest})
        prev = digest
    if tamper and len(hops) > 1:
        hops[1] = dict(hops[1])
        hops[1]["prev"] = "deadbeef" + hops[1]["prev"][8:]
    walk = ZERO
    ok = True
    brk = None
    for hop in hops:
        expect = _sha256_hex(f"{hop['seq']}|{hop['op']}|{hop['prev']}|{int(seed)}")
        if hop["prev"] != walk or expect != hop["digest"]:
            ok = False
            brk = int(hop["seq"])
            break
        walk = hop["digest"]
    return {"hops": hops, "ok": ok, "head": hops[-1]["digest"] if hops else ZERO, "break_at": brk, "alg": "SHA-256"}


def evaluate_anatomy(*, zero_heart: bool = False, tamper_chain: bool = False, fabricate_joule: bool = False, seed: int = 11) -> dict[str, Any]:
    if proven_trust is True:
        raise RuntimeError("refusing proven_trust true")
    axes = list(YUYAY_FLOORS)
    if zero_heart:
        axes[0] = 0.0
    heart = evaluate_lambda(axes)
    chain = yawar_chain(int(seed), bool(tamper_chain))
    organs = [
        {"name": "BRAIN", "status": "LIVE", "honesty": "LIVE"},
        {"name": "HEART", "status": "DOWN" if heart["blocked"] else "LIVE", "honesty": "ADVISORY"},
        {"name": "CIRCULATORY", "status": "DOWN" if not chain["ok"] else "LIVE", "honesty": "LIVE"},
        {"name": "NERVOUS", "status": "DOWN" if fabricate_joule else "LIVE", "honesty": "UNAVAILABLE"},
        {"name": "SKELETON", "status": "LIVE", "honesty": "ADVISORY"},
    ]
    live = sum(1 for o in organs if o["status"] == "LIVE")
    blocked = any(o["status"] == "DOWN" for o in organs)
    return {
        "organs": organs,
        "live_count": live,
        "blocked": blocked,
        "verdict": "BLOCKED" if blocked else "ADVISORY_BODY",
        "energy": "UNAVAILABLE",
        "energy_j": None,
        "conjecture_1": "OPEN",
        "locked_proven": 8,
        "locked_ids": list(LOCKED_EIGHT),
        "proven_trust": False,
        "chain_head": chain["head"],
        "reason": (
            f"organ integrity {live}/5 LIVE · Λ advisory · energy UNAVAILABLE · Conjecture 1 OPEN"
            if not blocked
            else "organ integrity FAIL · fail closed"
        ),
        "checked_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    }


def selftest() -> dict[str, Any]:
    healthy = evaluate_anatomy(seed=11)
    assert healthy["live_count"] == 5
    assert healthy["blocked"] is False
    assert healthy["energy"] == "UNAVAILABLE"
    assert healthy["proven_trust"] is False
    z = evaluate_anatomy(zero_heart=True)
    assert z["blocked"] is True
    t = evaluate_anatomy(tamper_chain=True)
    assert t["blocked"] is True
    j = evaluate_anatomy(fabricate_joule=True)
    assert j["blocked"] is True
    return {"ok": True, "cases": 4, "healthy_head": healthy["chain_head"]}


if __name__ == "__main__":
    print(json.dumps(selftest(), indent=2))
