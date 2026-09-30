# SPDX-License-Identifier: Apache-2.0
"""Static Atlas entrypoint regressions without servers or operational routes."""
from __future__ import annotations

import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT))

import gateway
import server


INDEX = (
    b'<!doctype html><html lang="en" data-szl-surface="atlas-v1">'
    b'<head><meta charset="utf-8"></head><body>Atlas fixture</body></html>'
)


class StaticEntrypointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory(prefix="atlas-static-test-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.here = patch.object(server, "HERE", self.root)
        self.here.start()
        self.addCleanup(self.here.stop)

    def write_source_index(self, raw: bytes = INDEX) -> None:
        (self.root / "space").mkdir(exist_ok=True)
        (self.root / "space" / "index.html").write_bytes(raw)

    def capture(self, handler_type, method: str, path: str):
        handler = object.__new__(handler_type)
        handler.path = path
        handler.wfile = io.BytesIO()
        statuses = []
        headers = {}
        handler.send_response = statuses.append
        handler.send_header = lambda key, value: headers.__setitem__(key, value)
        handler.end_headers = lambda: None
        forbidden = AssertionError("Static HTML must not execute an API or probe")
        with (
            patch.object(server, "evaluate_anatomy", side_effect=forbidden),
            patch.object(server, "run_yarqa_demo", side_effect=forbidden),
            patch.object(server, "probe", side_effect=forbidden),
            patch.object(server, "recapture_catalog", side_effect=forbidden),
            patch.object(server, "recapture_estate", side_effect=forbidden),
        ):
            getattr(handler, method)()
        self.assertEqual(len(statuses), 1)
        return statuses[0], headers, handler.wfile.getvalue()

    def test_source_layout_is_served_when_runtime_root_is_missing(self) -> None:
        self.write_source_index()
        self.assertEqual(server._load_index(), (200, INDEX))

    def test_docker_runtime_root_remains_first_choice(self) -> None:
        runtime = INDEX.replace(b"Atlas fixture", b"Runtime fixture")
        (self.root / "index.html").write_bytes(runtime)
        self.write_source_index()
        self.assertEqual(server._load_index(), (200, runtime))

    def test_missing_entrypoint_is_unavailable(self) -> None:
        status, raw = server._load_index()
        self.assertEqual(status, 503)
        self.assertIn(b"temporarily unavailable", raw)

    def test_invalid_entrypoints_are_unavailable(self) -> None:
        for raw in (b"", b"not an Atlas page", b"\xff" + INDEX):
            with self.subTest(raw=raw):
                (self.root / "index.html").write_bytes(raw)
                self.write_source_index(raw)
                self.assertEqual(server._load_index()[0], 503)

    def test_invalid_runtime_can_use_valid_source_layout(self) -> None:
        (self.root / "index.html").write_bytes(b"")
        self.write_source_index()
        self.assertEqual(server._load_index(), (200, INDEX))

    def test_non_regular_entrypoint_is_unavailable(self) -> None:
        (self.root / "index.html").mkdir()
        self.assertEqual(server._load_index()[0], 503)

    def test_oversize_entrypoints_are_unavailable(self) -> None:
        with patch.object(server, "MAX_INDEX_BYTES", len(INDEX) - 1):
            (self.root / "index.html").write_bytes(INDEX)
            self.write_source_index()
            self.assertEqual(server._load_index()[0], 503)

    def test_read_is_bounded_even_if_file_grows_after_metadata_check(self) -> None:
        (self.root / "index.html").write_bytes(INDEX)
        stream = io.BytesIO(INDEX + b" " * 64)
        with (
            patch.object(server, "MAX_INDEX_BYTES", len(INDEX)),
            patch.object(stream, "read", wraps=stream.read) as read,
            patch.object(Path, "open", return_value=stream),
        ):
            self.assertEqual(server._load_index()[0], 503)
            read.assert_called_once_with(len(INDEX) + 1)

    def test_symlink_entrypoints_are_unavailable(self) -> None:
        with patch.object(Path, "is_symlink", return_value=True):
            self.assertEqual(server._load_index()[0], 503)

    def test_get_and_head_share_success_and_unavailable_status(self) -> None:
        for available in (False, True):
            if available:
                self.write_source_index()
            for handler_type in (server.Handler, gateway.Handler):
                for path in ("/", "/index.html"):
                    with self.subTest(available=available, handler=handler_type, path=path):
                        get_status, get_headers, get_body = self.capture(handler_type, "do_GET", path)
                        head_status, head_headers, head_body = self.capture(handler_type, "do_HEAD", path)
                        self.assertEqual(get_status, 200 if available else 503)
                        self.assertEqual(head_status, get_status)
                        self.assertEqual(get_headers["Content-Type"], "text/html; charset=utf-8")
                        self.assertEqual(head_headers["Content-Type"], get_headers["Content-Type"])
                        self.assertEqual(int(get_headers["Content-Length"]), len(get_body))
                        self.assertEqual(head_headers["Content-Length"], get_headers["Content-Length"])
                        self.assertEqual(head_body, b"")
                        self.assertEqual(get_headers["Cache-Control"], "no-store")
                        self.assertEqual(head_headers["Cache-Control"], "no-store")


if __name__ == "__main__":
    unittest.main()
