import type { DemoPhase, DemoPhaseId, PhaseTrace, PhaseVerdict } from "@/lib/demo-run";
import { cn } from "@/lib/utils";

type Props = {
  phases: readonly DemoPhase[];
  current: DemoPhaseId | null;
  done: boolean;
  traces?: Partial<Record<DemoPhaseId, PhaseTrace>>;
};

function verdictClass(verdict: PhaseVerdict | undefined, active: boolean, passed: boolean) {
  if (active) return "border-steel/50 bg-ink-3 text-bone";
  if (verdict === "OPEN") return "border-line text-mute";
  if (verdict === "UNAVAILABLE" || verdict === "HOLD") return "border-hold/35 bg-ink-2 text-hold";
  if (verdict === "DENY" || verdict === "BLOCKED") return "border-deny/40 bg-ink-2 text-deny";
  if (verdict === "PASS" || passed) return "border-line bg-ink-2 text-steel";
  return "border-line text-faint";
}

export function DemoRail({ phases, current, done, traces }: Props) {
  const currentIndex = current ? phases.findIndex((p) => p.id === current) : -1;

  return (
    <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Kernel walk">
      {phases.map((phase, index) => {
        const active = phase.id === current;
        const passed = done || (currentIndex >= 0 && index < currentIndex);
        const trace = traces?.[phase.id];
        return (
          <li key={phase.id} className="min-w-0 flex-1">
            <div className={cn("rounded-md border px-2 py-2 text-center", verdictClass(trace?.verdict, active, passed))}>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em]">{phase.label}</p>
              {trace && (
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] opacity-80">
                  {trace.verdict}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
