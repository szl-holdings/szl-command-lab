import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { KhipuLedger } from "@/components/khipu-ledger";
import { PageHeader } from "@/components/page-header";
import { ReceiptCard } from "@/components/receipt-card";
import { Button } from "@/components/ui/button";
import { useLedger } from "@/lib/ledger-store";
import { verifyChain, type ChainResult, type VerifyResult } from "@/lib/receipt";
import { formatWhen, shortSha } from "@/lib/utils";

export const Route = createFileRoute("/ledger")({ component: Ledger });

export function Ledger() {
  const receipts = useLedger((s) => s.receipts);
  const clear = useLedger((s) => s.clear);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, VerifyResult>>({});
  const [checked, setChecked] = useState<{ receipts: typeof receipts; result: ChainResult } | null>(null);
  const chain = checked?.receipts === receipts ? checked.result : null;
  const selected = receipts.find((r) => r.id === selectedId) ?? receipts[receipts.length - 1] ?? null;
  const selectedIndex = selected ? receipts.findIndex((r) => r.id === selected.id) : -1;
  const selectedLinkFailures =
    chain && selectedIndex >= 0 ? chain.link_failures.filter((f) => f.index === selectedIndex) : [];
  const selectedVerify = selected ? (results[selected.id] ?? null) : null;
  const cardVerify: VerifyResult | null = selectedVerify
    ? selectedLinkFailures.length === 0
      ? selectedVerify
      : {
          ...selectedVerify,
          ok: false,
          failures: [
            ...selectedLinkFailures.map((f) => `chain link FAIL (knot ${f.index + 1}): ${f.reason}`),
            ...selectedVerify.failures,
          ],
        }
    : null;

  async function checkAll() {
    const result = await verifyChain(receipts);
    const next: Record<string, VerifyResult> = {};
    receipts.forEach((receipt, i) => {
      const prior = next[receipt.id];
      next[receipt.id] = prior && !prior.ok ? prior : result.per_index[i];
    });
    setResults(next);
    setChecked({ receipts, result });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker="Session ledger · local only"
        title="Knots stay on this machine."
        lede="The chain is prev_sha256 of the prior digest. Verify chain checks each knot and its prev_sha256 link. DEMO HMAC key is public: this detects deletion or reorder, not forgery. Clearing the ledger is a local rollback, not an estate mutation. Nothing here is written to GitHub or Hugging Face."
        claims={["DEMO"]}
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="secondary" disabled={!receipts.length} onClick={() => void checkAll()}>
          Verify chain
        </Button>
        <Button variant="deny" disabled={!receipts.length} onClick={() => { clear(); setResults({}); setChecked(null); setSelectedId(null); }}>
          Clear this machine
        </Button>
        <Button asChild variant="ghost">
          <Link to="/command">Mint another</Link>
        </Button>
      </div>

      {chain && (
        <p className="mt-4 font-mono text-[11px]">
          {chain.ok ? (
            <span className="text-allow">Chain PASS · {receipts.length} knots linked</span>
          ) : (
            <span className="text-deny">
              Chain FAIL
              {chain.link_failures.map((f) => ` · knot ${f.index + 1}: ${f.reason}`).join("")}
            </span>
          )}
        </p>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <KhipuLedger receipts={receipts} selectedId={selected?.id} onSelect={setSelectedId} />
        {selected ? (
          <ReceiptCard receipt={selected} verify={cardVerify} />
        ) : (
          <div className="rounded-xl border border-dashed border-line p-5 text-sm text-mute">
            Empty cord. Bind a receipt in Command or Killinchu.
          </div>
        )}
      </div>

      {receipts.length > 0 && (
        <div className="mt-8 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-ink-2 font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
              <tr>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Tool</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Digest</th>
                <th className="px-4 py-3">Verify</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt, i) => {
                const verify = chain?.per_index[i];
                const linkBroken = chain?.link_failures.some((f) => f.index === i) ?? false;
                return (
                  <tr
                    key={receipt.id}
                    className={`border-t border-line ${receipt.id === selected?.id ? "bg-ink-2" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-[11px]">{formatWhen(receipt.issued_at)}</td>
                    <td className="px-4 py-3">
                      <button type="button" className="min-h-11 text-left" onClick={() => setSelectedId(receipt.id)}>
                        {receipt.tool}
                      </button>
                    </td>
                    <td className={receipt.decision === "ALLOW" ? "px-4 py-3 text-allow" : "px-4 py-3 text-deny"}>
                      {receipt.decision}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-steel">{shortSha(receipt.digest, 6)}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {verify ? (verify.ok && !linkBroken ? <span className="text-allow">PASS</span> : <span className="text-deny">FAIL</span>) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
