import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CAPTURED_AT, GITHUB, HF } from "@/lib/census";
import { publicPacket } from "@/lib/identity";
import { ORIGINS } from "@/lib/publish";

export const Route = createFileRoute("/identity")({ component: Identity });

export function Identity() {
  const packet = publicPacket();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(packet);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker={`Public identity packet · ${CAPTURED_AT}`}
        title="Famous is a receipt, not a slogan."
        lede="Copy the MEASURED packet. Point people at product, proof, and Hub. This page is unpublished DEMO chrome around public facts. It is not a fourth origin."
        claims={["MEASURED", "DEMO"]}
      />

      <section className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Mini label="GitHub repos" value={String(GITHUB.org)} />
        <Mini label="Hub models" value={String(HF.models)} />
        <Mini label="Hub spaces" value={String(HF.spaces)} />
        <Mini label="Joblib remaining" value={String(HF.joblib_still_present)} />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-xl border border-line bg-ink-2 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">Copy this</p>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-bone">{packet}</pre>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => void copy()}>{copied ? "Copied" : "Copy packet"}</Button>
            <Button asChild variant="secondary">
              <a href="https://a11oy.net/estate/" target="_blank" rel="noreferrer">
                Open proof snapshot
              </a>
            </Button>
          </div>
        </article>
        <div className="grid gap-3">
          {ORIGINS.filter((o) => o.host !== "this preview").map((o) => (
            <article key={o.host} className="rounded-xl border border-line p-4">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">{o.role}</p>
              <p className="mt-1 font-display text-2xl">{o.host}</p>
              <p className="mt-2 text-sm text-mute">{o.note}</p>
              {o.href.startsWith("http") ? (
                <a className="mt-3 inline-flex min-h-11 items-center font-mono text-xs text-steel hover:text-bone" href={o.href} target="_blank" rel="noreferrer">
                  Open
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <p className="mt-8 text-sm text-mute">
        Operator loop stays on{" "}
        <Link to="/command" className="text-steel hover:text-bone">
          Command
        </Link>{" "}
        and{" "}
        <Link to="/frontier" className="text-steel hover:text-bone">
          Frontier
        </Link>
        . Inventory on{" "}
        <Link to="/registry" className="text-steel hover:text-bone">
          Registry
        </Link>
        .
      </p>
    </main>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink px-5 py-6">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums">{value}</p>
    </div>
  );
}
