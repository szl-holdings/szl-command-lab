#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 SZL Holdings
# Signed-off-by: Lutar, Stephen P. <stephenlutar2@gmail.com>
"""Energy probe. MEASURED only from RAPL or NVML. Never a fabricated joule."""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

RAPL = Path("/sys/class/powercap/intel-rapl:0/energy_uj")


def _rapl_uj() -> int | None:
    try:
        if RAPL.is_file():
            return int(RAPL.read_text().strip())
    except (OSError, ValueError):
        return None
    return None


def _nvml_mj() -> float | None:
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


def probe(*, sample_s: float = 0.05) -> dict[str, Any]:
    """Return MEASURED package energy if hardware exists, else UNAVAILABLE.

    A RAPL counter is package energy, not tokens/joule. Inference joules are
    only MEASURED when a kernel run is wrapped in a RAPL/NVML delta.
    """
    a = _rapl_uj()
    if a is not None:
        time.sleep(max(0.0, sample_s))
        b = _rapl_uj()
        if b is None:
            b = a
        delta_j = max(0.0, (b - a) / 1_000_000.0)
        return {
            "honesty": "MEASURED",
            "source": "intel-rapl:0",
            "package_energy_j": b / 1_000_000.0,
            "sample_delta_j": delta_j,
            "inference_energy_j": None,
            "energy_j": None,
            "note": "RAPL package counter MEASURED. Inference joule still None until a kernel is wrapped.",
        }
    mj = _nvml_mj()
    if mj is not None:
        return {
            "honesty": "MEASURED",
            "source": "nvml",
            "package_energy_j": mj / 1000.0,
            "sample_delta_j": None,
            "inference_energy_j": None,
            "energy_j": None,
            "note": "NVML total energy MEASURED. Inference joule still None until a kernel is wrapped.",
        }
    return {
        "honesty": "UNAVAILABLE",
        "source": None,
        "package_energy_j": None,
        "sample_delta_j": None,
        "inference_energy_j": None,
        "energy_j": None,
        "note": "No RAPL, no NVML. Channel is live. Never a fabricated joule.",
    }


def measure_run(fn):
    """Wrap a kernel. If RAPL/NVML exists, inference_energy_j is MEASURED."""
    a = _rapl_uj()
    t0 = time.perf_counter()
    result = fn()
    dt = time.perf_counter() - t0
    b = _rapl_uj()
    energy = probe(sample_s=0.0)
    if a is not None and b is not None:
        energy["honesty"] = "MEASURED"
        energy["source"] = "intel-rapl:0"
        energy["inference_energy_j"] = max(0.0, (b - a) / 1_000_000.0)
        energy["energy_j"] = energy["inference_energy_j"]
        energy["note"] = f"RAPL delta around kernel · {dt:.4f}s"
    else:
        energy["duration_s"] = dt
    return result, energy
