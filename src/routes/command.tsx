import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { DemoRail } from "@/components/demo-rail";
import { Hologram } from "@/components/hologram";
import { KhipuLedger } from "@/components/khipu-ledger";
import { PageHeader } from "@/components/page-header";
import { ReceiptCard } from "@/components/receipt-card";
import { LiveStrip } from "@/components/live-strip";
import { Button } from "@/components/ui/button";
import {
  DEMO_PHASES,
  demoDelayMs,
  sleep,
  suiteBind,
  traceKernel,
  type DemoPhaseId,
  type PhaseTrace,
} from "@/lib/demo-run";
import { formulaByPolicy } from "@/lib/formulas";
import { chainHead, useLedger } from "@/lib/ledger-store";
import { evaluateAnatomy, HEALTHY_FLAGS, type AnatomyEval, type TamperFlags } from "@/lib/organs";
import { evaluatePolicy, SCENARIOS, type Scenario } from "@/lib/policy";
import { mintReceipt } from "@/lib/receipt";
import { knotLabel, shortSha } from "@/lib/utils";

export const Route = createFileRoute("/command")({ component: Command });

function flagsForPolicy(policyId: string, verdict: string): TamperFlags {
  if (verdict !== "HARD_DENY") return HEALTHY_FLAGS;
  if (policyId.includes("pii")) return { ...HEALTHY_FLAGS, willay_fire: true };
  if (policyId.includes("evidence")) return { ...HEALTHY_FLAGS, tamper_chain: true };
  return { ...HEALTHY_FLAGS, zero_heart: true };
}

function Command() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulse, setPulse] = useState<"idle" | "allow" | "deny" | "hold">("idle");
  const [phase, setPhase] = useState<DemoPhaseId | null>(null);
  const [walkDone, setWalkDone] = useState(false);
  const [body, setBody] = useState<AnatomyEval | null>(null);
  const [traces, setTraces] = useState<Partial<Record<DemoPhaseId, PhaseTrace>>>({});
  const receipts = useLedger((s) => s.receipts);
  const append = useLedger((s) => s.append);
  const abortRef = useRef<AbortController | null>(null);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const policy = useMemo(() => evaluatePolicy(scenario.action), [scenario]);
  const formula = formulaByPolicy(policy.policy_id);
  const latest = receipts[receipts.length - 1] ?? null;
  const flags = useMemo(
    () => flagsForPolicy(policy.policy_id, policy.verdict),
    [policy.policy_id, policy.verdict],
  );
  const currentPhase = DEMO_PHASES.find((item) => item.id === phase) ?? null;
  const currentTrace = phase ? traces[phase] : undefined;

  useEffect(() => {
    let cancelled = false;
    void evaluateAnatomy(flags).then((ev) => {
      if (!cancelled) setBody(ev);
    });
    return () => {
      cancelled = true;
    };
  }, [flags]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function mintDecision(decision: "ALLOW" | "DENY", source: Scenario = scenario) {
    const nextPolicy = evaluatePolicy(source.action);
    if (decision === "ALLOW" && !nextPolicy.human_can_approve) return;
    const receipt = await mintReceipt({
      actor: "human.operator",
      tool: source.action.tool,
      resource: source.action.resource,
      args: source.action.args,
      policy_id: nextPolicy.policy_id,
      policy_reason: nextPolicy.reason,
      decision,
      authority: nextPolicy.verdict === "HARD_DENY" ? "POLICY" : "HUMAN",
      effector_class: nextPolicy.effector_class,
      prev_sha256: chainHead(useLedger.getState().receipts),
    });
    append(receipt);
    setPulse(decision === "DENY" ? "deny" : "allow");
    setWalkDone(true);
    setPhase("bind");
  }

  async function decide(decision: "ALLOW" | "DENY", source: Scenario = scenario) {
    setBusy(true);
    setError(null);
    try {
      await mintDecision(decision, source);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Receipt mint failed");
    } finally {
      setBusy(false);
    }
  }

  async function walkKernel(signal: AbortSignal, source: Scenario) {
    const nextPolicy = evaluatePolicy(source.action);
    const nextFlags = flagsForPolicy(nextPolicy.policy_id, nextPolicy.verdict);
    const { body: nextBody, traces: nextTraces } = await traceKernel(nextPolicy, nextFlags);
    setBody(nextBody);
    setTraces({});
    setWalkDone(false);
    setPulse(nextPolicy.verdict === "HARD_DENY" || nextBody.blocked ? "deny" : "hold");
    for (const step of DEMO_PHASES) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      setPhase(step.id);
      setTraces((prev) => ({ ...prev, [step.id]: nextTraces[step.id] }));
      await sleep(demoDelayMs(), signal);
    }
    setWalkDone(true);
    return nextPolicy;
  }

  async function runDemo() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      const nextPolicy = await walkKernel(controller.signal, scenario);
      if (nextPolicy.verdict === "HARD_DENY") {
        await mintDecision("DENY", scenario);
        return;
      }
      setPulse("hold");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Demo walk failed");
    } finally {
      setBusy(false);
    }
  }

  async function runFullSuite() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      for (const item of SCENARIOS) {
        if (controller.signal.aborted) return;
        setScenarioId(item.id);
        const nextPolicy = await walkKernel(controller.signal, item);
        const bind = suiteBind(item.id, nextPolicy.verdict);
        if (bind === "HOLD") {
          setPulse("hold");
          continue;
        }
        await mintDecision(bind, item);
        await sleep(demoDelayMs(), controller.signal);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Full suite failed");
    } finally {
      setBusy(false);
    }
  }

  function selectScenario(id: string) {
    abortRef.current?.abort();
    setScenarioId(id);
    setPulse("idle");
    setPhase(null);
    setWalkDone(false);
    setTraces({});
    setError(null);
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        kicker="Command · locked-8 kernel"
        title="Run the body, then bind."
        lede="A proposal hits independent policy and the five-organ kernel before a human knots the receipt. HARD_DENY cannot be waived. Run demo walks F1 through F22 on the real silhouettes."
        claims={["DEMO", "MODELED"]}
      />
      <div className="mt-6">
        <LiveStrip />
      </div>

      <div className="mt-6">
        <DemoRail phases={DEMO_PHASES} current={phase} done={walkDone} traces={traces} />
        <p className="mt-3 min-h-6 text-sm text-mute">
          {currentTrace
            ? `${currentPhase?.label} · ${currentTrace.verdict} — ${currentTrace.detail}`
            : currentPhase
              ? `${currentPhase.label} — ${currentPhase.copy}`
              : "Idle. Run demo to walk F1 through F22."}
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="lg:sticky lg:top-16 lg:self-start">
          <Hologram
            organs={body?.organs}
            pulse={pulse}
            activeOrgan={
              currentPhase?.organId ??
              (formula.organ.toLowerCase() as "brain" | "heart" | "circulatory" | "nervous" | "skeleton")
            }
            activeFormula={currentPhase?.formulaId ?? formula.id}
            title="Holographic organ kernel"
            caption={
              body
                ? `${formula.id} on ${formula.organ}. ${body.reason}`
                : "Evaluating locked-8 silhouettes."
            }
          />
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-line bg-ink-2 p-5">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">Proposal</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {SCENARIOS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectScenario(item.id)}
                  className={
                    item.id === scenarioId
                      ? "min-h-11 rounded-lg border border-bone/30 bg-ink px-3 py-2 text-left text-sm text-bone"
                      : "min-h-11 rounded-lg border border-line px-3 py-2 text-left text-sm text-mute hover:text-bone"
                  }
                >
                  {item.title}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-line bg-ink-2 p-5">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">
              Policy · {formula.id} · {formula.quechua}
            </p>
            <p
              className={
                policy.verdict === "HARD_DENY"
                  ? "mt-2 font-display text-3xl text-deny"
                  : policy.verdict === "ALLOW"
                    ? "mt-2 font-display text-3xl text-allow"
                    : "mt-2 font-display text-3xl text-hold"
              }
            >
              {policy.verdict.replaceAll("_", " ")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-mute">{policy.reason}</p>
            <p className="mt-2 font-mono text-xs text-steel">
              {policy.policy_id} · effector {policy.effector_class}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" disabled={busy} onClick={() => void runDemo()}>
                Run demo
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void runFullSuite()}>
                Run full suite
              </Button>
              <Button
                variant="allow"
                disabled={busy || !policy.human_can_approve}
                onClick={() => void decide("ALLOW")}
              >
                Approve
              </Button>
              <Button variant="deny" disabled={busy} onClick={() => void decide("DENY")}>
                Deny
              </Button>
            </div>
            {policy.verdict !== "HARD_DENY" && pulse === "hold" && walkDone && (
              <p className="mt-4 text-sm text-hold">
                Body held. Bind Approve or Deny — policy will not self-execute.
              </p>
            )}
            {error && <p className="mt-3 text-sm text-deny">{error}</p>}
            <p className="mt-4 text-xs text-faint">{scenario.note}</p>
            {latest && (
              <div className="mt-5 rounded-lg border border-line bg-ink px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
                  Latest knot · {knotLabel(receipts.length)}
                </p>
                <p className="mt-1 text-sm text-bone">
                  {latest.decision} · {latest.tool}
                </p>
                <p className="mt-1 font-mono text-[11px] text-steel">{shortSha(latest.digest, 10)}</p>
              </div>
            )}
            {latest?.decision === "DENY" && (
              <p className="mt-4 text-sm text-steel">
                Deny is now an admission case.{" "}
                <Link to="/frontier" className="text-bone underline-offset-4 hover:underline">
                  Open the release gate
                </Link>
                .
              </p>
            )}
          </section>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <KhipuLedger receipts={receipts} selectedId={latest?.id} />
        {latest ? (
          <ReceiptCard receipt={latest} />
        ) : (
          <div className="flex items-center rounded-xl border border-dashed border-line p-5 text-sm text-mute">
            Run demo on a HARD_DENY proposal, or bind Approve/Deny, to knot the first cord.
          </div>
        )}
      </div>
    </main>
  );
}
