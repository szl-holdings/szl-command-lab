#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 SZL Holdings
"""Source-owned counter observations; missing or discontinuous intervals stay null.

RAPL package and NVML device counters are shared hardware observations. An interval
around a callable is not an attribution of those joules exclusively to that callable.
No wrap correction, power estimate, model-quality or performance claim is inferred.
"""
from __future__ import annotations

from dataclasses import dataclass
import math
from pathlib import Path
import subprocess
import time
from typing import Any, Callable, TypeVar

POWERCAP = Path("/sys/class/powercap")
RAPL = Path("/sys/class/powercap/intel-rapl:0/energy_uj")
UNITS_PER_JOULE = {"intel-rapl": 1_000_000, "nvml": 1000}
T = TypeVar("T")


@dataclass(frozen=True)
class _Counter:
    source: str
    identity: str
    value: int | float


def _valid_value(value: object) -> bool:
    # Both APIs expose unsigned cumulative counters. Exclude bool, NaN, infinity,
    # negative values and overflow instead of turning them into measured zeroes.
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and 0 <= value < 2**64
        and math.isfinite(value)
    )


def _valid_counter(value: object) -> bool:
    return (
        isinstance(value, _Counter)
        and isinstance(value.source, str)
        and value.source in UNITS_PER_JOULE
        and isinstance(value.identity, str)
        and 0 < len(value.identity) <= 4096
        and _valid_value(value.value)
    )


def _delta(start: _Counter | None, end: _Counter | None) -> float | None:
    if not _valid_counter(start) or not _valid_counter(end):
        return None
    if start.source != end.source or start.identity != end.identity:
        return None
    if end.value < start.value:
        return None  # Reset/wrap is not a measured zero or a guessed wrap correction.
    return (end.value - start.value) / UNITS_PER_JOULE[start.source]


def _read_rapl(identity: str | None = None) -> _Counter | None:
    # A second read must address the same resolved file, never another package.
    candidates = [Path(identity)] if identity is not None else [RAPL]
    if identity is None:
        try:
            if POWERCAP.is_dir():
                candidates.extend(sorted(POWERCAP.glob("intel-rapl:*/energy_uj")))
                candidates.extend(sorted(POWERCAP.glob("intel-rapl:*:*/energy_uj")))
        except OSError:
            pass
    seen: set[Path] = set()
    for candidate in candidates:
        try:
            resolved = candidate.resolve(strict=True)
            if resolved in seen or not resolved.is_file():
                continue
            seen.add(resolved)
            # A supplied identity was already resolved by the first read.
            if identity is not None and str(resolved) != identity:
                return None
            with resolved.open("r", encoding="ascii") as stream:
                raw = stream.read(64)
            if len(raw) >= 64:
                continue
            value = int(raw.strip())
            if _valid_value(value):
                return _Counter("intel-rapl", str(resolved), value)
        except (OSError, UnicodeError, ValueError, RuntimeError):
            continue
    return None


def _read_nvml(identity: str | None = None) -> _Counter | None:
    try:
        import pynvml  # type: ignore
    except ImportError:
        return None
    initialized = False
    try:
        pynvml.nvmlInit()
        initialized = True
        handle = (
            pynvml.nvmlDeviceGetHandleByUUID(identity)
            if identity is not None else pynvml.nvmlDeviceGetHandleByIndex(0)
        )
        observed = pynvml.nvmlDeviceGetUUID(handle)
        if isinstance(observed, bytes):
            observed = observed.decode("ascii")
        if not isinstance(observed, str) or not observed or len(observed) > 256:
            return None
        if identity is not None and observed != identity:
            return None
        value = pynvml.nvmlDeviceGetTotalEnergyConsumption(handle)
        if _valid_value(value):
            return _Counter("nvml", observed, value)
    except Exception:
        # Driver errors are unavailable observations, not public exception text.
        return None
    finally:
        if initialized:
            try:
                pynvml.nvmlShutdown()
            except Exception:
                pass
    return None


def _payload(note: str) -> dict[str, Any]:
    return {
        "channel": "LIVE",  # Transport vocabulary, not evidence of a valid sample.
        "honesty": "UNAVAILABLE",
        "source": None,
        "package_energy_j": None,
        "sample_delta_j": None,
        "inference_energy_j": None,
        "energy_j": None,
        "measurement_scope": "UNAVAILABLE",
        "attribution": "NOT_ISOLATED_TO_CALLABLE",
        "hardware": {"scope": "COUNTER_OBSERVATION_ONLY", "cuda_inventory": "NOT_PROBED"},
        "note": note,
    }


def probe(*, sample_s: float = 0.05) -> dict[str, Any]:
    """Read a bounded RAPL interval or an NVML cumulative snapshot, never inference."""
    if not _valid_value(sample_s) or sample_s > 1:
        raise ValueError("sample_s must be a finite number between zero and one")
    start = _read_rapl()
    if start is not None:
        if not _valid_counter(start) or start.source != "intel-rapl":
            return _payload("RAPL counter observation is invalid.")
        time.sleep(sample_s)
        end = _read_rapl(start.identity)
        delta = _delta(start, end)
        if delta is None:
            return _payload("RAPL interval unavailable: missing, invalid, changed or decreasing counter.")
        out = _payload("RAPL package-counter interval; not isolated inference energy.")
        out.update(honesty="MEASURED", source="intel-rapl",
                   package_energy_j=end.value / 1_000_000, sample_delta_j=delta,
                   measurement_scope="PACKAGE_COUNTER_INTERVAL")
        return out
    snapshot = _read_nvml()
    if _valid_counter(snapshot) and snapshot.source == "nvml":
        out = _payload("NVML device cumulative counter only; no interval or inference attribution.")
        out.update(honesty="MEASURED", source="nvml", package_energy_j=snapshot.value / 1000,
                   measurement_scope="DEVICE_COUNTER_SNAPSHOT")
        return out
    return _payload("No valid RAPL or NVML observation; no joules are inferred.")


def measure_run(fn: Callable[[], T]) -> tuple[T, dict[str, Any]]:
    """Execute once. Publish only a same-counter interval bracketing this call.

    Legacy energy_j/inference_energy_j fields retain the interval value, not an
    exclusive workload measurement. Invalid intervals cannot be repaired by a
    fresh post-run probe. A valid independently bracketed NVML pair may be used
    when the RAPL pair is unavailable. Exceptions from the callable propagate.
    """
    rapl_start, nvml_start = _read_rapl(), _read_nvml()
    t0 = time.perf_counter()
    result = fn()
    duration = time.perf_counter() - t0
    rapl_end = _read_rapl(rapl_start.identity) if _valid_counter(rapl_start) else None
    nvml_end = _read_nvml(nvml_start.identity) if _valid_counter(nvml_start) else None
    out = _payload("No valid same-counter interval brackets this call; energy remains unavailable.")
    out["duration_s"] = duration
    for source, start, end in (("intel-rapl", rapl_start, rapl_end), ("nvml", nvml_start, nvml_end)):
        delta = _delta(start, end)
        if delta is not None and start.source == source:
            out.update(
                honesty="MEASURED", source=source,
                package_energy_j=end.value / UNITS_PER_JOULE[source],
                energy_j=delta, inference_energy_j=delta,
                measurement_scope="PACKAGE_COUNTER_INTERVAL" if source == "intel-rapl" else "DEVICE_COUNTER_INTERVAL",
                note="Shared hardware-counter interval around the call, not isolated inference energy.",
            )
            break
    return result, out


def _cuda_inventory() -> dict[str, Any]:
    """Explicit inventory only; normal energy probes never import torch or run a CLI."""
    out: dict[str, Any] = {"torch_import": False, "torch_version": None,
                           "cuda_available": False, "cuda_device": None, "nvidia_smi": None}
    try:
        import torch  # type: ignore
        out.update(torch_import=True, torch_version=str(torch.__version__),
                   cuda_available=bool(torch.cuda.is_available()))
        if out["cuda_available"]:
            out["cuda_device"] = str(torch.cuda.get_device_name(0))
    except Exception:
        pass
    try:
        proc = subprocess.run(["nvidia-smi", "-L"], capture_output=True, text=True, timeout=3)
        if proc.returncode == 0 and proc.stdout.strip():
            out["nvidia_smi"] = proc.stdout.strip().splitlines()[0][:200]
    except Exception:
        pass
    return out


def hardware() -> dict[str, Any]:
    """Explicit caller-requested inventory; availability is not trainability or energy."""
    rapl, nvml = _read_rapl(), _read_nvml()
    try:
        import pynvml  # noqa: F401
        pynvml_import = True
    except ImportError:
        pynvml_import = False
    return {
        "powercap_dir": POWERCAP.is_dir(),
        "rapl_readable": _valid_counter(rapl), "rapl_uj": rapl.value if _valid_counter(rapl) else None,
        "pynvml_import": pynvml_import,
        "nvml_readable": _valid_counter(nvml), "nvml_mj": nvml.value if _valid_counter(nvml) else None,
        **_cuda_inventory(),
    }
