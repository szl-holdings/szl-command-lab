import type { LockedFormula } from "./formulas";
import {
  CONJECTURE_1,
  evaluateAnatomy,
  evaluateAuthorization,
  type AnatomyEval,
  type Organ,
  type TamperFlags,
} from "./organs";
import type { PolicyResult, PolicyVerdict, Scenario } from "./policy";

export type DemoPhaseId =
  | "intake"
  | "policy"
  | "f1"
  | "f4"
  | "f11"
  | "f7"
  | "f22"
  | "f12"
  | "f18"
  | "f19"
  | "bind";

export type PhaseVerdict = "PASS" | "OPEN" | "UNAVAILABLE" | "HOLD" | "DENY" | "BLOCKED";

export type DemoPhase = {
  id: DemoPhaseId;
  label: string;
  formulaId: LockedFormula["id"] | null;
  organId: Organ["id"] | null;
  copy: string;
};

export type PhaseTrace = {
  id: DemoPhaseId;
  verdict: PhaseVerdict;
  detail: string;
};

export const DEMO_PHASES: readonly DemoPhase[] = [
  {
    id: "intake",
    label: "Intake",
    formulaId: null,
    organId: null,
    copy: "Proposal received. The proposer has no write authority.",
  },
  {
    id: "policy",
    label: "Policy",
    formulaId: null,
    organId: null,
    copy: "Independent policy evaluates the tool and resource.",
  },
  {
    id: "f1",
    label: "F1 YARQA",
    formulaId: "F1",
    organId: "brain",
    copy: "Canal partition. Read-only cortex. Cross-canal leak fail-closes.",
  },
  {
    id: "f4",
    label: "F4 YUYAY",
    formulaId: "F4",
    organId: "heart",
    copy: "13-axis conjunctive floors. A zero axis routes Λ to 0.",
  },
  {
    id: "f11",
    label: "F11 Λ",
    formulaId: "F11",
    organId: "heart",
    copy: "Aggregate is Conjecture 1 OPEN. Never painted theorem-green.",
  },
  {
    id: "f7",
    label: "F7 YAWAR",
    formulaId: "F7",
    organId: "circulatory",
    copy: "Append-only SHA-256 hops. A broken prev pointer is the evaluation.",
  },
  {
    id: "f22",
    label: "F22 verify",
    formulaId: "F22",
    organId: "circulatory",
    copy: "Walk the prev pointer. Tamper is EVIDENT, not a production signer.",
  },
  {
    id: "f12",
    label: "F12 energy",
    formulaId: "F12",
    organId: "nervous",
    copy: "Energy stays UNAVAILABLE. A fabricated joule downs NERVOUS.",
  },
  {
    id: "f18",
    label: "F18 Khipu",
    formulaId: "F18",
    organId: "skeleton",
    copy: "Locked-8 silhouettes. A sorry cannot be painted green.",
  },
  {
    id: "f19",
    label: "F19 VCA",
    formulaId: "F19",
    organId: "skeleton",
    copy: "CHECKED ≠ Lean PROVEN. Structural silhouette only.",
  },
  {
    id: "bind",
    label: "Bind",
    formulaId: null,
    organId: null,
    copy: "HARD_DENY knots itself. Anything else waits for a human.",
  },
];

function organOf(body: AnatomyEval, id: Organ["id"]): Organ {
  return body.organs.find((item) => item.id === id) ?? body.organs[0];
}

export async function traceKernel(
  policy: PolicyResult,
  flags: TamperFlags,
): Promise<{ body: AnatomyEval; traces: Record<DemoPhaseId, PhaseTrace> }> {
  const body = await evaluateAnatomy(flags);
  const auth = evaluateAuthorization(body);
  const brain = organOf(body, "brain");
  const heart = organOf(body, "heart");
  const circ = organOf(body, "circulatory");
  const nerv = organOf(body, "nervous");
  const skel = organOf(body, "skeleton");

  const traces: Record<DemoPhaseId, PhaseTrace> = {
    intake: {
      id: "intake",
      verdict: "PASS",
      detail: "Proposal received. Proposer has no write authority.",
    },
    policy: {
      id: "policy",
      verdict: policy.verdict === "HARD_DENY" ? "DENY" : policy.verdict === "ALLOW" ? "PASS" : "HOLD",
      detail: `${policy.verdict.replaceAll("_", " ")} · ${policy.policy_id}`,
    },
    f1: {
      id: "f1",
      verdict: brain.status === "DOWN" ? "BLOCKED" : "PASS",
      detail: brain.detail,
    },
    f4: {
      id: "f4",
      verdict: heart.status === "DOWN" ? "BLOCKED" : "PASS",
      detail: heart.detail,
    },
    f11: {
      id: "f11",
      verdict: "OPEN",
      detail: CONJECTURE_1,
    },
    f7: {
      id: "f7",
      verdict: circ.status === "DOWN" ? "BLOCKED" : "PASS",
      detail: circ.detail,
    },
    f22: {
      id: "f22",
      verdict: body.chain_ok ? "PASS" : "BLOCKED",
      detail: body.chain_ok
        ? `prev pointer walks · head ${body.chain_head.slice(0, 16)} · not production DSSE`
        : "prev pointer break — fail closed",
    },
    f12: {
      id: "f12",
      verdict: nerv.status === "DOWN" ? "BLOCKED" : "UNAVAILABLE",
      detail: nerv.detail,
    },
    f18: {
      id: "f18",
      verdict: skel.status === "DOWN" ? "BLOCKED" : "PASS",
      detail: skel.detail,
    },
    f19: {
      id: "f19",
      verdict: skel.status === "DOWN" ? "BLOCKED" : "PASS",
      detail: `CHECKED ≠ Lean PROVEN @ ${body.kernel_commit}`,
    },
    bind: {
      id: "bind",
      verdict: policy.verdict === "HARD_DENY" ? "DENY" : body.blocked ? "BLOCKED" : "HOLD",
      detail:
        policy.verdict === "HARD_DENY"
          ? "HARD_DENY knots itself. Human authority cannot waive."
          : body.blocked
            ? auth.meaning
            : "Body held. Bind Approve or Deny — policy will not self-execute.",
    },
  };

  return { body, traces };
}

export function demoDelayMs() {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return 40;
  }
  return 320;
}

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export type SuiteBind = "ALLOW" | "DENY" | "HOLD";

export function suiteBind(scenarioId: Scenario["id"], verdict: PolicyVerdict): SuiteBind {
  if (verdict === "HARD_DENY") return "DENY";
  if (scenarioId === "deploy-adapter") return "DENY";
  if (scenarioId === "query-ledger") return "ALLOW";
  if (scenarioId === "intercept-track") return "ALLOW";
  return "HOLD";
}
