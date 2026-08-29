import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClaimChip } from "@/components/claim-chip";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GITHUB, HF, OPEN_PR_SUMMARY } from "@/lib/census";
import { ORIGINS, PUBLISH_CAPTURED_AT, RECOMMENDATION } from "@/lib/publish";

export const Route = createFileRoute("/publish")({ component: Publish });

type Gate = {
  id: string;
  title: string;
  draft: boolean;
  mergeable: string;
  mergeState: string;
  hold_text: boolean;
  checks: { success: number; failed: string[]; pending_n: number; total: number };
  url: string;
};

function toneFor(state: string, draft: boolean, hold: boolean): "allow" | "deny" | "hold" | "mute" | "steel" {
  if (state === "CLEAN" && !draft && !hold) return "steel";
  if (state === "BLOCKED" || state === "DIRTY") return "deny";
  if (draft || hold || state === "UNSTABLE") return "hold";
  return "mute";
}

export function Publish() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/pr-gates.json")
      .then((r) => {
        if (!r.ok) throw new Error(`gates ${r.status}`);
        return r.json() as Promise<Gate[]>;
      })
      .then(setGates)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "gates unavailable"));
  }, []);

  const mergeQualified = gates.filter((g) => !g.draft && !g.hold_text && g.mergeState === "CLEAN" && g.checks.failed.length === 0);
  const merged = OPEN_PR_SUMMARY.filter((p) => p.merge.includes("MERGED"));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker={`Recapture ${PUBLISH_CAPTURED_AT}`}
        title="Origins. Not four products."
        lede={RECOMMENDATION.verdict}
        claims={["DEMO", "MEASURED"]}
      />

      <section className="mt-10 grid gap-3 lg:grid-cols-2">
        {ORIGINS.map((origin) => (
          <article key={origin.host} className="rounded-xl border border-line bg-ink-2 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={origin.status === "LIVE" ? "allow" : origin.status === "FOREIGN" ? "deny" : "hold"}>
                {origin.status.replaceAll("_", " ")}
              </Badge>
              <ClaimChip kind={origin.claim} />
            </div>
            <h2 className="mt-3 font-display text-2xl">{origin.host}</h2>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-steel">{origin.role}</p>
            <p className="mt-3 text-sm leading-relaxed text-mute">{origin.note}</p>
            {origin.href.startsWith("http") ? (
              <a className="mt-4 inline-flex min-h-11 items-center font-mono text-[11px] text-steel hover:text-bone" href={origin.href} target="_blank" rel="noreferrer">
                Open origin
              </a>
            ) : (
              <Link className="mt-4 inline-flex min-h-11 items-center font-mono text-[11px] text-steel hover:text-bone" to="/">
                You are here
              </Link>
            )}
          </article>
        ))}
      </section>

      <section className="mt-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Recommendation</p>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {RECOMMENDATION.keep_separate.map((line) => (
            <li key={line} className="py-3 text-sm text-bone">{line}</li>
          ))}
          {RECOMMENDATION.never.map((line) => (
            <li key={line} className="py-3 text-sm text-mute">{line}</li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">GitHub merge board</p>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          Live recapture: {GITHUB.open_prs} open, {GITHUB.merge_qualified} merge-qualified, {merged.length} already on protected main this cycle.
          Conservative gates still hold: no HOLD, no draft, no dirty, no failed checks, no --admin.
        </p>
        <div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
          <Stat label="Open PRs" value={GITHUB.open_prs} />
          <Stat label="Merge-qualified" value={mergeQualified.length} />
          <Stat label="HF models" value={HF.models} />
          <Stat label="Joblib remaining" value={HF.joblib_still_present} />
        </div>
        {error && <p className="mt-4 text-sm text-deny">{error}</p>}
        <div className="mt-6 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-ink-2 font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
              <tr>
                <th className="px-4 py-3">PR</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Checks</th>
                <th className="px-4 py-3">Why it is not merged</th>
              </tr>
            </thead>
            <tbody>
              {gates.map((g) => {
                const why = g.draft
                  ? "Draft"
                  : g.hold_text
                    ? "HOLD / do-not-merge in body"
                    : g.mergeState === "DIRTY"
                      ? "Conflicts with current main"
                      : g.checks.failed.length
                        ? g.checks.failed[0]
                        : g.mergeState === "BLOCKED"
                          ? "Ruleset blocked"
                          : g.mergeState === "CLEAN"
                            ? "CLEAN but path-collision or extra-approval"
                            : g.mergeState;
                return (
                  <tr key={g.id} className="border-t border-line align-top">
                    <td className="px-4 py-3">
                      <a className="font-mono text-sm text-steel hover:text-bone" href={g.url} target="_blank" rel="noreferrer">
                        {g.id}
                      </a>
                      <p className="mt-1 max-w-sm text-xs text-mute">{g.title}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={toneFor(g.mergeState, g.draft, g.hold_text)}>{g.mergeState}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums">
                      {g.checks.success}/{g.checks.total}
                      {g.checks.failed.length ? ` fail ${g.checks.failed.length}` : ""}
                    </td>
                    <td className="px-4 py-3 text-mute">{why}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 flex flex-wrap gap-3">
        <Button asChild>
          <a href="https://a11oy.net" target="_blank" rel="noreferrer">Open proof registry</a>
        </Button>
        <Button asChild variant="secondary">
          <a href="https://a-11-oy.com" target="_blank" rel="noreferrer">Open product</a>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/registry">Measured registry on this lab</Link>
        </Button>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-ink-2 px-5 py-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums text-bone">{value}</p>
    </div>
  );
}
