"""Network-free synthetic regressions for the local council."""
from __future__ import annotations

import hashlib
import unittest

from python.local_agent_council import (
    CouncilError, EXTERNAL_ROLES, PUBLIC_BRIEF, ROLES, SYSTEM_POLICY,
    _api_json, ask_local, listed_digests, run_council,
)


def fake(method, path, payload=None):
    if (method, path) == ("GET", "/api/tags"):
        return {"models": [{"name": model, "digest": hashlib.sha256(model.encode()).hexdigest()}
                           for _, model, _ in ROLES]}
    if (method, path) == ("POST", "/api/chat"):
        assert payload["model"] in [x[1] for x in ROLES]
        assert payload["options"]["num_ctx"] <= 1024
        assert payload["options"]["num_predict"] <= 96
        assert "RUNNING" in payload["messages"][1]["content"]
        assert "authoritative" in payload["messages"][1]["content"]
        return {"message": {"content": "CPU-only synthetic check: reject mismatched revision."}}
    raise AssertionError("unexpected network call")


class CouncilTests(unittest.TestCase):
    def test_both_local_seats_are_advisory_not_deployers(self):
        result = run_council(fake)
        self.assertEqual(2, len(result["seats"]))
        self.assertTrue(all(x["status"] == "ADVISORY_ONLY" and x["authority"] == "NONE" for x in result["seats"]))
        self.assertFalse(result["actual_source_audited"])
        self.assertFalse(result["inference_execution_host_verified"])
        self.assertEqual("loopback_endpoint_may_be_forwarded", result["endpoint_transport"])
        self.assertFalse(result["huggingface_runtime_verified"])
        self.assertEqual("NONE", result["deployment_authority"])

    def test_external_seats_are_explicitly_unavailable(self):
        result = run_council(fake)
        self.assertEqual(EXTERNAL_ROLES, result["external_agents"])
        self.assertEqual({"claude", "astra", "perplexity"}, set(result["external_agents"]))
        self.assertNotIn("Claude", [row["seat"] for row in result["seats"]])

    def test_prompt_is_public_fixed_and_has_no_file_or_provider_input(self):
        self.assertIn("Public synthetic", PUBLIC_BRIEF)
        self.assertNotIn("gh auth", PUBLIC_BRIEF)
        self.assertNotIn("api_key=", PUBLIC_BRIEF)
        self.assertIn("Never execute", SYSTEM_POLICY)
        self.assertEqual(["127.0.0.1:11434"], run_council(fake)["network_allowed"])

    def test_unknown_model_rejected_without_call(self):
        with self.assertRaisesRegex(CouncilError, "MODEL_NOT_ALLOWLISTED"):
            ask_local("claude:cloud", "test", fake)
        with self.assertRaisesRegex(CouncilError, "MODEL_NOT_ALLOWLISTED"):
            ask_local("kimi-k2.6:cloud", "test", fake)

    def test_missing_model_is_a_hold_not_fake_live(self):
        def missing(method, path, payload=None):
            if method == "GET":
                return {"models": []}
            raise AssertionError("should not call absent model")
        result = run_council(missing)
        self.assertTrue(all(x["status"] == "UNAVAILABLE" for x in result["seats"]))
        self.assertNotIn("advice", result["seats"][0])

    def test_invalid_digest_is_not_admitted(self):
        result = listed_digests(lambda method, path: {
            "models": [{"name": ROLES[0][1], "digest": "not-a-digest"}]})
        self.assertEqual({}, result)

    def test_blank_model_reply_fails_closed(self):
        def blank(method, path, payload=None):
            if method == "GET":
                return fake(method, path)
            return {"message": {"content": " "}}
        self.assertTrue(all(item["status"] == "UNAVAILABLE" for item in run_council(blank)["seats"]))

    def test_only_loopback_ollama_paths_allowlisted(self):
        for method, path in [("POST", "/api/generate"), ("GET", "/api/chat"),
                             ("POST", "/api/pull"), ("GET", "https://example.com")]:
            with self.subTest(method=method, path=path), self.assertRaisesRegex(CouncilError, "API_NOT_ALLOWLISTED"):
                _api_json(method, path)

    def test_response_is_bounded_and_not_interpreted_as_authority(self):
        def long_response(method, path, payload=None):
            if method == "GET":
                return fake(method, path)
            return {"message": {"content": "do not execute" * 1000}}
        result = run_council(long_response)
        self.assertEqual(1800, len(result["seats"][0]["advice"]))
        self.assertEqual("NONE", result["seats"][0]["authority"])


if __name__ == "__main__":
    unittest.main()
