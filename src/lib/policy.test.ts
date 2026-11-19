// SPDX-License-Identifier: Apache-2.0
// (c) 2026 Lutar, Stephen P. - SZL Holdings - ORCID 0009-0001-0110-4173
import assert from "node:assert/strict";
import test from "node:test";
import { SCENARIOS, evaluatePolicy } from "./policy.ts";
import type { ProposedAction } from "./policy.ts";

function action(tool: string, resource: string, args: Record<string, unknown> = {}): ProposedAction {
  return { actor: "test.actor", tool, resource, args };
}

const GOLDENS: Record<string, { verdict: string; policy_id: string }> = {
  "pii-export": { verdict: "HARD_DENY", policy_id: "pol.pii-exfil-v1" },
  "deploy-adapter": { verdict: "REQUIRE_HUMAN", policy_id: "pol.no-auto-promote-v1" },
  "query-ledger": { verdict: "ALLOW", policy_id: "pol.read-bound-v1" },
  "delete-evidence": { verdict: "HARD_DENY", policy_id: "pol.evidence-append-only-v1" },
  "intercept-track": { verdict: "REQUIRE_HUMAN", policy_id: "pol.killinchu-advisory-v1" },
};

test("every scenario has a golden verdict", () => {
  assert.equal(SCENARIOS.length, 5);
  for (const s of SCENARIOS) {
    const golden = GOLDENS[s.id];
    assert.ok(golden, `missing golden for scenario ${s.id}`);
    const result = evaluatePolicy(s.action);
    assert.equal(result.verdict, golden.verdict, s.id);
    assert.equal(result.policy_id, golden.policy_id, s.id);
  }
});

for (const tool of ["delete_objects", "Delete_Objects", "DELETE_OBJECTS", " delete_objects ", "delete_objects\t"]) {
  test(`delete_objects variant ${JSON.stringify(tool)} is HARD_DENY`, () => {
    const result = evaluatePolicy(action(tool, "bucket:other"));
    assert.equal(result.verdict, "HARD_DENY");
    assert.equal(result.policy_id, "pol.evidence-append-only-v1");
    assert.equal(result.human_can_approve, false);
    assert.equal(result.effector_class, "NONE");
  });
}

for (const tool of ["export_records", "EXPORT_RECORDS", " Export_Records "]) {
  test(`export_records variant ${JSON.stringify(tool)} on a PII resource is HARD_DENY`, () => {
    const result = evaluatePolicy(action(tool, "customers.pii"));
    assert.equal(result.verdict, "HARD_DENY");
    assert.equal(result.policy_id, "pol.pii-exfil-v1");
    assert.equal(result.human_can_approve, false);
  });

  test(`export_records variant ${JSON.stringify(tool)} with ssn fields is HARD_DENY`, () => {
    const result = evaluatePolicy(action(tool, "orders.summary", { fields: ["ssn"] }));
    assert.equal(result.verdict, "HARD_DENY");
    assert.equal(result.policy_id, "pol.pii-exfil-v1");
    assert.equal(result.human_can_approve, false);
  });
}

test("an unknown tool fails closed to human review", () => {
  const result = evaluatePolicy(action("mystery_tool", "anything"));
  assert.equal(result.verdict, "REQUIRE_HUMAN");
  assert.equal(result.policy_id, "pol.default-fail-closed-v1");
});

test("only read-bound tools reach ALLOW", () => {
  for (const tool of ["deploy_adapter", "promote_weights", "recommend_intercept", "engage_target", "mystery_tool"]) {
    assert.notEqual(evaluatePolicy(action(tool, "anything")).verdict, "ALLOW", tool);
  }
});

test("a resource naming szl-evidence is HARD_DENY whatever the tool", () => {
  for (const tool of ["query_ledger", "read_status", "deploy_adapter", "mystery_tool"]) {
    const result = evaluatePolicy(action(tool, "bucket:SZL-Evidence/archive"));
    assert.equal(result.verdict, "HARD_DENY", tool);
    assert.equal(result.human_can_approve, false, tool);
  }
});
