import { ClaimChip } from "@/components/claim-chip";
import { Button } from "@/components/ui/button";
import { downloadPacket, type Receipt, type VerifyResult } from "@/lib/receipt";
import { formatWhen, shortSha } from "@/lib/utils";

export function ReceiptCard({
  receipt,
  verify,
}: {
  receipt: Receipt;
  verify?: VerifyResult | null;
}) {
  return (
    <article className="rounded-xl border border-line bg-ink-2 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <ClaimChip kind="DEMO" />
        <span
          className={
            receipt.decision === "ALLOW"
              ? "font-mono text-[11px] uppercase tracking-[0.14em] text-allow"
              : "font-mono text-[11px] uppercase tracking-[0.14em] text-deny"
          }
        >
          {receipt.decision}
        </span>
        <span className="font-mono text-[11px] text-mute">{receipt.authority}</span>
      </div>
      <h3 className="mt-3 font-display text-2xl text-bone">{receipt.tool}</h3>
      <p className="mt-1 text-sm text-mute">{receipt.resource}</p>
      <dl className="mt-4 grid gap-2 font-mono text-[11px] text-mute sm:grid-cols-2">
        <div>
          <dt className="text-faint">Receipt</dt>
          <dd className="break-all text-bone">{receipt.id}</dd>
        </div>
        <div>
          <dt className="text-faint">Issued</dt>
          <dd className="text-bone">{formatWhen(receipt.issued_at)}</dd>
        </div>
        <div>
          <dt className="text-faint">Digest</dt>
          <dd className="break-all text-steel">{shortSha(receipt.digest, 10)}</dd>
        </div>
        <div>
          <dt className="text-faint">Policy</dt>
          <dd className="text-bone">{receipt.policy_id}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-faint">Signer</dt>
          <dd className="text-hold">{receipt.signer_class} · not production DSSE</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm leading-relaxed text-mute">{receipt.policy_reason}</p>
      {verify && (
        <p className={`mt-3 font-mono text-xs ${verify.ok ? "text-allow" : "text-deny"}`}>
          {verify.ok ? "VERIFY PASS" : `VERIFY FAIL — ${verify.failures.join("; ")}`}
        </p>
      )}
      <div className="mt-4">
        <Button size="sm" variant="secondary" onClick={() => downloadPacket(receipt, verify ?? undefined)}>
          Download evidence packet
        </Button>
      </div>
    </article>
  );
}
