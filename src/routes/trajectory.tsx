import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClaimChip } from "@/components/claim-chip";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { objectsFor, OBJECT_ORDER, type ObjectKind } from "@/lib/ontology";
import { evaluatePolicy, SCENARIOS } from "@/lib/policy";

export const Route = createFileRoute("/trajectory")({ component: Trajectory });

const KIND_NOTE: Record<ObjectKind, string> = {
  SIGNAL: "Observed or simulated input. Never an authorization.",
  PROPOSAL: "Model or agent output. Zero authority.",
  POLICY_DECISION: "Deterministic gate outside the proposer.",
  HUMAN_BINDING: "Operator allow or deny. HARD_DENY cannot be waived.",
  EFFECT: "What actually happened — including nothing.",
  RECEIPT: "Canonical record of the bind.",
  VERIFICATION: "Independent check that the record still hashes.",
};

export function Trajectory() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [decision, setDecision] = useState<"ALLOW" | "DENY" | null>(null);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const policy = useMemo(() => evaluatePolicy(scenario.action), [scenario]);
  const objects = useMemo(() => objectsFor(scenario, policy, decision), [scenario, policy, decision]);

  function pick(id: string) {
    setScenarioId(id);
    setDecision(null);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker="Inspectable action ontology"
        title="Every action is a typed object."
        lede="Learned from public governance patterns, built as an original SZL graph. Signal, proposal, policy, human bind, effect, receipt, verification — each inspectable, none implied. The proposer never authors the decision object."
        claims={["DEMO", "MODELED"]}
      />

      <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SCENARIOS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => pick(item.id)}
            className={
              item.id === scenarioId
                ? "min-h-14 rounded-xl border border-bone/30 bg-ink-2 px-4 py-3 text-left"
                : "min-h-14 rounded-xl border border-line px-4 py-3 text-left text-mute hover:text-bone"
            }
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-steel">{item.product}</p>
            <p className="mt-1 text-sm text-bone">{item.title}</p>
          </button>
        ))}
      </div>

      <ol className="mt-10 grid gap-3">
        {objects.map((obj, idx) => (
          <li key={obj.kind} className="rounded-xl border border-line bg-ink-2 p-5 sm:grid sm:grid-cols-[7rem_1fr] sm:gap-6">
            <p className="font-mono text-[11px] text-steel">
              {String(idx + 1).padStart(2, "0")} · {OBJECT_ORDER[idx]}
            </p>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl">{obj.title}</h2>
                <Badge tone={obj.authority === "POLICY" ? "steel" : obj.authority === "HUMAN" ? "allow" : "mute"}>
                  {obj.authority}
                </Badge>
                <ClaimChip kind={obj.evidence} />
              </div>
              <p className="mt-2 text-sm text-mute">{obj.body}</p>
              <p className="mt-2 font-mono text-[11px] text-faint">{KIND_NOTE[obj.kind]}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-8 rounded-xl border border-line p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Bind the trajectory</p>
        <p className="mt-2 max-w-xl text-sm text-mute">{scenario.note}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={!policy.human_can_approve}
            onClick={() => setDecision("ALLOW")}
          >
            Human allow
          </Button>
          <Button type="button" variant="secondary" onClick={() => setDecision("DENY")}>
            Human deny
          </Button>
          <Button asChild variant="ghost">
            <Link to="/command">Open the live gate</Link>
          </Button>
        </div>
        {!policy.human_can_approve && (
          <p className="mt-3 text-sm text-deny">HARD_DENY is already bound by policy. The human cannot waive it.</p>
        )}
      </section>

      <p className="mt-8 text-sm text-mute">
        Trajectory evaluation is the missing competitor pattern we implemented here: judge the whole chain,
        not the final sentence. Lifecycle stages live on{" "}
        <Link to="/lifecycle" className="text-steel hover:text-bone">
          /lifecycle
        </Link>
        .
      </p>
    </main>
  );
}
