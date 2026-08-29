import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ClaimChip } from "@/components/claim-chip";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { CAPTURED_AT, HF, HF_CLASS } from "@/lib/census";

export const Route = createFileRoute("/hub")({ component: Hub });

type Asset = {
  repo_id: string;
  repo_type: string;
  artifact_class: string;
  revision: string | null;
  weight_files?: string[];
  executable_serialization?: string[];
  risks?: string[];
  pipeline?: string | null;
};

type Portfolio = {
  counts: {
    captured_at?: string;
    models?: number;
    datasets?: number;
    spaces?: number;
    collections?: number;
    artifact_classes?: Record<string, number>;
    executable_serialization_remaining?: string[];
    state?: string;
  };
  assets: Asset[];
};

type Training = {
  default_state: string;
  submit_this_run: boolean;
  candidates: Array<{
    id: string;
    priority: number;
    artifact_class: string;
    approved: boolean;
    rights_status: string;
    notes: string;
    state: string;
    blockers: string[];
  }>;
};

type KernelWalk = {
  live_count?: number;
  blocked?: boolean;
  energy?: string;
  conjecture_1?: string;
  proven_trust?: boolean;
  reason?: string;
  sha256?: string;
  head?: string;
  organs?: Array<{ name: string; status: string; honesty: string }>;
  locked_formulas?: Array<{ id: string; ok: boolean; proof_status: string }>;
};

const FLAGSHIPS = [
  { id: "SZLHOLDINGS/a11oy", role: "Product command", href: "https://huggingface.co/spaces/SZLHOLDINGS/a11oy" },
  { id: "SZLHOLDINGS/killinchu", role: "Bounded vertical", href: "https://huggingface.co/spaces/SZLHOLDINGS/killinchu" },
  { id: "SZLHOLDINGS/szl-atelier", role: "Forty-model walk", href: "https://huggingface.co/spaces/SZLHOLDINGS/szl-atelier" },
  { id: "SZLHOLDINGS/szl-khipu", role: "Python kernels", href: "https://huggingface.co/spaces/SZLHOLDINGS/szl-khipu" },
  { id: "SZLHOLDINGS/anatomy", role: "Living body", href: "https://huggingface.co/spaces/SZLHOLDINGS/anatomy" },
  { id: "SZLHOLDINGS/immune", role: "Defense matrix", href: "https://huggingface.co/spaces/SZLHOLDINGS/immune" },
] as const;

const PUBLISHERS = [
  { name: "immune deploy-hf-space", state: "success" as const, note: "Write-scoped HF_TOKEN proved. DEMO operator, not an ATO." },
  { name: "immune#57 Mirror khipu Hub", state: "success" as const, note: "Run 33254164465. Write token authenticated. Hub already matched GitHub — empty commits skipped. Not a fabricated republish." },
  { name: "szl-atelier#4 sidecar", state: "blocked" as const, note: "Merged. Job skipped: atelier token UNAVAILABLE this run." },
  { name: "szl-khipu publish-hf", state: "blocked" as const, note: "Repo secret still unset. GitHub remains source. Immune sidecar is the write path that actually ran." },
] as const;

const MODEL_CLASSES = [
  "ALL",
  "TRAINED_ADAPTER",
  "QUANTIZED_DERIVATIVE",
  "TRAINED_OR_CONVERTED_WEIGHTS_REQUIRES_RECEIPT",
  "SOFTWARE_KERNEL_CARD",
  "CARD_ONLY_ROADMAP",
  "EXECUTABLE_SERIALIZATION_QUARANTINE",
] as const;

export function Hub() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [training, setTraining] = useState<Training | null>(null);
  const [walk, setWalk] = useState<KernelWalk | null>(null);
  const [filter, setFilter] = useState<(typeof MODEL_CLASSES)[number]>("ALL");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/hf_portfolio.json").then((r) => {
        if (!r.ok) throw new Error(`hub ${r.status}`);
        return r.json() as Promise<Portfolio>;
      }),
      fetch("/data/training-registry.json").then((r) => {
        if (!r.ok) throw new Error(`training ${r.status}`);
        return r.json() as Promise<Training>;
      }),
      fetch("/data/python-kernel-walk.json").then((r) => (r.ok ? (r.json() as Promise<KernelWalk>) : null)),
    ])
      .then(([p, t, w]) => {
        setPortfolio(p);
        setTraining(t);
        setWalk(w);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "hub unavailable"));
  }, []);

  const models = (portfolio?.assets ?? []).filter((a) => a.repo_type === "model");
  const visible = filter === "ALL" ? models : models.filter((m) => m.artifact_class === filter);
  const classes = portfolio?.counts.artifact_classes ?? HF.artifact_classes;
  const remainingUnsafe = portfolio?.counts.executable_serialization_remaining ?? [];

  const classList = useMemo(() => Object.entries(classes).sort((a, b) => b[1] - a[1]), [classes]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker={`SZLHOLDINGS · ${CAPTURED_AT}`}
        title="The Hub is already the showcase."
        lede="szl-holdings is Python for kernels, Lean for proofs, TypeScript for product chrome. Recoding Lean or a11oy into Python would destroy the proof surface. SZLHOLDINGS is LIVE. This lab is not a fourth origin."
        claims={["MEASURED", "UNAVAILABLE"]}
      />

      <section className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Stat label="Models" value={portfolio?.counts.models ?? HF.models} />
        <Stat label="Datasets" value={portfolio?.counts.datasets ?? HF.datasets} />
        <Stat label="Spaces" value={portfolio?.counts.spaces ?? HF.spaces} />
        <Stat label="Collections" value={portfolio?.counts.collections ?? HF.collections} />
      </section>

      {error && <p className="mt-4 text-sm text-deny">{error}</p>}

      <section className="mt-8">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-mute">Flagship Spaces</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FLAGSHIPS.map((space) => (
            <a
              key={space.id}
              href={space.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-line bg-ink-2 px-4 py-4 hover:border-steel/40"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-mute">{space.role}</p>
              <p className="mt-1 font-display text-xl text-bone">{space.id.replace("SZLHOLDINGS/", "")}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-line bg-ink-2 p-5">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">Python kernel walk · szl-khipu</p>
          <p className="mt-3 font-display text-2xl text-bone">
            {walk ? `${walk.live_count ?? "—"}/5 LIVE · ${walk.reason ?? "Evaluating"}` : "Loading kernel walk"}
          </p>
          <p className="mt-2 text-sm text-mute">
            Locked-8 ran STRUCTURAL, not Lean PROVEN. Energy {walk?.energy ?? "UNAVAILABLE"}. Λ uniqueness{" "}
            {walk?.conjecture_1 ?? "OPEN"}. proven_trust stays {String(walk?.proven_trust ?? false)}.
          </p>
          <ul className="mt-4 flex flex-wrap gap-1">
            {(walk?.locked_formulas ?? []).map((row) => (
              <li key={row.id}>
                <Badge tone={row.proof_status === "STRUCTURAL" ? "hold" : "allow"}>
                  {row.id} {row.proof_status}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-[11px] text-faint">head {walk?.head?.slice(0, 12) ?? "UNAVAILABLE"}</p>
        </article>
        <article className="rounded-xl border border-line bg-ink-2 p-5">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">Canonical publisher this recapture</p>
          <ul className="mt-4 space-y-3">
            {PUBLISHERS.map((row) => (
              <li key={row.name}>
                <Badge tone={row.state === "success" ? "allow" : "deny"}>{row.state}</Badge>
                <p className="mt-1 text-sm text-bone">{row.name}</p>
                <p className="text-sm text-mute">{row.note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-hold">
            Bind HF_ORG_TOKEN on szl-khipu if that mirror must republish. Do not paste the value here.
          </p>
        </article>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        {classList.map(([klass, n]) => (
          <article key={klass} className="flex items-center justify-between rounded-xl border border-line px-5 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-steel">{klass.replaceAll("_", " ")}</p>
            <p className="font-display text-3xl tabular-nums">{n}</p>
          </article>
        ))}
      </section>

      <section className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-allow">Joblib quarantined — remaining {remainingUnsafe.length}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {HF_CLASS.QUARANTINED_JOBLIB_REMOVED.map((name) => (
            <li key={name}>
              <Badge tone="allow">{name}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-mute">
          Exact-parent discussion merge via a11oy workflow 33202953171. These are software kernels, not new
          trained weights. Safe republish (ONNX / SafeTensors) is a separate lane.
        </p>
      </section>

      <section className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Model-namespace filter</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MODEL_CLASSES.map((klass) => (
            <button
              key={klass}
              type="button"
              onClick={() => setFilter(klass)}
              className={
                filter === klass
                  ? "min-h-11 rounded-md border border-bone/30 bg-ink-2 px-3 text-sm"
                  : "min-h-11 rounded-md border border-line px-3 text-sm text-mute hover:text-bone"
              }
            >
              {klass.replaceAll("_", " ")}
            </button>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-ink-2 font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Revision</th>
                <th className="px-4 py-3">Weights</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.repo_id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <a className="hover:text-steel" href={`https://huggingface.co/${row.repo_id}`} target="_blank" rel="noreferrer">
                      {row.repo_id.replace("SZLHOLDINGS/", "")}
                    </a>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-steel">{row.artifact_class}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-mute">{row.revision?.slice(0, 12) ?? "UNAVAILABLE"}</td>
                  <td className="px-4 py-3 tabular-nums text-mute">{row.weight_files?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Training registry</p>
          <ClaimChip kind="ROADMAP" />
        </div>
        <p className="mt-3 max-w-2xl text-mute">
          Default state {training?.default_state ?? "NOT_APPROVED"}. Submit this run:{" "}
          {String(training?.submit_this_run ?? false)}. WILLAY, KHIPU-R3, and Waman stay rejected until rights,
          exact revisions, image digest, cost cap, and job command are bound.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(training?.candidates ?? []).map((c) => (
            <article key={c.id} className="rounded-xl border border-line p-5">
              <Badge tone="deny">{c.state}</Badge>
              <h3 className="mt-3 font-display text-2xl">{c.id}</h3>
              <p className="mt-1 font-mono text-[11px] text-steel">priority {c.priority}</p>
              <p className="mt-3 text-sm text-mute">{c.notes}</p>
              <ul className="mt-3 flex flex-wrap gap-1">
                {c.blockers.slice(0, 4).map((b) => (
                  <li key={b}>
                    <Badge tone="hold">{b}</Badge>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <p className="mt-8 text-sm text-mute">
        A11OY-MINI is a quantized derivative once GGUF files exist — not a training run. KHIPU-R2 remains
        research evidence. See{" "}
        <Link to="/diligence" className="text-steel hover:text-bone">
          the room
        </Link>
        .
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-ink px-5 py-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums">{value}</p>
      <ClaimChip kind="MEASURED" />
    </div>
  );
}
