import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Hologram } from "@/components/hologram";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GENOME, LOCKED_FORMULAS, formulaById, type GenomeStatus } from "@/lib/formulas";

export const Route = createFileRoute("/formulas")({ component: Formulas });

const STATUS_TONE: Record<GenomeStatus, "allow" | "deny" | "hold" | "mute"> = {
  PROVED: "allow",
  SORRY: "deny",
  CONJ: "mute",
  SKELETON: "hold",
};

export function Formulas() {
  const [selectedId, setSelectedId] = useState(LOCKED_FORMULAS[0].id);
  const selected = formulaById(selectedId) ?? LOCKED_FORMULAS[0];
  const counts = useMemo(() => {
    return GENOME.reduce(
      (acc, row) => {
        acc[row.status] += 1;
        return acc;
      },
      { PROVED: 0, SORRY: 0, CONJ: 0, SKELETON: 0 } as Record<GenomeStatus, number>,
    );
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker="Locked-8 gate · 23-row genome"
        title="Formulas are organs, not slides."
        lede="The body gates on eight locked IDs. a-11-oy.com/formulas recomputes a 23-row genome. This lab replays the silhouettes that actually fail-close. Λ uniqueness stays Conjecture 1."
        claims={["DEMO", "MEASURED", "CONJECTURE"]}
      />

      <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Stat label="Locked-8 gate" value="8" note="body silhouettes" />
        <Stat label="PROVED rows" value={String(counts.PROVED)} note="product genome" />
        <Stat label="CONJ / SORRY" value={String(counts.CONJ + counts.SORRY)} note="never theorem-green" />
        <Stat label="SKELETON" value={String(counts.SKELETON)} note="named, not claimed live" />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Hologram
          title="Formula spine"
          activeFormula={selected.id}
          activeOrgan={selected.organ.toLowerCase() as "brain" | "heart" | "circulatory" | "nervous" | "skeleton"}
          caption={`${selected.id} ${selected.name} · ${selected.quechua} · product row ${selected.productName}`}
        />
        <article className="rounded-xl border border-line bg-ink-2 p-5">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">Honesty</p>
          <ul className="mt-4 space-y-3 text-sm text-mute">
            <li>
              <span className="text-bone">MEASURED on product.</span> a-11-oy.com/formulas lists 23
              FormulaAgents. locked_formula_count=8.
            </li>
            <li>
              <span className="text-bone">DEMO here.</span> Silhouettes use the same fail-closed
              rules. Not a live Lean kernel.
            </li>
            <li>
              <span className="text-bone">F11 is CONJECTURE.</span> A1–A4 CHECKED. Uniqueness OPEN.
            </li>
            <li>
              <span className="text-bone">F12 energy UNAVAILABLE.</span> Never a fabricated joule.
            </li>
          </ul>
          <div className="mt-6">
            <Button asChild variant="secondary">
              <Link to="/command">Run them on a proposal</Link>
            </Button>
          </div>
        </article>
      </div>

      <section className="mt-10">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-mute">Locked-8 kernel</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-ink-2 font-mono text-xs uppercase tracking-[0.12em] text-mute">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Gate name</th>
                <th className="px-4 py-3">Organ</th>
                <th className="px-4 py-3">Lean</th>
                <th className="px-4 py-3">Product row</th>
              </tr>
            </thead>
            <tbody>
              {LOCKED_FORMULAS.map((f) => (
                <tr
                  key={f.id}
                  className={f.id === selected.id ? "border-t border-line bg-ink-3" : "border-t border-line"}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="font-mono text-bone underline-offset-4 hover:underline"
                      onClick={() => setSelectedId(f.id)}
                    >
                      {f.id}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-bone">{f.name}</p>
                    <p className="mt-1 text-mute">{f.meaning}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-steel">
                    {f.organ}
                    <span className="mt-1 block text-mute">{f.quechua}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={f.lean === "CHECKED" ? "allow" : f.lean === "UNAVAILABLE" ? "deny" : "hold"}>
                      {f.lean}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-mute">{f.productName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-mute">Product genome F1–F23</p>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          Copied from a-11-oy.com/formulas. Locked IDs gate this demo. Non-locked rows stay named and
          unlabeled as live.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-ink-2 font-mono text-xs uppercase tracking-[0.12em] text-mute">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Formula</th>
                <th className="px-4 py-3">Organ</th>
                <th className="px-4 py-3">Proof</th>
                <th className="px-4 py-3">Gate</th>
              </tr>
            </thead>
            <tbody>
              {GENOME.map((row) => (
                <tr key={row.id} className={row.locked ? "border-t border-line bg-ink-2" : "border-t border-line"}>
                  <td className="px-4 py-3 font-mono text-bone">{row.id}</td>
                  <td className="px-4 py-3 text-bone">{row.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-mute">{row.organ}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-steel">{row.locked ? "locked-8" : "named"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-ink-2 px-5 py-6">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums text-bone">{value}</p>
      <p className="mt-2 text-xs text-faint">{note}</p>
    </div>
  );
}
