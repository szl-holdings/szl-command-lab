"""Synthetic, network-free exact-endpoint negatives for existing tunnel council."""
from __future__ import annotations

import unittest
from python import tunneled_model_council as c

# Network-free fixture IDs; no server paths or weight bytes are required.
TEST_MODEL_IDS = {28088: "glm-5.3-flash", 28089: "synthetic-bonsai-model-id"}


def mock_call(port, method, path, payload=None):
    seat = next(x for x in c.SEATS if x[1] == port)
    if (method, path) == ("GET", "/health"):
        return {"status": "ok"}
    if (method, path) == ("GET", "/v1/models"):
        # Tests use the model name for GLM and a synthetic but correctly
        # hashed server-side identifier for Bonsai. Its real path is not needed.
        return {"data": [{"id": TEST_MODEL_IDS[port]}]}
    if (method, path) == ("POST", "/v1/chat/completions"):
        assert payload["stream"] is False
        assert payload["max_tokens"] == 128
        assert payload["temperature"] == 0
        return {"choices": [{"finish_reason": "stop",
                             "message": {"role": "assistant", "content": seat[3]}}]}
    raise AssertionError("unapproved method or path")


class TunnelTests(unittest.TestCase):
    def setUp(self):
        # Override only the pinned hash for synthetic non-secret model names.
        self.seats = tuple((name, port, c.hashlib.sha256(
            TEST_MODEL_IDS[port].encode()).hexdigest(), ack)
            for name, port, _, ack in c.SEATS)
        self.original = c.SEATS
        c.SEATS = self.seats

    def tearDown(self):
        c.SEATS = self.original

    def test_both_seats_are_synthetic_only(self):
        result = c.observe(mock_call)
        self.assertEqual(2, len(result["seats"]))
        self.assertTrue(all(x["status"] == "ADVISORY_ONLY" for x in result["seats"]))
        self.assertFalse(result["gpu_hardware_verified"])
        self.assertFalse(result["provider_writes"])
        self.assertEqual("NONE", result["deployment_authority"])
        self.assertTrue(all(not x["weight_bytes_verified"] for x in result["seats"]))

    def test_identity_mismatch_does_not_call_completions(self):
        sent = []
        def malicious(port, method, path, payload=None):
            if (method, path) == ("GET", "/v1/models"):
                return {"data": [{"id": "wrong-model"}]}
            if method == "POST":
                sent.append(path)
            return mock_call(port, method, path, payload)
        result = c.observe(malicious)
        self.assertFalse(sent)
        self.assertTrue(all(x["reason"] == "MODEL_IDENTITY_DRIFT" for x in result["seats"]))

    def test_unknown_port_and_post_route_fail_before_network(self):
        for port, method, path in (
            (28090, "GET", "/health"), (28088, "POST", "/api/pull"),
            (28089, "DELETE", "/v1/models"),
        ):
            with self.subTest(port=port, path=path), self.assertRaisesRegex(
                    c.ObservationHold, "ENDPOINT_NOT_ALLOWLISTED"):
                c.api_call(port, method, path)

    def test_incomplete_and_tool_responses_fail_closed(self):
        for kind in ("length", "tool", "empty", "extra"):
            def broken(port, method, path, payload=None):
                x = mock_call(port, method, path, payload)
                if method == "POST":
                    item = x["choices"][0]
                    if kind == "length":
                        item["finish_reason"] = "length"
                    elif kind == "tool":
                        item["message"]["tool_calls"] = [{"name": "exec"}]
                    elif kind == "empty":
                        item["message"]["content"] = ""
                    elif kind == "extra":
                        item["message"]["content"] += " PRODUCTION_READY"
                return x
            with self.subTest(kind=kind):
                report = c.observe(broken)
                self.assertTrue(all(x["status"] == "UNAVAILABLE" for x in report["seats"]))
                self.assertTrue(all("public_reply_sha256" not in x for x in report["seats"]))

    def test_invalid_health_or_model_collection_never_admits(self):
        for invalid in ("health", "missing", "duplicate"):
            sent = []
            def bad(port, method, path, payload=None):
                if method == "POST":
                    sent.append(path)
                if invalid == "health" and path == "/health":
                    return {"status": "failed"}
                if invalid == "missing" and path == "/v1/models":
                    return {"data": []}
                if invalid == "duplicate" and path == "/v1/models":
                    return {"data": [{"id": TEST_MODEL_IDS[port]}] * 2}
                return mock_call(port, method, path, payload)
            with self.subTest(invalid=invalid):
                report = c.observe(bad)
                self.assertFalse(sent)
                self.assertTrue(all(x["status"] == "UNAVAILABLE" for x in report["seats"]))

    def test_nonfinite_and_duplicate_json_fail(self):
        for raw, reason in (
            (b'{"a":NaN}', "NONFINITE_JSON_NUMBER"),
            (b'{"a":{"nested":[1e999]}}', "NONFINITE_JSON_NUMBER"),
            (b'{"a":1,"a":2}', "DUPLICATE_JSON_KEY"),
            (b"[]", "NONOBJECT_RESPONSE"),
            (b"\xff", "INVALID_JSON_RESPONSE"),
        ):
            with self.subTest(raw=repr(raw)), self.assertRaisesRegex(
                    c.ObservationHold, reason):
                c.parse_reply(raw)


if __name__ == "__main__":
    unittest.main()
