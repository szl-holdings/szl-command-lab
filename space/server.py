#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 SZL Holdings
# Signed-off-by: Lutar, Stephen P. <stephenlutar2@gmail.com>
"""Flatten payload for Hub. Kernel + energy + estate recapture. Stdlib HTTP 7860."""
from __future__ import annotations

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "python"))

try:
    from energy import hardware, measure_run, probe
    from kernel import burn_kernel, clamp_duration, evaluate_anatomy, selftest
except ImportError:
    # Immune flatten historically copied only server.py. Keep a local fallback.
    import hashlib
    import math
    from datetime import datetime, timezone
    from typing import Any, Sequence

    LOCKED_EIGHT = ("F1", "F4", "F7", "F11", "F12", "F18", "F19", "F22")
    YUYAY_FLOORS = (0.95, 0.95) + (0.90,) * 11
    ZERO = "0" * 64
    CHAIN_OPS = ("anatomy.brain", "anatomy.heart", "anatomy.skeleton")
    POWERCAP = Path("/sys/class/powercap")
    RAPL = Path("/sys/class/powercap/intel-rapl:0/energy_uj")

    def _rapl_uj():
        candidates = [RAPL]
        try:
            if POWERCAP.is_dir():
                candidates.extend(sorted(POWERCAP.glob("intel-rapl:*/energy_uj")))
        except OSError:
            pass
        seen = set()
        for path in candidates:
            if path in seen:
                continue
            seen.add(path)
            try:
                if path.is_file():
                    return int(path.read_text().strip())
            except (OSError, ValueError):
                continue
        return None

    def _nvml_mj():
        try:
            import pynvml  # type: ignore
        except ImportError:
            return None
        try:
            pynvml.nvmlInit()
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            mj = float(pynvml.nvmlDeviceGetTotalEnergyConsumption(handle))
            pynvml.nvmlShutdown()
            return mj
        except Exception:
            try:
                pynvml.nvmlShutdown()
            except Exception:
                pass
            return None

    def probe(*, sample_s: float = 0.05):
        a = _rapl_uj()
        if a is not None:
            time.sleep(max(0.0, sample_s))
            b = _rapl_uj() or a
            return {
                "channel": "LIVE",
                "honesty": "MEASURED",
                "source": "intel-rapl",
                "package_energy_j": b / 1_000_000.0,
                "sample_delta_j": max(0.0, (b - a) / 1_000_000.0),
                "inference_energy_j": None,
                "energy_j": None,
                "note": "RAPL package counter MEASURED.",
            }
        mj = _nvml_mj()
        if mj is not None:
            return {
                "channel": "LIVE",
                "honesty": "MEASURED",
                "source": "nvml",
                "package_energy_j": mj / 1000.0,
                "sample_delta_j": None,
                "inference_energy_j": None,
                "energy_j": None,
                "note": "NVML total energy MEASURED.",
            }
        return {
            "channel": "LIVE",
            "honesty": "UNAVAILABLE",
            "source": None,
            "package_energy_j": None,
            "sample_delta_j": None,
            "inference_energy_j": None,
            "energy_j": None,
            "note": "No RAPL, no NVML. Channel is live. Never a fabricated joule.",
        }

    def measure_run(fn):
        a = _rapl_uj()
        t0 = time.perf_counter()
        result = fn()
        dt = time.perf_counter() - t0
        b = _rapl_uj()
        energy = probe(sample_s=0.0)
        energy["duration_s"] = dt
        if a is not None and b is not None:
            energy["honesty"] = "MEASURED"
            energy["inference_energy_j"] = max(0.0, (b - a) / 1_000_000.0)
            energy["energy_j"] = energy["inference_energy_j"]
            energy["note"] = f"RAPL delta around kernel · {dt:.4f}s"
        return result, energy

    def clamp_duration(duration_s):
        try:
            v = float(duration_s)
        except (TypeError, ValueError):
            v = 1.0
        if v != v:
            v = 1.0
        return min(max(v, 0.05), 3.0)

    def burn_kernel(*, duration_s=1.0, seed=11):
        target = clamp_duration(duration_s)
        digest = _sha256_hex(f"burn|{int(seed)}")
        rounds = 0
        t0 = time.perf_counter()
        while time.perf_counter() - t0 < target:
            digest = __import__("hashlib").sha256(f"{digest}|{rounds}|{seed}".encode()).hexdigest()
            rounds += 1
        return {
            "ok": True,
            "kind": "sha256_storm",
            "rounds": rounds,
            "duration_s": time.perf_counter() - t0,
            "digest": digest,
            "proven_trust": False,
            "note": "SHA-256 storm so NVML/RAPL can tick. Never a fabricated joule.",
        }


    def _sha256_hex(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def wgm(xs, ws):
        if len(xs) != len(ws) or not xs:
            return 0.0
        if any((not math.isfinite(x)) or x <= 0.0 for x in xs):
            return 0.0
        if abs(sum(ws) - 1.0) >= 1e-9:
            return 0.0
        value = math.exp(sum(w * math.log(x) for x, w in zip(xs, ws)))
        return value if math.isfinite(value) else 0.0

    def evaluate_lambda(axes):
        n = len(axes)
        weights = tuple(1.0 / n for _ in range(n)) if n else ()
        value = wgm(axes, weights)
        return {"value": float(value), "blocked": value == 0.0}

    def yawar_chain(seed: int, tamper: bool):
        hops = []
        prev = ZERO
        for seq, op in enumerate(CHAIN_OPS):
            digest = _sha256_hex(f"{seq}|{op}|{prev}|{int(seed)}")
            hops.append({"seq": seq, "op": op, "prev": prev, "digest": digest})
            prev = digest
        if tamper and len(hops) > 1:
            hops[1] = dict(hops[1])
            hops[1]["prev"] = "deadbeef" + hops[1]["prev"][8:]
        walk = ZERO
        ok = True
        for hop in hops:
            expect = _sha256_hex(f"{hop['seq']}|{hop['op']}|{hop['prev']}|{int(seed)}")
            if hop["prev"] != walk or expect != hop["digest"]:
                ok = False
                break
            walk = hop["digest"]
        return {"ok": ok, "head": hops[-1]["digest"] if hops else ZERO}

    def evaluate_anatomy(*, zero_heart=False, tamper_chain=False, fabricate_joule=False, seed=11):
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

    def selftest():
        healthy = evaluate_anatomy(seed=11)
        assert healthy["live_count"] == 5 and healthy["blocked"] is False
        assert evaluate_anatomy(zero_heart=True)["blocked"] is True
        assert evaluate_anatomy(tamper_chain=True)["blocked"] is True
        assert evaluate_anatomy(fabricate_joule=True)["blocked"] is True
        return {"ok": True, "cases": 4, "healthy_head": healthy["chain_head"]}


SURFACES = [
    ("command-lab", "Operator kernel", "https://huggingface.co/spaces/SZLHOLDINGS/szl-command-lab", None),
    ("a11oy", "Product command", "https://huggingface.co/spaces/SZLHOLDINGS/a11oy", "https://szlholdings-a11oy.hf.space/healthz"),
    ("killinchu", "Bounded vertical", "https://huggingface.co/spaces/SZLHOLDINGS/killinchu", "https://szlholdings-killinchu.hf.space/healthz"),
    ("khipu", "Python kernels", "https://huggingface.co/spaces/SZLHOLDINGS/szl-khipu", "https://szlholdings-szl-khipu.hf.space/healthz"),
    ("khipu-lab", "Khipu lab hologram", "https://huggingface.co/spaces/SZLHOLDINGS/khipu-lab", "https://szlholdings-khipu-lab.hf.space/healthz"),
    ("anatomy", "Living body", "https://huggingface.co/spaces/SZLHOLDINGS/anatomy", "https://szlholdings-anatomy.hf.space/healthz"),
    ("immune", "Defense matrix", "https://huggingface.co/spaces/SZLHOLDINGS/immune", "https://szlholdings-immune.hf.space/healthz"),
    ("immune-lattice", "Channel B kernel", "https://huggingface.co/spaces/SZLHOLDINGS/immune-lattice", "https://szlholdings-immune-lattice.hf.space/healthz"),
    ("factory", "Decision cell compiler", "https://huggingface.co/spaces/SZLHOLDINGS/a11oy-factory", "https://szlholdings-a11oy-factory.hf.space/healthz"),
    ("lyte-services", "Lyte window", "https://huggingface.co/spaces/SZLHOLDINGS/lyte-services", "https://szlholdings-lyte-services.hf.space/healthz"),
    ("evidence-studio", "Merge sink", "https://huggingface.co/spaces/SZLHOLDINGS/evidence-studio", "https://szlholdings-evidence-studio.hf.space/healthz"),
    ("sovereign-os", "Operator OS", "https://huggingface.co/spaces/SZLHOLDINGS/szl-sovereign-os", "https://szlholdings-szl-sovereign-os.hf.space/healthz"),
    ("real-estate", "Public records", "https://huggingface.co/spaces/SZLHOLDINGS/szl-real-estate", "https://szlholdings-szl-real-estate.hf.space/healthz"),
    ("nexus", "Analog core", "https://huggingface.co/spaces/SZLHOLDINGS/nexus", "https://szlholdings-nexus.hf.space/healthz"),
    ("cosmos", "Estate map", "https://huggingface.co/spaces/SZLHOLDINGS/cosmos", "https://szlholdings-cosmos.hf.space/"),
    ("counsel", "Counsel hologram", "https://huggingface.co/spaces/SZLHOLDINGS/counsel", "https://szlholdings-counsel.hf.space/"),
]

_estate_cache: dict | None = None
_estate_at = 0.0


def _hit(url: str, timeout: float = 4.0) -> tuple[int | None, str]:
    req = Request(url, headers={"User-Agent": "szl-command-lab-operator", "Accept": "application/json, text/html;q=0.8"})
    try:
        with urlopen(req, timeout=timeout) as res:
            return res.status, res.read(240).decode("utf-8", "replace")
    except Exception as exc:
        code = getattr(exc, "code", None)
        return code, ""


def recapture_estate() -> dict:
    global _estate_cache, _estate_at
    now = time.time()
    if _estate_cache and now - _estate_at < 20:
        return _estate_cache
    energy = probe()
    body = evaluate_anatomy(seed=11)
    surfaces = []

    def one(row):
        ident, role, href, url = row
        if url is None:
            return {
                "id": ident,
                "role": role,
                "href": href,
                "honesty": "LIVE" if body["live_count"] == 5 else "UNAVAILABLE",
                "detail": f"local kernel {body['live_count']}/5",
                "http": 200,
            }
        http, text = _hit(url)
        honesty = "UNAVAILABLE"
        detail = "no answer" if http is None else f"HTTP {http}"
        if http == 200:
            t = text.strip()
            if t.startswith("{") or t.startswith("["):
                honesty = "LIVE"
                detail = "json 200"
            elif "<html" in t.lower() or "<!doctype" in t.lower():
                honesty = "REACHABLE"
                detail = "html 200 · not a kernel healthz"
            else:
                honesty = "REACHABLE"
                detail = "http 200"
        return {"id": ident, "role": role, "href": href, "honesty": honesty, "detail": detail, "http": http}

    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = [pool.submit(one, row) for row in SURFACES]
        surfaces = [f.result() for f in futs]
    live_n = sum(1 for s in surfaces if s["honesty"] == "LIVE")
    reach_n = sum(1 for s in surfaces if s["honesty"] == "REACHABLE")
    payload = {
        "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "SZLHOLDINGS/szl-command-lab",
        "kernel": {
            "ok": body["live_count"] == 5 and not body["blocked"],
            "live_count": body["live_count"],
            "blocked": body["blocked"],
            "verdict": body["verdict"],
            "conjecture_1": "OPEN",
            "proven_trust": False,
            "reason": body["reason"],
            "organs": body["organs"],
            "energy": energy,
        },
        "surfaces": surfaces,
        "live_surfaces": live_n,
        "reachable_surfaces": reach_n,
    }
    _estate_cache, _estate_at = payload, now
    return payload


HTML = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SZL Command lab</title>
<style>
:root{--bg:#05070d;--void:#080c14;--panel:#0b121b;--line:#1b2734;--proof:#3af4c8;--gold:#e8c074;--cream:#eef3f6;--para:#9fb1bf;--dim:#6c7d8c;--false:#d76a6a}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--cream);font:15px/1.5 ui-sans-serif,system-ui,sans-serif;min-height:100%}
body{background:radial-gradient(120% 90% at 50% -10%,rgba(232,192,116,.09),transparent 60%),var(--bg)}
main{max-width:960px;margin:0 auto;padding:28px 18px 64px}
.eyebrow{font:10.5px ui-monospace,monospace;letter-spacing:1.4px;text-transform:uppercase;color:var(--gold)}
h1{font-size:clamp(22px,4vw,32px);margin:.2em 0 .4em}
.lede{color:var(--para);max-width:70ch}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 22px}
.badge{font:10.5px ui-monospace,monospace;padding:3px 9px;border:1px solid var(--line);border-radius:6px;color:var(--para);background:#10171f}
.badge b{color:var(--gold)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:18px 0}
.card{border:1px solid var(--line);border-radius:11px;background:var(--panel);padding:14px}
.card .k{font:10px ui-monospace,monospace;letter-spacing:.8px;text-transform:uppercase;color:var(--dim)}
.card .v{font:22px/1.2 ui-monospace,monospace;margin-top:4px}
.ok{color:var(--proof)} .hold{color:var(--gold)} .down{color:var(--false)}
button{min-height:44px;padding:0 16px;border-radius:8px;border:1px solid var(--proof);background:var(--proof);color:var(--bg);font:600 12px ui-monospace,monospace;letter-spacing:.8px;text-transform:uppercase;cursor:pointer}
.row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
label{font:12px ui-monospace,monospace;color:var(--para);display:flex;align-items:center;gap:6px}
pre{overflow:auto;background:var(--void);border:1px solid var(--line);border-radius:11px;padding:12px;font:11px/1.45 ui-monospace,monospace;color:var(--cream)}
a{color:var(--proof)}
.stage{height:280px;border:1px solid var(--line);border-radius:14px;position:relative;background:linear-gradient(180deg,rgba(58,244,200,.05),var(--void));margin:16px 0;overflow:hidden}
.node{position:absolute;transform:translate(-50%,-50%);border:1px solid var(--proof);border-radius:10px;padding:8px 10px;font:11px ui-monospace,monospace;background:rgba(11,18,27,.9)}
.node.down{border-color:var(--false);color:var(--false)}
.foot{margin-top:28px;border-top:1px solid var(--line);padding-top:14px;color:var(--dim);font:11px ui-monospace,monospace}
.surfaces{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:12px}
</style>
</head>
<body>
<main>
  <div class="eyebrow">SZL Holdings · Command lab · GitHub canonical · Hub operational</div>
  <h1>Holographic command body. Fail closed.</h1>
  <p class="lede">One kernel. Ten estate surfaces. Energy channel LIVE. Package joule MEASURED from RAPL/NVML. Inference joule MEASURED only when a kernel is wrapped. Never fabricated. Λ uniqueness is Conjecture 1 OPEN. Not a-11-oy.com. Not an ATO. Not an elevation.</p>
  <div class="badges" id="badges"></div>
  <div class="stage" id="stage"></div>
  <div class="grid" id="metrics"></div>
  <div class="row">
    <label><input type="checkbox" id="zero_heart"> Zero Yuyay</label>
    <label><input type="checkbox" id="tamper_chain"> Tamper YAWAR</label>
    <label><input type="checkbox" id="fabricate_joule"> Fabricate joule</label>
    <button id="run">Run organ cycle</button>
    <button id="wrap" type="button">Wrap kernel 1s</button>
  </div>
  <p class="eyebrow" style="margin-top:28px">Estate recapture</p>
  <div class="surfaces" id="surfaces"></div>
  <pre id="out">loading…</pre>
  <p class="foot">Source <a href="https://github.com/szl-holdings/szl-command-lab">szl-holdings/szl-command-lab</a> · product <a href="https://a-11-oy.com">a-11-oy.com</a> · proof <a href="https://a11oy.net">a11oy.net</a></p>
</main>
<script>
const slots={BRAIN:['18%','50%'],HEART:['38%','50%'],CIRCULATORY:['58%','50%'],NERVOUS:['58%','22%'],SKELETON:['82%','50%']};
async function cycle(){
  const q=new URLSearchParams({
    zero_heart: document.getElementById('zero_heart').checked? '1':'0',
    tamper_chain: document.getElementById('tamper_chain').checked? '1':'0',
    fabricate_joule: document.getElementById('fabricate_joule').checked? '1':'0',
  });
  const r=await fetch('/api/organs/integrity?'+q);
  const j=await r.json();
  const body=j.body||j;
  const energy=j.energy||{};
  document.getElementById('out').textContent=JSON.stringify({verdict:body.verdict, live:body.live_count, energy, reason:body.reason, head:body.chain_head},null,2);
  const eh=energy.honesty||'UNAVAILABLE';
  const ch=energy.channel||'LIVE';
  document.getElementById('badges').innerHTML=[
    ['organs', (body.live_count||0)+'/5'],
    ['energy channel', ch],
    ['joule', eh],
    ['Λ', body.conjecture_1||'OPEN'],
    ['proven_trust', String(body.proven_trust===true)],
  ].map(([k,v])=>`<span class="badge">${k} <b>${v}</b></span>`).join('');
  document.getElementById('metrics').innerHTML=(body.organs||[]).map(o=>`<div class="card"><div class="k">${o.name}</div><div class="v ${o.status==='DOWN'?'down':o.honesty==='UNAVAILABLE'?'hold':'ok'}">${o.status}</div></div>`).join('');
  document.getElementById('stage').innerHTML=(body.organs||[]).map(o=>{
    const [t,l]=slots[o.name]||['50%','50%'];
    return `<div class="node ${o.status==='DOWN'?'down':''}" style="top:${t};left:${l}">${o.name}<br>${o.status}</div>`;
  }).join('');
}
async function estate(){
  const r=await fetch('/api/estate');
  const j=await r.json();
  document.getElementById('surfaces').innerHTML=(j.surfaces||[]).map(s=>{
    const cls=s.honesty==='LIVE'?'ok':s.honesty==='REACHABLE'?'hold':'down';
    return `<div class="card"><div class="k">${s.role}</div><div class="v ${cls}">${s.honesty}</div><div class="k">${s.id}</div></div>`;
  }).join('');
}
async function wrap(){
  document.getElementById('out').textContent='wrapping kernel…';
  const r=await fetch('/api/energy/inference?duration_s=1');
  const j=await r.json();
  const energy=j.energy||{};
  document.getElementById('out').textContent=JSON.stringify({wrap:j.body, energy},null,2);
  const eh=energy.honesty||'UNAVAILABLE';
  const inf=energy.inference_energy_j;
  document.getElementById('badges').innerHTML=[
    ['organs','wrap'],
    ['joule', eh],
    ['inference J', inf==null?'none':String(inf)],
    ['source', energy.source||'none'],
    ['proven_trust','false'],
  ].map(([k,v])=>`<span class="badge">${k} <b>${v}</b></span>`).join('');
}
document.getElementById('run').onclick=cycle;
document.getElementById('wrap').onclick=wrap;
cycle();
estate();
</script>
</body>
</html>
"""

ENERGY_STATE = {"last_inference": None}

JSON_PATHS = {"/healthz", "/readyz", "/api/energy", "/api/energy/hardware", "/api/energy/inference", "/api/organs/integrity", "/v1/organs/integrity", "/api/estate"}
HTML_PATHS = {"/", "/index.html"}


def _flag(qs, name: str) -> bool:
    v = (qs.get(name) or ["0"])[0]
    return v in {"1", "true", "on", "yes"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_HEAD(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        self.send_response(200 if path in HTML_PATHS or path in JSON_PATHS else 404)
        self.send_header("Content-Type", "text/html; charset=utf-8" if path in HTML_PATHS else "application/json; charset=utf-8")
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query)
        if path in {"/healthz", "/readyz"}:
            self._send(200, {"ok": True, "energy": probe(), "proven_trust": False, "channel": "LIVE", "space": "szl-command-lab"})
            return
        if path == "/api/energy":
            payload = probe()
            if ENERGY_STATE["last_inference"] is not None:
                payload["last_inference"] = ENERGY_STATE["last_inference"]
                wrap = (ENERGY_STATE["last_inference"] or {}).get("energy") or {}
                if wrap.get("inference_energy_j") is not None:
                    payload["inference_energy_j"] = wrap.get("inference_energy_j")
                    payload["energy_j"] = wrap.get("inference_energy_j")
                payload["note"] = (
                    payload.get("note") or ""
                ) + " Last wrap stored. Board package counter is not the inference joule."
            self._send(200, payload)
            return
        if path == "/api/energy/inference":
            duration = clamp_duration((qs.get("duration_s") or ["1"])[0])
            body, energy = measure_run(lambda: burn_kernel(duration_s=duration, seed=11))
            ENERGY_STATE["last_inference"] = {
                "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "kind": body.get("kind"),
                "rounds": body.get("rounds"),
                "duration_s": energy.get("duration_s"),
                "energy": energy,
            }
            self._send(200, {"ok": True, "body": body, "energy": energy, "last_inference": ENERGY_STATE["last_inference"], "proven_trust": False})
            return
        if path == "/api/energy/hardware":
            try:
                hw = hardware()
            except NameError:
                hw = probe().get("hardware") or {}
            self._send(200, {"channel": "LIVE", "hardware": hw, "note": "Inventory only. Joule MEASURED only when RAPL or NVML is readable."})
            return
        if path == "/api/estate":
            self._send(200, recapture_estate())
            return
        if path in {"/api/organs/integrity", "/v1/organs/integrity"}:
            def run():
                return evaluate_anatomy(
                    zero_heart=_flag(qs, "zero_heart"),
                    tamper_chain=_flag(qs, "tamper_chain"),
                    fabricate_joule=_flag(qs, "fabricate_joule"),
                    seed=11,
                )
            body, energy = measure_run(run)
            if _flag(qs, "fabricate_joule"):
                energy = {"channel": "LIVE", "honesty": "UNAVAILABLE", "energy_j": None, "inference_energy_j": None, "note": "fabricated joule refused"}
                body["blocked"] = True
                body["verdict"] = "BLOCKED"
            body["energy"] = energy.get("honesty")
            body["energy_j"] = energy.get("energy_j")
            self._send(200, {"ok": True, "body": body, "energy": energy})
            return
        if path in HTML_PATHS:
            raw = HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(raw)
            return
        self._send(404, {"ok": False, "error": "not found"})

    def _send(self, status: int, obj) -> None:
        raw = json.dumps(obj, indent=2, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)


def main() -> int:
    selftest()
    host, port = "0.0.0.0", int(os.environ.get("PORT", "7860"))
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"[szl-command-lab] {host}:{port} · kernel + estate recapture · never a fabricated joule", file=sys.stderr)
    httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
