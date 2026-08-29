import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { CAPTURED_AT, GITHUB, OPEN_PR_SUMMARY } from "@/lib/census";

export const Route = createFileRoute("/graph")({ component: Graph });

type Node = {
  id: string;
  classification: string;
  eligible: boolean;
  blockers: string[];
  title?: string;
  merge_state?: string;
  draft?: boolean;
};

type Edge = { from: string; to: string; type: string };

type Dag = { captured_at: string; nodes: Node[]; edges: Edge[] };

type Pr = {
  key: string;
  title: string;
  url: string;
  classification: string;
  merge_state: string;
  draft: boolean;
  blockers: string[];
  dependencies: string[];
  collisions?: string[];
  head_sha: string;
};

function toneFor(classification: string): "allow" | "deny" | "hold" | "mute" | "steel" {
  if (classification.includes("READY") || classification.includes("MERGED")) return "allow";
  if (classification.includes("HOLD") || classification.includes("RED")) return "deny";
  if (classification.includes("DRAFT") || classification.includes("WAITING")) return "hold";
  if (classification.includes("CANDIDATE")) return "steel";
  return "mute";
}

export function Graph() {
  const [dag, setDag] = useState<Dag | null>(null);
  const [prs, setPrs] = useState<Pr[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/pr_dag.json").then((r) => {
        if (!r.ok) throw new Error(`dag ${r.status}`);
        return r.json() as Promise<Dag>;
      }),
      fetch("/data/pr_inventory.json").then((r) => {
        if (!r.ok) throw new Error(`prs ${r.status}`);
        return r.json() as Promise<Pr[]>;
      }),
    ])
      .then(([d, p]) => {
        setDag(d);
        setPrs(p);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "graph unavailable"));
  }, []);

  const groups = useMemo(() => {
    const map: Record<string, Node[]> = {};
    for (const node of dag?.nodes ?? []) {
      (map[node.classification] ??= []).push(node);
    }
    return map;
  }, [dag]);

  const focused = prs.find((p) => p.key === focus) ?? null;
  const eligible = (dag?.nodes ?? []).filter((n) => n.eligible).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker={`PR graph ${dag?.captured_at ?? CAPTURED_AT}`}
        title="Convergence graph"
        lede={`${GITHUB.open_prs} open pull requests. ${eligible} merge-qualified under the conservative gate. HOLD, do-not-merge, and intentionally red lanes stay closed. No administrator bypass.`}
        claims={["MEASURED"]}
      />

      <section className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Stat label="Open" value={GITHUB.open_prs} />
        <Stat label="Qualified" value={eligible} />
        <Stat label="Edges" value={dag?.edges.length ?? 0} />
        <Stat label="Hold / red" value={(dag?.nodes ?? []).filter((n) => n.classification.includes("HOLD")).length} />
      </section>

      {error && <p className="mt-4 text-sm text-deny">{error}</p>}

      <section className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Threads by class</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {Object.entries(groups).map(([klass, nodes]) => (
            <article key={klass} className="rounded-xl border border-line bg-ink-2 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl">{klass.replaceAll("_", " ").toLowerCase()}</h2>
                <Badge tone={toneFor(klass)}>{nodes.length}</Badge>
              </div>
              <ul className="mt-3 space-y-2">
                {nodes.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => setFocus(node.id)}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-line px-3 text-left text-sm hover:bg-ink"
                    >
                      <span className="font-mono text-[12px]">{node.id.replace("szl-holdings/", "")}</span>
                      <span className="font-mono text-[11px] text-mute">{node.merge_state}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {focused && (
        <section className="mt-8 rounded-xl border border-line p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Selected thread</p>
          <h2 className="mt-2 font-display text-3xl">{focused.key.replace("szl-holdings/", "")}</h2>
          <p className="mt-2 text-mute">{focused.title}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={toneFor(focused.classification)}>{focused.classification}</Badge>
            <Badge>{focused.merge_state}</Badge>
            {focused.draft ? <Badge tone="hold">draft</Badge> : null}
          </div>
          <p className="mt-4 font-mono text-[11px] text-steel">head {focused.head_sha}</p>
          {focused.blockers.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {focused.blockers.map((b) => (
                <li key={b}>
                  <Badge tone="deny">{b}</Badge>
                </li>
              ))}
            </ul>
          )}
          {focused.dependencies.length > 0 && (
            <p className="mt-3 text-sm text-mute">Depends on {focused.dependencies.join(", ")}</p>
          )}
          <a className="mt-4 inline-flex min-h-11 items-center text-sm text-steel hover:text-bone" href={focused.url} target="_blank" rel="noreferrer">
            Open on GitHub
          </a>
        </section>
      )}

      <section className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Dependency and collision edges</p>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {(dag?.edges ?? []).map((edge) => (
            <li key={`${edge.from}-${edge.to}-${edge.type}`} className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-sm">
              <span className="font-mono text-[12px]">
                {edge.from.replace("szl-holdings/", "")} → {edge.to.replace("szl-holdings/", "")}
              </span>
              <Badge tone={edge.type.includes("collision") ? "deny" : "hold"}>{edge.type.replaceAll("_", " ")}</Badge>
            </li>
          ))}
          {(dag?.edges ?? []).length === 0 && <li className="py-3 text-sm text-mute">No typed edges in this recapture.</li>}
        </ul>
      </section>

      <section className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Recently closed on protected main</p>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {OPEN_PR_SUMMARY.filter((p) => p.merge === "MERGED_AND_VERIFIED" || p.merge === "SUPERSEDED").map(
            (p) => (
              <li key={p.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm">{p.id}</p>
                  <Badge tone="allow">{p.merge}</Badge>
                </div>
                <p className="mt-1 text-sm text-mute">{p.note}</p>
              </li>
            ),
          )}
        </ul>
      </section>

      <p className="mt-8 text-sm text-mute">
        Training stays fail-closed on{" "}
        <Link to="/hub" className="text-steel hover:text-bone">
          /hub
        </Link>
        . Lifecycle plane on{" "}
        <Link to="/lifecycle" className="text-steel hover:text-bone">
          /lifecycle
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
    </div>
  );
}
