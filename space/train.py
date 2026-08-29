#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 SZL Holdings
# Signed-off-by: Lutar, Stephen P. <stephenlutar2@gmail.com>
"""Train gate. Fail closed. GPU train is not a meter, and a meter is not a train.

T4 NVML can MEASURE board joules without a CUDA runtime in this hologram.
Unsloth QLoRA lives on owner metal (szl-forge via szl-gpu-bridge).
WILLAY / KHIPU-R3 / Waman stay NOT_APPROVED. Never a fabricated train.
"""
from __future__ import annotations

import json
from typing import Any

try:
    from energy import hardware
except ImportError:  # pragma: no cover - flatten fallback
    def hardware() -> dict[str, Any]:  # type: ignore
        return {
            "rapl_readable": False,
            "nvml_readable": False,
            "pynvml_import": False,
            "torch_import": False,
            "cuda_available": False,
            "cuda_device": None,
            "nvidia_smi": None,
        }


REFUSED = {
    "willay-v1": {
        "artifact_class": "trained_model_or_adapter",
        "priority": 1,
        "state": "REJECTED_WITH_REASON",
        "rights_status": "PENDING",
        "blockers": [
            "NOT_APPROVED",
            "RIGHTS_NOT_CLEARED",
            "BASE_REVISION_NOT_EXACT",
            "DATASET_REVISION_NOT_EXACT",
            "IMAGE_DIGEST_INVALID",
            "COST_CAP_NOT_SET",
            "JOB_COMMAND_NOT_BOUND",
        ],
    },
    "khipu-r3": {
        "artifact_class": "trained_adapter",
        "priority": 2,
        "state": "REJECTED_WITH_REASON",
        "rights_status": "PENDING",
        "blockers": [
            "NOT_APPROVED",
            "RIGHTS_NOT_CLEARED",
            "BASE_REVISION_NOT_EXACT",
            "DATASET_REVISION_NOT_EXACT",
            "IMAGE_DIGEST_INVALID",
            "COST_CAP_NOT_SET",
            "JOB_COMMAND_NOT_BOUND",
        ],
    },
    "waman-killinchu-eye": {
        "artifact_class": "trained_object_detection_model",
        "priority": 3,
        "state": "REJECTED_WITH_REASON",
        "rights_status": "REQUIRES_DATA_PRIVACY_EXPORT_DUAL_USE_REVIEW",
        "blockers": [
            "NOT_APPROVED",
            "RIGHTS_NOT_CLEARED",
            "BASE_REVISION_NOT_EXACT",
            "DATASET_REVISION_NOT_EXACT",
            "IMAGE_DIGEST_INVALID",
            "COST_CAP_NOT_SET",
            "JOB_COMMAND_NOT_BOUND",
        ],
    },
}

HOLOGRAM_GAPS = (
    "CUDA_RUNTIME_ABSENT",
    "TORCH_ABSENT",
    "UNSLOTH_ABSENT",
    "HOLOGRAM_IS_PYTHON_SLIM",
)
REGISTRY_GAPS = (
    "NOT_APPROVED",
    "RIGHTS_NOT_CLEARED",
    "BASE_REVISION_NOT_EXACT",
    "DATASET_REVISION_NOT_EXACT",
    "IMAGE_DIGEST_INVALID",
    "COST_CAP_NOT_SET",
    "JOB_COMMAND_NOT_BOUND",
    "GPU_BRIDGE_NEVER_DISPATCH",
)


def _missing(hw: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    if not hw.get("cuda_available"):
        missing.append("CUDA_RUNTIME_ABSENT")
    if not hw.get("torch_import"):
        missing.append("TORCH_ABSENT")
    if not hw.get("nvidia_smi"):
        missing.append("NVIDIA_SMI_ABSENT")
    missing.extend(REGISTRY_GAPS)
    return missing


def gate(*, job: str | None = None) -> dict[str, Any]:
    """Always BLOCKED until CUDA exists AND a registry job is approved.

    NVML readable ≠ CUDA trainable. Do not elevate. Do not train willay.
    """
    hw = hardware()
    missing = _missing(hw)
    wanted = (job or "").strip().lower() or None
    refused = None
    if wanted:
        for key, row in REFUSED.items():
            if wanted in {key, key.replace("-", ""), key.split("-")[0]}:
                refused = {"id": key, **row}
                break
        if refused is None:
            refused = {
                "id": wanted,
                "state": "REJECTED_WITH_REASON",
                "blockers": ["UNKNOWN_JOB", "NOT_APPROVED"],
            }
    cuda = bool(hw.get("cuda_available"))
    return {
        "ok": False,
        "decision": "BLOCKED",
        "honesty": "UNAVAILABLE",
        "channel": "LIVE",
        "submit_this_run": False,
        "approved": False,
        "proven_trust": False,
        "conjecture_1": "OPEN",
        "job": refused,
        "missing": missing,
        "hologram_gaps": [g for g in HOLOGRAM_GAPS if g in missing or g == "HOLOGRAM_IS_PYTHON_SLIM" or g == "UNSLOTH_ABSENT"],
        "registry_gaps": list(REGISTRY_GAPS),
        "gpu": {
            "nvml_readable": bool(hw.get("nvml_readable")),
            "pynvml_import": bool(hw.get("pynvml_import")),
            "torch_import": bool(hw.get("torch_import")),
            "torch_version": hw.get("torch_version"),
            "cuda_available": cuda,
            "cuda_device": hw.get("cuda_device"),
            "nvidia_smi": hw.get("nvidia_smi"),
        },
        "owner_metal": {
            "kit": "szl-holdings/szl-forge",
            "bridge": "szl-holdings/szl-gpu-bridge",
            "note": "Unsloth QLoRA is owner-metal. gpu-bridge attempts 1–9 are NEVER_DISPATCH evidence. Not this T4 hologram.",
        },
        "existing_adapters": [
            "SZLHOLDINGS/chaski",
            "SZLHOLDINGS/chaski-5050",
            "SZLHOLDINGS/KHIPU-R2",
            "SZLHOLDINGS/SZL-Khipu-1.5B",
            "SZLHOLDINGS/SZL-Forge-1.5B-ReceiptAgent",
            "SZLHOLDINGS/szl-receiptagent-qwen35-0.8b-v2",
        ],
        "note": (
            "T4 is mounted. NVML can MEASURE board joules. This hologram is "
            "python:3.12-slim — no CUDA runtime, no Unsloth, no approved job. "
            "Existing Hub adapters are prior trains, not a new GPU train. "
            "WILLAY / KHIPU-R3 / Waman stay REJECTED_WITH_REASON. Never a fabricated train."
        ),
    }


def toy(*, duration_s: float = 1.0) -> dict[str, Any]:
    """Tiny CUDA fit. Refused when CUDA is absent. Never a CPU stand-in billed as GPU train."""
    del duration_s  # reserved for a future CUDA wrap
    g = gate()
    g["kind"] = "toy_cuda_fit"
    g["trained"] = False
    g["weights"] = None
    g["reason"] = "CUDA_RUNTIME_ABSENT. Toy GPU fit refused. A CPU fit is not a GPU train."
    if g["gpu"]["cuda_available"]:
        # Reachable only after a CUDA hologram exists. Still refuse registry jobs.
        g["reason"] = (
            "CUDA is up. Registry still NOT_APPROVED. Toy fit is not willay, "
            "not khipu-r3, not Waman, not Unsloth. Compiler stays BLOCKED."
        )
    return g


if __name__ == "__main__":
    print(json.dumps({"gate": gate(), "toy": toy()}, indent=2))
