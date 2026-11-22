"""Network-free synthetic regressions for the local council."""
from __future__ import annotations

import unittest

from python.local_agent_council import (
    CouncilError, EXTERNAL_ROLES, EXPECTED_DIGESTS, PUBLIC_BRIEF, ROLES,
    SYSTEM_POLICY, _api_json, ask_local, listed_digests, run_council,
)


def fake(method, path, payload=None):
    if (method, path) == ("GET", "/api/tags"):
        return {"models": [{"name": model, "digest": EXPECTED_DIGESTS[model]}
                           for _, model, _ in ROLES]}
    if (method, path) == ("POST", "/api/chat"):
        assert payload["model"] in [x[1] for x in ROLES]
        assert payload["options"]["num_ctx"] <= 1024
        assert payload["options"]["num_predict"] <= 96
        assert payload["options"]["num_gpu"] == 0
        assert payload["keep_alive"] == 0
        assert "RUNNING" in payload["messages"][1]["content"]
        assert "authoritative" in payload["messages"][1]["content"]
        return {"done": True, "done_reason": "stop", "model": payload["model"],
                "message": {"role": "assistant", "content": "CPU-only synthetic check: reject mismatched revision."}}
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

    def test_mismatched_digest_is_a_hold(self):
        wrong = "0" * 64
        def changed(method, path, payload=None):
            if method == "GET":
                return {"models": [{"name": ROLES[0][1], "digest": wrong}]}
            raise AssertionError("mismatched model must not be queried")
        result = run_council(changed)
        self.assertEqual("MODEL_DIGEST_MISMATCH", result["seats"][0]["reason"])
        self.assertEqual("UNAVAILABLE", result["seats"][0]["status"])

    def test_blank_model_reply_fails_closed(self):
        def blank(method, path, payload=None):
            if method == "GET":
                return fake(method, path)
            return {"done": True, "model": payload["model"], "message": {"role": "assistant", "content": " "}}
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
            return {"done": True, "done_reason": "stop", "model": payload["model"],
                    "message": {"role": "assistant", "content": "do not execute" * 1000}}
        result = run_council(long_response)
        self.assertTrue(all(item["status"] == "UNAVAILABLE" for item in result["seats"]))
        self.assertTrue(all(item["reason"] == "OLLAMA_REPLY_TOO_LONG" for item in result["seats"]))
        self.assertTrue(all("advice" not in item for item in result["seats"]))
        self.assertEqual("NONE", result["seats"][0]["authority"])


    def test_nonterminal_response_is_not_admitted_as_advice(self):
        def partial(method, path, payload=None):
            if method == "GET":
                return fake(method, path)
            return {"done": False, "model": payload["model"],
                    "message": {"role": "assistant", "content": "partial text"}}
        result = run_council(partial)
        self.assertTrue(all(x["status"] == "UNAVAILABLE" for x in result["seats"]))
        self.assertTrue(all(x["reason"] == "OLLAMA_REPLY_NOT_FINAL" for x in result["seats"]))

    def test_other_model_identity_cannot_be_misattributed(self):
        def wrong_model(method, path, payload=None):
            if method == "GET":
                return fake(method, path)
            return {"done": True, "model": "untrusted:other",
                    "message": {"role": "assistant", "content": "candidate advice"}}
        result = run_council(wrong_model)
        self.assertTrue(all(x["reason"] == "OLLAMA_MODEL_IDENTITY_MISMATCH" for x in result["seats"]))

    def test_unrequested_tool_calls_are_never_advisory_success(self):
        def tool_request(method, path, payload=None):
            if method == "GET":
                return fake(method, path)
            return {"done": True, "model": payload["model"],
                    "message": {"role": "assistant", "content": "run this",
                                "tool_calls": [{"function": {"name": "shell", "arguments": {}}}]}}
        result = run_council(tool_request)
        self.assertTrue(all(x["reason"] == "OLLAMA_TOOL_CALL_REFUSED" for x in result["seats"]))


    def test_cutoff_or_missing_done_reason_is_not_advisory(self):
        for reason in ("length", None, "load"):
            with self.subTest(reason=reason):
                def cut(method, path, payload=None):
                    if method == "GET":
                        return fake(method, path)
                    return {"done": True, "done_reason": reason, "model": payload["model"],
                            "message": {"role": "assistant", "content": "looks plausible"}}
                result = run_council(cut)
                self.assertTrue(all(x["status"] == "UNAVAILABLE" for x in result["seats"]))
                self.assertTrue(all(x["reason"] == "OLLAMA_REPLY_NOT_STOPPED" for x in result["seats"]))
                self.assertTrue(all("advice" not in x for x in result["seats"]))

    def test_thinking_delimiters_are_never_advisory(self):
        for marker in ("◁think▷", "<think>", "</think>", "[think]"):
            with self.subTest(marker=marker):
                def thinking(method, path, payload=None):
                    if method == "GET":
                        return fake(method, path)
                    return {"done": True, "done_reason": "stop", "model": payload["model"],
                            "message": {"role": "assistant", "content": marker + "private reasoning"}}
                result = run_council(thinking)
                self.assertTrue(all(x["status"] == "UNAVAILABLE" for x in result["seats"]))
                self.assertTrue(all(x["reason"] == "OLLAMA_THINKING_TEXT" for x in result["seats"]))
                self.assertTrue(all("advice" not in x for x in result["seats"]))



if __name__ == "__main__":
    unittest.main()
