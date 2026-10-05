#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 SZL Holdings
"""Compatibility entrypoint for the single source-owned Atlas energy contract."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from atlas_energy import hardware, measure_run, probe  # noqa: E402,F401

__all__ = ["hardware", "measure_run", "probe"]

if __name__ == "__main__":
    print(json.dumps({"probe": probe(), "hardware": hardware()}, indent=2, allow_nan=False))
