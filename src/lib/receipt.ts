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

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, sortValue(v)]));
  }
  return value;
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
  const receiptBody: ReceiptBody = {
    schema: RECEIPT_SCHEMA,
    id: newReceiptId(),
    issued_at: new Date().toISOString(),
    evidence_class: EVIDENCE_CLASS,
    signer_class: SIGNER_CLASS,
    ...body,
  };
  const digest = await sha256Hex(canonicalJson(receiptBody));
  const mac = await hmacHex(digest);
  return { ...receiptBody, digest, mac };
}

export async function verifyReceipt(receipt: Receipt): Promise<VerifyResult> {
  const failures: string[] = [];
  const schema_ok = receipt.schema === RECEIPT_SCHEMA;
  if (!schema_ok) failures.push("schema mismatch");

  const { digest, mac, ...body } = receipt;
  const recomputed_digest = await sha256Hex(canonicalJson(body));
  const digest_match = recomputed_digest === digest;
  if (!digest_match) failures.push("digest mismatch — payload was altered");

  const recomputed_mac = await hmacHex(recomputed_digest);
  const mac_match = recomputed_mac === mac && digest_match;
  if (!mac_match) failures.push("mac mismatch — signer binding failed");

  if (receipt.signer_class !== SIGNER_CLASS) failures.push("unexpected signer class");
  if (receipt.evidence_class !== EVIDENCE_CLASS) failures.push("unexpected evidence class");

  return {
    ok: failures.length === 0,
    digest_match,
    mac_match,
    schema_ok,
    failures,
    recomputed_digest,
  };
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
