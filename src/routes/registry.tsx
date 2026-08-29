import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ClaimChip } from "@/components/claim-chip";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { CANONICAL_ENTRIES, CAPTURED_AT, CATEGORY, GITHUB, HF } from "@/lib/census";

export const Route = createFileRoute("/registry")({ component: Registry });

type Repo = {
  name: string;
  full_name: string;
  private: boolean;
  archived: boolean;
  description: string | null;
  artifact_class: string;
  lifecycle: string;
  canonical_entry: boolean;
  product_family: string;
  license_spdx: string | null;
  pushed_at: string | null;
  head_sha?: string | null;
};

type EstateFile = {
  captured_at: string;
  schema: string;
  counts: { org: number; public: number; private: number; archived: number; founder: number; open_prs: number };
  repositories: Repo[];
  portfolio_taxonomy: { products: string[]; canonical_entries: string[]; rule: string; category_sentence: string };
};

const CLASSES = [
  "ALL",
  "PRODUCT_RUNTIME",
  "SOFTWARE_KERNEL",
  "MODEL_BUILD_SERVE",
  "RESEARCH_FORMAL",
  "DOCS_PROOF_PRESENTATION",
  "SHOWCASE_RUNTIME",
  "COMPONENT",
  "PRIVATE_OPERATIONS",
  "ARCHIVE",
  "FOUNDER_SURFACE",
] as const;

export function Registry() {
  const [estate, setEstate] = useState<EstateFile | null>(null);
  const [filter, setFilter] = useState<(typeof CLASSES)[number]>("ALL");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/estate.json")
      .then((r) => {
        if (!r.ok) throw new Error(`estate ${r.status}`);
        return r.json() as Promise<EstateFile>;
      })
      .then(setEstate)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "registry unavailable"));
  }, []);

  const rows = estate?.repositories ?? [];
  const visible = filter === "ALL" ? rows : rows.filter((r) => r.artifact_class === filter);
  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.artifact_class] = (counts[row.artifact_class] ?? 0) + 1;
    return counts;
  }, [rows]);
  const canonical = rows.filter((r) => r.canonical_entry);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker={`Registry ${estate?.captured_at ?? CAPTURED_AT}`}
        title="Estate object model"
        lede={estate?.portfolio_taxonomy.category_sentence ?? CATEGORY}
        claims={["MEASURED"]}
      />

      <section className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5">
        <Stat label="Org repos" value={estate?.counts.org ?? GITHUB.org} />
        <Stat label="Public" value={estate?.counts.public ?? GITHUB.public} />
        <Stat label="Private" value={estate?.counts.private ?? GITHUB.private} />
        <Stat label="Archived" value={estate?.counts.archived ?? GITHUB.archived} />
        <Stat label="Open PRs" value={estate?.counts.open_prs ?? GITHUB.open_prs} />
      </section>

      <section className="mt-6 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <HubStat label="HF models" value={HF.models} />
        <HubStat label="HF datasets" value={HF.datasets} />
        <HubStat label="HF spaces" value={HF.spaces} />
        <HubStat label="Joblib remaining" value={HF.joblib_still_present} />
      </section>
      <p className="mt-3 text-sm text-mute">
        Hub CLI write is {HF.hf_cli}. Public listing is MEASURED. Training stays fail-closed. Newest GitHub
        addition versus the 63-repo anchor includes {GITHUB.additions[GITHUB.additions.length - 1]}.
      </p>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">Canonical entries — investor doors</p>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {(canonical.length ? canonical : CANONICAL_ENTRIES.map((e) => ({ name: e.name, description: e.role, full_name: `szl-holdings/${e.name}`, artifact_class: "PRODUCT_RUNTIME" }))).map(
              (entry) => (
                <li key={entry.name} className="flex items-baseline justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">{entry.name}</p>
                    <p className="text-sm text-mute">{entry.description || "Canonical entry"}</p>
                  </div>
                  <span className="font-mono text-xs text-steel">{entry.artifact_class}</span>
                </li>
              ),
            )}
          </ul>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">Generated class totals</p>
          <ul className="mt-4 space-y-2">
            {Object.entries(classCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([klass, n]) => (
                <li key={klass} className="flex items-center justify-between rounded-lg border border-line px-4 py-2">
                  <span className="font-mono text-xs text-steel">{klass.replaceAll("_", " ")}</span>
                  <span className="font-display text-2xl tabular-nums">{n}</span>
                </li>
              ))}
          </ul>
          <p className="mt-4 text-sm text-mute">{estate?.portfolio_taxonomy.rule}</p>
        </div>
      </section>

      <section className="mt-10">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">Filter by artifact class</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CLASSES.map((klass) => (
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
        {error && <p className="mt-4 text-sm text-deny">{error}</p>}
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-ink-2 font-mono text-xs uppercase tracking-[0.12em] text-mute">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Lifecycle</th>
                <th className="px-4 py-3">Family</th>
                <th className="px-4 py-3">License</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.full_name} className="border-t border-line">
                  <td className="px-4 py-3">
                    <a className="hover:text-steel" href={`https://github.com/${row.full_name}`} target="_blank" rel="noreferrer">
                      {row.name}
                    </a>
                    {row.canonical_entry ? (
                      <Badge tone="allow" className="ml-2">
                        entry
                      </Badge>
                    ) : null}
                    {row.description ? <p className="max-w-md text-xs text-mute">{row.description}</p> : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-steel">{row.artifact_class}</td>
                  <td className="px-4 py-3 text-mute">{row.lifecycle}</td>
                  <td className="px-4 py-3 text-mute">{row.product_family}</td>
                  <td className="px-4 py-3 font-mono text-xs text-mute">{row.license_spdx ?? "UNRESOLVED"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-8 text-sm text-mute">
        Schema {estate?.schema ?? "szl.estate.registry/v2"}. Public snapshot on{" "}
        <a href="https://a11oy.net/estate/" className="text-steel hover:text-bone" target="_blank" rel="noreferrer">
          a11oy.net/estate
        </a>
        . Hub classes on{" "}
        <Link to="/hub" className="text-steel hover:text-bone">
          /hub
        </Link>
        . Pull-request graph on{" "}
        <Link to="/graph" className="text-steel hover:text-bone">
          /graph
        </Link>
        .
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-ink px-5 py-6">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums">{value}</p>
      <ClaimChip kind="MEASURED" />
    </div>
  );
}

function HubStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-ink px-5 py-6">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums">{value}</p>
      <ClaimChip kind="MEASURED" />
    </div>
  );
}
