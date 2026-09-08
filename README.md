---
title: SZL Atlas — Governed AI Estate
emoji: 🧭
colorFrom: gray
colorTo: indigo
sdk: docker
app_port: 7860
pinned: true
license: apache-2.0
short_description: Explore SZL systems, models, kernels, and evidence.
tags:
  - governed-ai
  - ai-governance
  - provenance
  - inference
  - kernels
  - evidence
  - agentic-ai
  - szl-holdings
---

<p align="center">
  <a href="https://huggingface.co/spaces/SZLHOLDINGS/szl-command-lab">
    <img src="https://huggingface.co/spaces/SZLHOLDINGS/README/resolve/main/assets/estate-command-system.svg"
         alt="SZL governed AI command fabric"
         width="100%" />
  </a>
</p>

<div align="center">

# SZL Atlas

### Governed intelligence. Portable evidence.

The public explorer and source-bound Launchpad for SZL systems, models, kernels,
datasets, and their verification boundaries.

[**Open the live Atlas**](https://huggingface.co/spaces/SZLHOLDINGS/szl-command-lab) ·
[**Enter A11oy**](https://a-11-oy.com) ·
[**Inspect evidence**](https://a11oy.net) ·
[**Audit the source**](https://github.com/szl-holdings/szl-command-lab)

</div>

## What the Atlas does

The Atlas turns the public `SZLHOLDINGS` estate into one searchable command
surface. It recaptures the live, unauthenticated Hugging Face inventory and
presents:

- all publicly listed models, first-class kernels, datasets, and Spaces;
- curated paths into A11oy, Killinchu, Lyte, Sentra, Terra, PURIQ Finance,
  PRISM Counsel, Living Anatomy, the Khipu runtime, and YARQA;
- a source-controlled Launchpad whose registered links remain navigation
  metadata—not liveness, capability, authorization, or readiness claims;
- model and evidence spotlights driven by provider metadata rather than
  hard-coded performance claims;
- a bounded five-organ demonstration that fail-closes when an input, receipt
  chain, or evidence claim is compromised;
- source revision, runtime reachability, downloads, likes, update dates, tags,
  and direct links to each artifact card.

## Public routes

| Route | Purpose | Evidence boundary |
| --- | --- | --- |
| `GET /` | Responsive public Atlas | Presentation is navigation, not proof of readiness |
| `GET /launchpad` | Source-bound Atlas navigation registry | A registered destination is not a liveness or capability certificate |
| `GET /healthz` | Runtime and organ health | Reachability does not establish capability or authorization |
| `GET /api/catalog` | Live public Hub catalog | Private assets are excluded; unavailable provider data is not inferred |
| `GET /api/estate` | Bounded probes of selected public Spaces | HTTP 200 proves reachability only |
| `GET /api/launchpad` | Source-controlled registered route metadata | Registration is not availability, freshness, or production readiness |
| `GET /api/organs/integrity` | Five-organ governed-loop demonstration | Healthy output remains advisory and never self-authorizes |
| `GET /api/energy` | RAPL/NVML runtime probe | Joules are reported only when a readable counter exists |
| `GET /api/yarqa` | Bounded YARQA compartmentalization and receipt replay | Synthetic input verifies integrity/reproducibility, not CFD correctness |
| `GET /api/build-info` | Source-binding metadata | Missing runtime revision is labeled `REVISION_UNAVAILABLE` |

## Governing boundary

The model proposes. Independent policy decides. A human binds consequential
action. The Atlas does not convert a formula, model response, download count,
HTTP response, link registration, or signature into permission.

- Lambda uniqueness remains **Conjecture 1 — OPEN**.
- `proven_trust` remains `false` in the demonstration.
- A signature can establish scoped integrity and origin; it does not establish
  accuracy, safety, performance, compliance, or authorization.
- Public physical actuation in Killinchu remains **SIMULATED** unless an
  operator-owned system provides a separately governed effect path.
- No production authorization, regulatory approval, customer adoption,
  benchmark superiority, revenue, funding, or investment outcome is claimed.

## Architecture

```text
Hugging Face public APIs ─┐
selected runtime probes ─┼─> catalog + estate state ─> responsive Atlas
five-organ kernel ───────┤
RAPL / NVML probe ───────┤
source route registry ───┘                         └─> source-bound Launchpad

signal → proposal → policy → bounded action → receipt → verification
```

The Docker Space intentionally uses a compact standard-library Python server.
`gateway.py` composes the permanent `/launchpad` and `/api/launchpad` routes
onto the existing `server.Handler`; all other Atlas routes continue through the
original handler. `Dockerfile` publishes the exact `server.py`, `gateway.py`,
`space/index.html`, `space/launchpad.html`, and source-bound holographic CSS and
JavaScript closure and installs YARQA from the exact source revision reported by
`/api/build-info`.

Provider mutation is owned by the protected central reusable publisher in
`szl-holdings/.github`. The thin caller in `.github/workflows/hf-sync.yml` pins
that publisher to an immutable commit, deploys only the Dockerfile-derived file
set, requires the exact default-branch tip, binds `SZL_GIT_SHA`, and verifies
same-origin smoke routes before success. Only protected Command Lab `main` can
update the retained `SZLHOLDINGS/szl-command-lab` Space. This repository retains
the canonical source and delegation contract; the Hugging Face Space is the
generated runtime mirror.

## Run locally

```bash
python gateway.py
# open http://127.0.0.1:7860
# open http://127.0.0.1:7860/launchpad
```

Optional environment variables:

```bash
HOST=0.0.0.0
PORT=7860
SZL_GIT_SHA=<exact-40-character-source-revision>
```

## Verification

```bash
python -m py_compile server.py gateway.py
python - <<'PY'
import gateway
import server

assert server.selftest()["ok"] is True
assert server.build_info()["surface"] == "SZL Atlas"
launchpad = gateway.launchpad_payload()
assert launchpad["schema"] == "szl.atlas.launchpad/v1"
assert launchpad["state"] == "REGISTERED_NAVIGATION"
assert launchpad["public_effectors"] == []
print("atlas + launchpad self-test: PASS")
PY
pytest -q tests
```

The canonical source is
[`szl-holdings/szl-command-lab`](https://github.com/szl-holdings/szl-command-lab).
The Hugging Face Space is a published runtime mirror and must be checked against
its exact source-binding evidence before a consequential deployment decision.

---

<div align="center">

**Understand · build · verify**

Apache-2.0 · Control before action · Evidence after

</div>
