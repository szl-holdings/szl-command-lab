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

<!-- szl:card-presentation:v1 -->
<p><a href="https://huggingface.co/spaces/SZLHOLDINGS/szl-command-lab"><img src="https://raw.githubusercontent.com/szl-holdings/.github/main/profile/assets/szl/logos/szl_mark_holographic.svg" alt="SZL Holdings" width="112" /></a></p>

# SZL Command Lab

Explore SZL systems, models, kernels and datasets in one searchable place. Follow each item to its source, current observations and stated use limits.

**Artifact:** Public portfolio application

**Stage:** Exploration and bounded demonstrations

[**Explore Command Lab →**](https://huggingface.co/spaces/SZLHOLDINGS/szl-command-lab) · [**Build with the source →**](https://github.com/szl-holdings/szl-command-lab) · [**Inspect exact source →**](https://github.com/szl-holdings/szl-command-lab/blob/07af64494e13ed2cb373abd44a9d9f5b117b9603/README.md)

## Use limits

- Catalog membership and reachable URLs do not establish model quality or operational readiness.
- The five-organ demonstration is synthetic; it grants no action authority.
- Unavailable or partial provider observations remain visible and must not be interpreted as a complete inventory.

<details>
<summary>Technical documentation, original evidence and reproduction</summary>

<!-- szl:preserved-source-body:start -->

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
| `GET /demos` | Python-rendered entry to fixed retrieval and receipt demonstrations | Read-only public fixtures; authority `NONE` |
| `GET /demos/retrieval/{id}` | Fixed BM25 lexical query | Named IDs only; no benchmark or model-quality claim |
| `GET /demos/receipts/{id}` | Fixed offline receipt verification | Integrity, signature, and scientific validity shown separately |
| `GET /api/demo-adapters` | Versioned adapter artifact registry | Exact pinned distribution, source revision, wheel hash, limits, authority `NONE` |

### Estate probe evidence

`/api/estate` retains the `szl.atlas.estate/v1` envelope, with explicitly
scoped surface observations:

- Remote HTTP 200: `honesty: MEASURED`, `evidence_scope: http_reachability`,
  and `reachable: true`. This measures only the HTTP observation, never the
  response's claimed health, capability, authorization, or energy. JSON error
  bodies, malformed JSON, arrays, and HTML receive the same limited treatment.
- Other HTTP statuses or transport failures: `honesty: UNAVAILABLE`,
  `reachable: false`, with the observed status (or `null` for no response).
- The local five-organ demonstration: `evidence_scope: synthetic_kernel`,
  `honesty: SIMULATED` only for an integer count of five and an explicit
  `blocked: false`; an explicit block stays `BLOCKED`, and incomplete evidence
  stays `UNAVAILABLE`. `http` and `reachable` are `null`: no HTTP probe ran.

`reachable_surfaces` counts only remote HTTP 200 observations;
`simulated_surfaces` counts successful local demonstrations. The legacy
`live_surfaces` field is retained as zero because no probe establishes live
capability. Consumers must use these scopes and must not translate legacy
`LIVE`/`REACHABLE` labels into stronger claims. The Atlas presents these counts
without a green readiness indicator. Existing cache bounds remain unchanged;
the GET does not mint a signed receipt.

## Bounded Python demonstrations

The Atlas has a prominent **Try a demo** entry. Its original `/#loop` anatomy URL remains available and expands reliably from a deep link. The new `/demos` views are rendered deterministically in Python with escaped data; the browser uses HTML/CSS and the existing presentation JavaScript. Fixed links work with the existing `form-action 'none'` CSP.

The retrieval example ranks five original, Apache-2.0 public corpus summaries with `szl-retrieval-bench==0.3.1` BM25. The receipt example calls `szl-guardrail-receipt==0.1.2` over committed intact, tampered, and unsigned synthetic records. Both wheels are SHA-256 pinned in `requirements-public-demos.txt`, and the registry records their exact source tag commits and artifact identities. The core dependency closure is empty for both packages. No signer, model, paid provider, upload, external effect, dynamic import, or visitor URL fetch is used by these adapters.

All receipt fixtures are unsigned. An intact hash and chain can be **PASS** while signature verification is **SKIP**; the package's `verify_records` boolean alone is never displayed as a signature pass. Scientific validity stays `NOT_EVALUATED` and authority stays `NONE`. The corpus and fixture provenance are recorded in `demo_data/README.md`.

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
original handler. `Dockerfile` publishes the exact `server.py`, `gateway.py`, Python demo adapters and renderer, fixed demo data, `space/index.html`, `space/launchpad.html`, and source-bound holographic CSS and JavaScript closure. It installs YARQA from its pinned source archive and installs the two demo wheels by exact hashes.

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

### Energy counter evidence

`atlas_energy.py` is the single energy implementation used by the Atlas server
and the `python/energy.py` and `space/energy.py` compatibility entrypoints. The
Dockerfile-derived canonical publication includes this module; the existing
single-writer workflow also watches its changes.

A missing second read, changed counter identity, decreasing counter, negative
value, overflow, NaN or infinity leaves energy `UNAVAILABLE` with null joules.
A valid unchanged counter is a measured zero; it is not confused with a missing
sample. RAPL intervals retain the same resolved counter file and NVML intervals
the same device UUID. Wrap/reset correction is not inferred. A post-run snapshot
cannot substitute for a complete interval around the callable.

The legacy `energy_j` and `inference_energy_j` names retain the observed shared
counter interval for compatibility. They are **not isolated inference energy**;
the payload and interface state that attribution limit. Ordinary probes do not
import torch or invoke a driver CLI; full hardware inventory remains a separate
explicit call. No model is loaded by this change.

`tests/test_energy_counter_validity.py` exercises synthetic counter faults,
identity changes, true zeroes, serialization, entrypoint ownership, publication
membership and the visible attribution boundary. These are software contracts,
not measured hardware energy, CUDA benchmarks or model-quality evidence.

### Responsive Atlas

The Atlas owns its navigation and layout. The shared holographic helper retains
viewport and accessibility adaptation, while its optional decorative rail and
ambient layer are disabled on this native surface. The hero uses the original
SZL orbital mark as inline vector geometry inside normal document flow. The mark,
caption and governance labels have intrinsic dimensions and never depend on
absolutely positioned text. Container queries use the Space's own available
width, including an embedded Hugging Face frame and CSS zoom.

The first paths are **Explore the work**, **Build with SZL**, and **Try a demo**. The bounded
demo is disclosed on demand, requires a user click to run, and labels successful
organ checks as demo results. Model-namespace counts include kernel repositories;
kernel listings are not additional trained models.

The `atlas-responsive-browser` PR job starts the shipped Python gateway and runs
`scripts/atlas-responsive.test.cjs` in Chromium with synthetic provider data.
It checks 320, 375, 744, 768, 1024, 1440 and 1920px widths, 200% and 400% CSS zoom,
and 320/744px frames inside a 1440px host, plus a 375px coarse-touch case.
It verifies that requested CSS zoom was applied, measures the hero box and every
visible content boundary with the demo open, then exercises navigation, Escape,
catalog search, and 44px touch targets.
Screenshots and JSON measurements are retained as a run artifact. This tests
rendering; it does not certify live provider data or production capability.

To run the same matrix locally, install the pinned Python demo requirements
shown below, the repository's Playwright dependency, and Chromium. Start
`HOST=127.0.0.1 PORT=7868 python gateway.py`, then run:

```bash
ATLAS_EVIDENCE_DIR=/tmp/atlas-browser-evidence node --test scripts/atlas-responsive.test.cjs
```

`ATLAS_TEST_ORIGIN` may point to another loopback port. The test rejects public
origins and intercepts provider API requests with explicit fixtures.

Install the test tool and hash-pinned public demo distributions before starting
the gateway or running the suite:

```bash
python -m pip install pytest
python -m pip install --require-hashes --only-binary=:all: -r requirements-public-demos.txt
python -m py_compile server.py gateway.py demo_adapters.py visitor_views.py
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
python -m pytest -q tests
node --test scripts/atlas-estate-ui.test.mjs scripts/atlas-estate-consumer.test.mjs
```

The dependency-free estate consumer tests use Node 24, matching the public
experience CI gate; they execute the shipped static renderer and typed parser
with synthetic fixtures, not a browser or a remote production deployment.

The canonical source is
[`szl-holdings/szl-command-lab`](https://github.com/szl-holdings/szl-command-lab).
The Hugging Face Space is a published runtime mirror and must be checked against
its exact source-binding evidence before a consequential deployment decision.

---

<div align="center">

**Understand · build · verify**

Apache-2.0 · Control before action · Evidence after

</div>

<!-- szl:preserved-source-body:end -->

</details>
