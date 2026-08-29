#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Shim. Canonical Space runtime is ../app.py (organs + energy probe)."""
from __future__ import annotations

import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.py"
if not APP.is_file():
    raise SystemExit("app.py missing; Dockerfile must COPY app.py and python/")
runpy.run_path(str(APP), run_name="__main__")
