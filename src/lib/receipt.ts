/**
 * In-browser demo receipt contract.
 *
 * Signer class is WEBCRYPTO_HMAC_DEMO — it proves the bind/verify loop
 * without claiming production DSSE / ECDSA-P256 authority.
 */

export const RECEIPT_SCHEMA = "szl.demo-receipt/v1";
export const SIGNER_CLASS = "WEBCRYPTO_HMAC_DEMO";
export const EVIDENCE_CLASS = "DEMO";
export const DEMO_SIGNER_MATERIAL = "SZL_DEMO_SIGNER_NOT_PRODUCTION_v1";

export type Decision = "ALLOW" | "DENY";
export type Authority = "HUMAN" | "POLICY";

export type ReceiptBody = {
  schema: typeof RECEIPT_SCHEMA;
  id: string;
  issued_at: string;
  actor: string;
  tool: string;
  resource: string;
  args: Record<string, unknown>;
  policy_id: string;
  policy_reason: string;
  decision: Decision;
  authority: Authority;
  effector_class: "NONE" | "ADVISORY" | "SIMULATED";
  prev_sha256: string | null;
  evidence_class: typeof EVIDENCE_CLASS;
  signer_class: typeof SIGNER_CLASS;
};

export type Receipt = ReceiptBody & {
  digest: string;
  mac: string;
};

export type VerifyResult = {
  ok: boolean;
  digest_match: boolean;
  mac_match: boolean;
  schema_ok: boolean;
  failures: string[];
  recomputed_digest: string;
};

/** Refuse values that JSON would silently omit or coerce before hashing. */
function sortValue(value: unknown, ancestors = new Set<object>(), depth = 0): unknown {
  if (depth > 128) throw new TypeError("receipt JSON depth limit");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite receipt number");
    return value; // JSON intentionally treats -0 and 0 as equivalent.
  }
  if (typeof value !== "object") throw new TypeError("non-JSON receipt value");
  if (ancestors.has(value)) throw new TypeError("cyclic receipt JSON");
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (!array && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("receipt JSON must use plain objects");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string")) {
    throw new TypeError("symbol receipt key");
  }
  ancestors.add(value);
  try {
    if (array) {
      if (Object.keys(descriptors).length !== value.length + 1) throw new TypeError("extra array keys");
      const result: unknown[] = [];
      for (let index = 0; index < value.length; index++) {
        const item = descriptors[String(index)];
        if (!item?.enumerable || !("value" in item)) throw new TypeError("sparse or accessor array");
        result.push(sortValue(item.value, ancestors, depth + 1));
      }
      return result;
    }
    const result: Record<string, unknown> = Object.create(null);
    // Preserve the existing comparator for already-valid JSON receipts.
    for (const key of Object.keys(descriptors).sort((a, b) => a.localeCompare(b))) {
      const item = descriptors[key];
      if (!item.enumerable || !("value" in item)) throw new TypeError("non-data receipt property");
      result[key] = sortValue(item.value, ancestors, depth + 1);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return hex(digest);
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(DEMO_SIGNER_MATERIAL),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmacHex(message: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return hex(sig);
}

export function newReceiptId(): string {
  const rand = crypto.getRandomValues(new Uint8Array(6));
  const suffix = [...rand].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `rcp_${Date.now().toString(16)}_${suffix}`;
}

export async function mintReceipt(
  body: Omit<ReceiptBody, "schema" | "id" | "issued_at" | "evidence_class" | "signer_class">,
): Promise<Receipt> {
  // Detach nested input before the first await so the returned body matches
  // the exact bytes hashed, even if the caller mutates its input meanwhile.
  const input = JSON.parse(canonicalJson(body)) as typeof body;
  const receiptBody: ReceiptBody = {
    schema: RECEIPT_SCHEMA,
    id: newReceiptId(),
    issued_at: new Date().toISOString(),
    evidence_class: EVIDENCE_CLASS,
    signer_class: SIGNER_CLASS,
    ...input,
  };
  const digest = await sha256Hex(canonicalJson(receiptBody));
  const mac = await hmacHex(digest);
  return { ...receiptBody, digest, mac };
}

export async function verifyReceipt(receipt: Receipt): Promise<VerifyResult> {
  const invalid = (reason: string): VerifyResult => ({
    ok: false, digest_match: false, mac_match: false, schema_ok: false,
    failures: [reason], recomputed_digest: "",
  });
  let snapshot: string;
  let candidate: Receipt;
  try {
    snapshot = canonicalJson(receipt);
    candidate = JSON.parse(snapshot) as Receipt;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return invalid("receipt must be a JSON object");
    }
  } catch {
    return invalid("receipt contains invalid or lossy JSON");
  }
  const failures: string[] = [];
  const schema_ok = candidate.schema === RECEIPT_SCHEMA;
  if (!schema_ok) failures.push("schema mismatch");

  const { digest, mac, ...body } = candidate;
  let recomputed_digest: string;
  let recomputed_mac: string;
  try {
    recomputed_digest = await sha256Hex(canonicalJson(body));
    recomputed_mac = await hmacHex(recomputed_digest);
  } catch {
    return invalid("receipt verification unavailable");
  }
  const digest_match = recomputed_digest === digest;
  if (!digest_match) failures.push("digest mismatch — payload was altered");
  const mac_match = recomputed_mac === mac && digest_match;
  if (!mac_match) failures.push("mac mismatch — signer binding failed");

  if (candidate.signer_class !== SIGNER_CLASS) failures.push("unexpected signer class");
  if (candidate.evidence_class !== EVIDENCE_CLASS) failures.push("unexpected evidence class");
  try {
    if (canonicalJson(receipt) !== snapshot) failures.push("receipt changed during verification");
  } catch {
    failures.push("receipt changed during verification");
  }
  return { ok: failures.length === 0, digest_match, mac_match, schema_ok,
    failures, recomputed_digest };
}

export function tamperReceipt(receipt: Receipt, field: keyof ReceiptBody, value: unknown): Receipt {
  return { ...receipt, [field]: value } as Receipt;
}

export function downloadPacket(receipt: Receipt, verify?: VerifyResult) {
  const packet = {
    captured_at: new Date().toISOString(),
    truth: "DEMO receipt. Not a production DSSE envelope. Offline-verifiable against this demo signer only.",
    receipt,
    verify: verify ?? null,
  };
  const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${receipt.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
