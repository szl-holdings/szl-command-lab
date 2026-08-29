import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ReceiptCard } from "@/components/receipt-card";
import { Button } from "@/components/ui/button";
import { chainHead, useLedger } from "@/lib/ledger-store";
import { mintReceipt, tamperReceipt, verifyReceipt, type Receipt, type VerifyResult } from "@/lib/receipt";

export const Route = createFileRoute("/verify")({ component: Verify });

export function Verify() {
  const receipts = useLedger((s) => s.receipts);
  const append = useLedger((s) => s.append);
  const [busy, setBusy] = useState(false);
  const [tampered, setTampered] = useState<Receipt | null>(null);
  const [originalResult, setOriginalResult] = useState<VerifyResult | null>(null);
  const [tamperResult, setTamperResult] = useState<VerifyResult | null>(null);
  const original = receipts[receipts.length - 1] ?? null;

  const restored = useMemo(() => {
    if (!tampered || !original) return null;
    return original;
  }, [tampered, original]);

  async function mintSample() {
    setBusy(true);
    try {
      const receipt = await mintReceipt({
        actor: "human.operator",
        tool: "query_ledger",
        resource: "receipts.chain",
        args: { demo: "tamper-verify" },
        policy_id: "pol.read-bound-v1",
        policy_reason: "Sample knot minted so verification can be shown without a prior Command decision.",
        decision: "ALLOW",
        authority: "HUMAN",
        effector_class: "NONE",
        prev_sha256: chainHead(receipts),
      });
      append(receipt);
      setTampered(null);
      setTamperResult(null);
      setOriginalResult(await verifyReceipt(receipt));
    } finally {
      setBusy(false);
    }
  }

  async function checkOriginal() {
    if (!original) return;
    setOriginalResult(await verifyReceipt(original));
  }

  async function alter() {
    if (!original) return;
    const next = tamperReceipt(original, "resource", "receipts.chain.TAMPERED");
    setTampered(next);
    setTamperResult(await verifyReceipt(next));
    setOriginalResult(await verifyReceipt(original));
  }

  async function restore() {
    if (!original) return;
    setTampered(null);
    setTamperResult(null);
    setOriginalResult(await verifyReceipt(original));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker="Demo 02 · Tamper and verify"
        title="Alter one field. Verification fails."
        lede="Canonical JSON is hashed. An HMAC binds the digest to this demo signer. Change a single field and the digest no longer matches. Restore the original bytes and it passes. This is not production DSSE."
        claims={["DEMO"]}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        {!original && (
          <Button disabled={busy} onClick={() => void mintSample()}>
            Mint a sample knot
          </Button>
        )}
        {original && (
          <>
            <Button variant="secondary" onClick={() => void checkOriginal()}>
              Verify original
            </Button>
            <Button variant="deny" onClick={() => void alter()}>
              Tamper resource field
            </Button>
            <Button variant="ghost" disabled={!tampered} onClick={() => void restore()}>
              Restore original
            </Button>
            <Button asChild variant="ghost">
              <Link to="/command">Mint from Command</Link>
            </Button>
          </>
        )}
      </div>

      {!original && (
        <p className="mt-8 rounded-xl border border-dashed border-line p-5 text-sm text-mute">
          No knot on this machine yet. Mint a sample or bind a decision in Command first.
        </p>
      )}

      {original && (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <section>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-allow">Original</p>
            <ReceiptCard receipt={original} verify={originalResult} />
          </section>
          <section>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-deny">
              {tampered ? "Tampered copy" : "Waiting for tamper"}
            </p>
            {tampered ? (
              <ReceiptCard receipt={tampered} verify={tamperResult} />
            ) : (
              <div className="rounded-xl border border-dashed border-line p-5 text-sm text-mute">
                Tamper the resource field to watch deterministic failure. The original knot is never rewritten.
              </div>
            )}
          </section>
        </div>
      )}

      {restored && tampered === null && originalResult?.ok && (
        <p className="mt-6 font-mono text-sm text-allow">VERIFY PASS after restore — bytes match the minted knot.</p>
      )}
    </main>
  );
}
