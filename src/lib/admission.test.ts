// SPDX-License-Identifier: Apache-2.0
// (c) 2026 Lutar, Stephen P. - SZL Holdings - ORCID 0009-0001-0110-4173
import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRelease } from "./admission.ts";
import { mintReceipt } from "./receipt.ts";
import type { Decision, Receipt } from "./receipt.ts";

async function mintChain(decisions: Decision[]): Promise<Receipt[]> {
  const chain: Receipt[] = [];
  for (const decision of decisions) {
    chain.push(await mintReceipt({
      actor: "offline", tool: "test", resource: "test", args: { n: chain.length },
      policy_id: "fixture", policy_reason: "offline regression", decision,
      authority: "POLICY", effector_class: "NONE",
      prev_sha256: chain.length ? chain[chain.length - 1].digest : null,
    }));
  }
  return chain;
}

test("a broken chain is CHAIN_UNVERIFIED, never a deny count", async () => {
  const [r1, , r3] = await mintChain(["DENY", "DENY", "ALLOW"]);
  assert.equal(evaluateRelease([r1, r3], { ok: false }).verdict, "CHAIN_UNVERIFIED");
});

test("an orphan with no deny knots is not reported as NO_CASES when the chain fails", async () => {
  const [, , r3] = await mintChain(["DENY", "DENY", "ALLOW"]);
  const evaluation = evaluateRelease([r3], { ok: false });
  assert.notEqual(evaluation.verdict, "NO_CASES");
  assert.equal(evaluation.verdict, "CHAIN_UNVERIFIED");
});

test("a pending chain check fails closed", async () => {
  const full = await mintChain(["DENY", "DENY", "ALLOW"]);
  assert.equal(evaluateRelease(full, undefined).verdict, "CHAIN_UNVERIFIED");
  assert.equal(evaluateRelease(full, null).verdict, "CHAIN_UNVERIFIED");
});

test("a verified chain with deny knots blocks release", async () => {
  const full = await mintChain(["DENY", "DENY", "ALLOW"]);
  const evaluation = evaluateRelease(full, { ok: true });
  assert.equal(evaluation.verdict, "RELEASE_BLOCKED");
  assert.equal(evaluation.deny_knots, 2);
});

test("a verified empty chain has no cases", () => {
  assert.equal(evaluateRelease([], { ok: true }).verdict, "NO_CASES");
});
