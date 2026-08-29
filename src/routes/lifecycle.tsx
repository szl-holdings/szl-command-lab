import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GITHUB, HF } from "@/lib/census";
import { LIFECYCLE } from "@/lib/lifecycle";

export const Route = createFileRoute("/lifecycle")({ component: Lifecycle });

const TONE: Record<(typeof LIFECYCLE)[number]["evidence"], "allow" | "hold" | "deny" | "mute" | "steel"> = {
  MEASURED: "allow",
  DEMO: "hold",
  ROADMAP: "mute",
  UNAVAILABLE: "deny",
  BLOCKED: "deny",
};

export function Lifecycle() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker="Agent lifecycle plane"
        title="One plane, eight stages."
        lede="Build, test, deploy, observe, approve, and retire are not disconnected demos. Each stage binds an identity: source SHA, Hub revision, or an honest UNAVAILABLE."
        claims={["MEASURED", "DEMO"]}
      />

      <section className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Mini label="a11oy main" value={GITHUB.a11oy_main.slice(0, 12)} />
        <Mini label="Open PRs" value={String(GITHUB.open_prs)} />
        <Mini label="HF models" value={String(HF.models)} />
        <Mini label="Joblib left" value={String(HF.joblib_still_present)} />
      </section>

      <ol className="mt-10 grid gap-3">
        {LIFECYCLE.map((stage, idx) => (
          <li key={stage.id} className="rounded-xl border border-line bg-ink-2 p-5 sm:grid sm:grid-cols-[8rem_1fr] sm:gap-6">
            <p className="font-mono text-[11px] text-steel">
              {String(idx + 1).padStart(2, "0")} · {stage.id}
            </p>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl">{stage.title}</h2>
                <Badge tone={TONE[stage.evidence]}>{stage.evidence}</Badge>
              </div>
              <p className="mt-2 text-sm text-mute">{stage.contract}</p>
              <p className="mt-2 text-sm text-bone">{stage.current}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-line p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Stable identity</p>
          <h3 className="mt-2 font-display text-2xl">Source first</h3>
          <p className="mt-2 text-sm text-mute">
            GitHub is canonical. Hub is a published projection. A Space that is reachable is not LIVE until
            source, digest, and readback agree.
          </p>
        </article>
        <article className="rounded-xl border border-line p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Release gate</p>
          <h3 className="mt-2 font-display text-2xl">Eval blocks merge</h3>
          <p className="mt-2 text-sm text-mute">
            Intentionally red smoke stays red. Thresholds are not lowered after seeing results. Train loss
            is not an evaluation.
          </p>
        </article>
        <article className="rounded-xl border border-line p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Retire with evidence</p>
          <h3 className="mt-2 font-display text-2xl">Keep the failure</h3>
          <p className="mt-2 text-sm text-mute">
            KHIPU-R2 remains immutable research. Joblib kernels were quarantined, not relabeled as new
            models. Archives name a successor.
          </p>
        </article>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/trajectory">Walk a trajectory</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/graph">Open the PR graph</Link>
        </Button>
      </div>
    </main>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink px-5 py-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">{label}</p>
      <p className="mt-2 font-mono text-lg text-bone">{value}</p>
    </div>
  );
}
