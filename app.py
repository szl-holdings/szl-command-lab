#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 SZL Holdings
# Signed-off-by: Lutar, Stephen P. <stephenlutar2@gmail.com>
"""Operational Command-lab Space. Stdlib HTTP on 7860. No Node. No npm."""
from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "python"))
sys.path.insert(0, str(ROOT))

from energy import measure_run, probe  # noqa: E402
from kernel import evaluate_anatomy, selftest  # noqa: E402


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
main{max-width:920px;margin:0 auto;padding:28px 18px 64px}
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
</style>
</head>
<body>
<main>
  <div class="eyebrow">SZL Holdings · Command lab · GitHub canonical</div>
  <h1>Holographic command body. Fail closed.</h1>
  <p class="lede">Five organs. SHA-256 receipts. Energy channel is LIVE. Joules are MEASURED only from RAPL or NVML. Never a fabricated joule. Λ uniqueness is Conjecture 1 OPEN. Not a-11-oy.com. Not an ATO. Not an elevation.</p>
  <div class="badges" id="badges"></div>
  <div class="stage" id="stage"></div>
  <div class="grid" id="metrics"></div>
  <div class="row">
    <label><input type="checkbox" id="zero_heart"> Zero Yuyay</label>
    <label><input type="checkbox" id="tamper_chain"> Tamper YAWAR</label>
    <label><input type="checkbox" id="fabricate_joule"> Fabricate joule</label>
    <button id="run">Run organ cycle</button>
  </div>
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
document.getElementById('run').onclick=cycle;
cycle();
</script>
</body>
</html>
"""


JSON_PATHS = {
    "/healthz",
    "/readyz",
    "/api/energy",
    "/api/organs/integrity",
    "/v1/organs/integrity",
}
HTML_PATHS = {"/", "/index.html"}


def _flag(qs: dict[str, list[str]], name: str) -> bool:
    v = (qs.get(name) or ["0"])[0]
    return v in {"1", "true", "on", "yes"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_HEAD(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        if path in HTML_PATHS:
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(HTML.encode("utf-8"))))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        if path in JSON_PATHS:
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", "0")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        self.send_response(404)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query)
        if path in {"/healthz", "/readyz"}:
            self._send(200, {"ok": True, "energy": probe(), "proven_trust": False, "channel": "LIVE"})
            return
        if path == "/api/energy":
            self._send(200, probe())
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
                energy = {
                    "channel": "LIVE",
                    "honesty": "UNAVAILABLE",
                    "energy_j": None,
                    "inference_energy_j": None,
                    "note": "fabricated joule refused",
                }
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

    def _send(self, status: int, obj: object) -> None:
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
    host, port = "0.0.0.0", int(__import__("os").environ.get("PORT", "7860"))
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"[szl-command-lab] {host}:{port} · energy channel LIVE · never a fabricated joule", file=sys.stderr)
    httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
