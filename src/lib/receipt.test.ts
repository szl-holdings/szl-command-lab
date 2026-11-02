import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, mintReceipt, verifyReceipt } from "./receipt.ts";
import type { Receipt, ReceiptBody } from "./receipt.ts";

function body(args: Record<string, unknown> = { value: null }): Omit<ReceiptBody,
  "schema" | "id" | "issued_at" | "evidence_class" | "signer_class"> {
  return { actor: "offline", tool: "test", resource: "test", args,
    policy_id: "fixture", policy_reason: "offline regression", decision: "DENY",
    authority: "POLICY", effector_class: "NONE", prev_sha256: null };
}

test("canonical finite JSON stays compatible with the existing order", () => {
  assert.equal(canonicalJson({ z: [-0, 2], a: null }), '{"a":null,"z":[0,2]}');
  assert.equal(canonicalJson({ b: true, a: "x" }), '{"a":"x","b":true}');
});

for (const [name, value] of Object.entries({ nan: NaN, infinity: Infinity,
  negativeInfinity: -Infinity, undefinedRoot: undefined, undefinedKey: { x: undefined },
  undefinedItem: [undefined], sparseArray: new Array(1), bigint: 1n,
  functionValue: () => 1, symbolValue: Symbol("test"), date: new Date(0), map: new Map() })) {
  test(`refuses ${name} before it becomes ambiguous JSON`, () => {
    assert.throws(() => canonicalJson(value));
  });
}

test("nonfinite and omitted-key receipt tampering never verifies", async () => {
  for (const args of [{ value: NaN }, { value: Infinity }, { value: -Infinity },
    { value: null, extra: undefined }]) {
    const receipt = await mintReceipt(body());
    receipt.args = args;
    assert.equal((await verifyReceipt(receipt)).ok, false);
  }
});

test("mint refuses lossy values instead of minting colliding digests", async () => {
  await assert.rejects(mintReceipt(body({ value: NaN })));
  await assert.rejects(mintReceipt(body({ value: undefined })));
});

test("malformed receipts return a fail-closed result", async () => {
  for (const receipt of [null, undefined, [], {}, "invalid"]) {
    assert.equal((await verifyReceipt(receipt as unknown as Receipt)).ok, false);
  }
});

test("getters, hidden keys, symbol keys and extra array fields are refused", () => {
  let reads = 0;
  const getter = { get x() { reads++; return 1; } };
  for (const value of [getter, Object.defineProperty({}, "x", { value: 1 }),
    { [Symbol("key")]: 1 }, Object.assign([1], { extra: 2 })]) {
    assert.throws(() => canonicalJson(value));
  }
  assert.equal(reads, 0);
});

test("cycles and excessive nesting fail but shared ordinary JSON is valid", () => {
  const cycle: { value?: unknown } = {}; cycle.value = cycle;
  assert.throws(() => canonicalJson(cycle));
  let deep: unknown = null;
  for (let depth = 0; depth < 140; depth++) deep = [deep];
  assert.throws(() => canonicalJson(deep));
  const shared = { x: 1 };
  assert.equal(canonicalJson([shared, shared]), '[{"x":1},{"x":1}]');
});

test("own __proto__ is retained in the digest input", () => {
  assert.notEqual(canonicalJson(JSON.parse('{"__proto__":{"x":1}}')), canonicalJson({}));
});

test("mint captures its validated input before asynchronous crypto", async () => {
  const args = { value: "original" };
  const pending = mintReceipt(body(args));
  args.value = "mutated";
  const receipt = await pending;
  assert.equal(receipt.args.value, "original");
  assert.equal((await verifyReceipt(receipt)).ok, true);
});

test("a receipt changed during verification cannot return success", async () => {
  const receipt = await mintReceipt(body());
  const pending = verifyReceipt(receipt);
  receipt.resource = "changed";
  assert.equal((await pending).ok, false);
});

test("ordinary receipt tampering fails and valid roundtrips verify", async () => {
  const receipt = await mintReceipt(body({ a: 1, b: [true, null] }));
  assert.equal((await verifyReceipt(JSON.parse(JSON.stringify(receipt)))).ok, true);
  receipt.resource = "changed";
  assert.equal((await verifyReceipt(receipt)).ok, false);
});
