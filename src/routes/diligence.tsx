import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ClaimChip } from "@/components/claim-chip";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CATEGORY, COMPETITOR_PRINCIPLES, GITHUB, HF, OPEN_PR_SUMMARY } from "@/lib/census";
import { ORIGINS, RECOMMENDATION } from "@/lib/publish";

export const Route = createFileRoute("/diligence")({ component: Diligence });

export function Diligence() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker="Due-diligence room"
        title="What is true, labeled."
        lede={CATEGORY}
        claims={["DEMO", "MEASURED"]}
      />

      <section className="mt-8 rounded-xl border border-line bg-ink-2 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Public origins</p>
        <h2 className="mt-2 font-display text-2xl">Do not merge hosts.</h2>
        <p className="mt-2 text-sm text-mute">{RECOMMENDATION.verdict}</p>
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {ORIGINS.map((o) => (
            <li key={o.host} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
              <span className="font-mono text-sm">{o.host}</span>
              <span className="text-sm text-mute">
                {o.role} · {o.status.replaceAll("_", " ")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Panel title="Category">
          <p>
            Governed decision infrastructure that turns model proposals into policy-bounded, evidence-linked,
            human-accountable actions. Not 74 equal products.
          </p>
        </Panel>
        <Panel title="Two products first">
          <p>
            <strong className="text-bone">a11oy</strong> — governed-agent command and evidence platform.{" "}
            <strong className="text-bone">Killinchu</strong> — bounded drones/maritime decision intelligence
            on the same contract. Effectors are simulated.
          </p>
        </Panel>
      </section>

      <section className="mt-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Operating metrics</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-ink-2 font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
              <tr>
                <th className="px-4 py-3">Fact</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Label</th>
              </tr>
            </thead>
            <tbody>
              <Metric fact="GitHub org repositories" value={String(GITHUB.org)} label="MEASURED" />
              <Metric fact="Open pull requests" value={String(GITHUB.open_prs)} label="MEASURED" />
              <Metric fact="Merge-qualified PRs this recapture" value={String(GITHUB.merge_qualified)} label="MEASURED" />
              <Metric fact="HF models / datasets / spaces" value={`${HF.models} / ${HF.datasets} / ${HF.spaces}`} label="MEASURED" />
              <Metric fact="Public joblib/pickle model repos" value={String(HF.joblib_still_present)} label="MEASURED" />
              <Metric fact="Authenticated Hugging Face CLI" value={HF.hf_cli} label="UNAVAILABLE" />
              <Metric fact="Paying customers / ARR" value="not published" label="UNAVAILABLE" />
              <Metric fact="Λ uniqueness" value="Conjecture 1" label="CONJECTURE" />
              <Metric fact="WILLAY / KHIPU-R3 / Waman jobs" value="registry REJECTED_WITH_REASON" label="ROADMAP" />
              <Metric fact="Production DSSE on this surface" value="WEBCRYPTO_HMAC_DEMO only" label="DEMO" />
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <Panel title="Security posture">
          <ul className="space-y-2">
            <li>No administrator bypass, force-push, or branch-protection removal in this run.</li>
            <li>Public serving identity must not mutate evidence. Negative Hub test is still UNAVAILABLE without HF auth.</li>
            <li>Eight Hub model repos had model.joblib removed via exact-parent discussion merge (workflow 33202953171). Live tree readback remaining_joblib=0. They are software kernels, not new trained models.</li>
            <li>Denied security APIs stay UNAVAILABLE. They are not recorded as zero.</li>
          </ul>
        </Panel>
        <Panel title="Formal and model truth">
          <ul className="space-y-2">
            <li>Λ uniqueness remains Conjecture 1 unless a new machine-checked artifact lands.</li>
            <li>SZL-Forge-1.5B-ReceiptAgent: trained, measured-limited, proposal-only.</li>
            <li>SZL-Khipu-1.5B: research-only; high-stakes use prohibited.</li>
            <li>A receipt proves integrity of the recorded statement, not correctness of every underlying fact.</li>
          </ul>
        </Panel>
      </section>

      <section className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Residual blockers</p>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {OPEN_PR_SUMMARY.filter((p) =>
            (["BLOCKED", "HOLD", "BLOCKED_EXTERNAL_AUTHORITY", "BEHIND", "PENDING_CHECKS"] as readonly string[]).includes(
              p.merge,
            ),
          ).map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
              <span className="font-mono text-sm">{p.id}</span>
              <span className="text-sm text-mute">{p.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Competitor research — transferable principles only</p>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          Public official documentation. No copied branding, assets, or long passages. SZL implements original
          capabilities against these principles.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-ink-2 font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Principle</th>
                <th className="px-4 py-3">SZL implementation</th>
              </tr>
            </thead>
            <tbody>
              {COMPETITOR_PRINCIPLES.map((row) => (
                <tr key={row.name} className="border-t border-line align-top">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-mute">{row.principle}</td>
                  <td className="px-4 py-3">{row.szl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/command">Run policy demo</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/registry">Open the registry</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/contribute">Contributor machine</Link>
        </Button>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-xl border border-line bg-ink-2 p-5">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-mute">{children}</div>
    </article>
  );
}

function Metric({
  fact,
  value,
  label,
}: {
  fact: string;
  value: string;
  label: "MEASURED" | "UNAVAILABLE" | "CONJECTURE" | "ROADMAP" | "DEMO";
}) {
  return (
    <tr className="border-t border-line">
      <td className="px-4 py-3">{fact}</td>
      <td className="px-4 py-3 font-mono text-[12px]">{value}</td>
      <td className="px-4 py-3">
        <ClaimChip kind={label} />
      </td>
    </tr>
  );
}
