import { sha256Hex } from "./receipt";

export const KERNEL_COMMIT = "c7c0ba17";
export const LOCKED_EIGHT = ["F1", "F4", "F7", "F11", "F12", "F18", "F19", "F22"] as const;
export const YUYAY_FLOORS = [0.95, 0.95, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9] as const;
export const CONJECTURE_1 =
  "Any two aggregators satisfying A1–A4 agree on every input. OPEN (sorry). Unconditional uniqueness under kernel A1–A5 is machine-checked FALSE.";
export const WILLAY_NOTE =
  "Refusals are tamper-EVIDENT, not tamper-proof. Auditable rules. Trust ceiling 0.97. WILLAY is conscience, not a sixth proven organ.";

export type OrganStatus = "LIVE" | "DOWN";
export type OrganHonesty = "LIVE" | "ADVISORY" | "UNAVAILABLE";

export type Organ = {
  id: "brain" | "heart" | "circulatory" | "nervous" | "skeleton";
  name: string;
  quechua: string;
  formulas: readonly string[];
  role: string;
  status: OrganStatus;
  honesty: OrganHonesty;
  detail: string;
  metric: number;
};

export type TamperFlags = {
  zero_heart: boolean;
  leak_canal: boolean;
  tamper_chain: boolean;
  fabricate_joule: boolean;
  break_skeleton: boolean;
  willay_fire: boolean;
};

export const HEALTHY_FLAGS: TamperFlags = {
  zero_heart: false,
  leak_canal: false,
  tamper_chain: false,
  fabricate_joule: false,
  break_skeleton: false,
  willay_fire: false,
};

export const TAMPER_CONTROLS: { id: keyof TamperFlags; label: string; organ: string }[] = [
  { id: "zero_heart", label: "Zero HEART", organ: "YUYAY" },
  { id: "leak_canal", label: "Leak canal", organ: "YACHAY" },
  { id: "tamper_chain", label: "Tamper chain", organ: "YAWAR" },
  { id: "fabricate_joule", label: "Fabricate joule", organ: "OTel" },
  { id: "break_skeleton", label: "Break F18", organ: "Khipu" },
  { id: "willay_fire", label: "Fire WILLAY", organ: "conscience" },
];

export type AnatomyEval = {
  organs: Organ[];
  live_count: number;
  blocked: boolean;
  verdict: "BLOCKED" | "ADVISORY_BODY";
  willay_refused: boolean;
  energy: "UNAVAILABLE";
  energy_j: null;
  lambda_advisory: true;
  conjecture_1: "OPEN";
  locked_proven: 8;
  kernel_commit: string;
  chain_head: string;
  chain_ok: boolean;
  proven_trust: false;
  reason: string;
};

export type AuthVerdict = "BODY_BLOCKED" | "ADVISORY_NOT_PROVEN";

export type AuthEvaluation = {
  verdict: AuthVerdict;
  evidence_class: "DEMO";
  authorized: false;
  meaning: string;
};

const ZERO = "0".repeat(64);
const CHAIN_OPS = ["anatomy.brain", "anatomy.heart", "anatomy.skeleton"] as const;

const SPEC: Omit<Organ, "status" | "honesty" | "detail" | "metric">[] = [
  {
    id: "brain",
    name: "BRAIN",
    quechua: "YACHAY",
    formulas: ["F1"],
    role: "read-only reasoning cortex — never holds write authority",
  },
  {
    id: "heart",
    name: "HEART",
    quechua: "YUYAY",
    formulas: ["F4", "F11"],
    role: "13-axis conjunctive critique gate — advisory Λ",
  },
  {
    id: "circulatory",
    name: "CIRCULATORY",
    quechua: "YAWAR",
    formulas: ["F7", "F22"],
    role: "append-only receipt bus — SHA-256",
  },
  {
    id: "nervous",
    name: "NERVOUS",
    quechua: "OTel",
    formulas: ["F12"],
    role: "telemetry spine — energy UNAVAILABLE",
  },
  {
    id: "skeleton",
    name: "SKELETON",
    quechua: "Khipu",
    formulas: ["F18", "F19"],
    role: "locked-8 formula spine — CHECKED ≠ Lean PROVEN",
  },
];

export function hydrateLiveOrgan(row: {
  name?: string;
  status?: string;
  honesty?: string;
}): Organ | null {
  const spec = SPEC.find((item) => item.name === row.name);
  if (!spec) return null;
  const status: OrganStatus = row.status === "DOWN" ? "DOWN" : "LIVE";
  const honesty: OrganHonesty =
    row.honesty === "UNAVAILABLE" ? "UNAVAILABLE" : row.honesty === "ADVISORY" ? "ADVISORY" : status === "DOWN" ? "UNAVAILABLE" : "LIVE";
  return {
    ...spec,
    status,
    honesty,
    detail: "Hub kernel recapture · SZLHOLDINGS/szl-command-lab",
    metric: 0,
  };
}

function wgm(xs: number[], ws: number[]): number {
  if (xs.length !== ws.length || xs.length === 0) return 0;
  if (xs.some((x) => !Number.isFinite(x) || x <= 0)) return 0;
  if (ws.some((w) => !Number.isFinite(w) || w < 0)) return 0;
  const sum = ws.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) >= 1e-9) return 0;
  const value = Math.exp(xs.reduce((acc, x, i) => acc + ws[i] * Math.log(x), 0));
  return Number.isFinite(value) ? value : 0;
}

function evaluateLambda(axes: number[]) {
  const n = axes.length;
  const weights = n ? Array.from({ length: n }, () => 1 / n) : [];
  const value = wgm(axes, weights);
  const blocked = value === 0;
  return {
    value,
    blocked,
    reason: blocked
      ? "zero-routed or non-finite axis"
      : "advisory pass — uniqueness remains Conjecture 1 OPEN",
  };
}

async function yawarChain(seed: number, tamper: boolean) {
  const hops: { seq: number; op: string; prev: string; digest: string }[] = [];
  let prev = ZERO;
  for (let seq = 0; seq < CHAIN_OPS.length; seq += 1) {
    const op = CHAIN_OPS[seq];
    const digest = await sha256Hex(`${seq}|${op}|${prev}|${seed}`);
    hops.push({ seq, op, prev, digest });
    prev = digest;
  }
  if (tamper && hops.length > 1) {
    hops[1] = { ...hops[1], prev: `deadbeef${hops[1].prev.slice(8)}` };
  }
  let walk = ZERO;
  let ok = true;
  let breakAt: number | null = null;
  for (const hop of hops) {
    const expect = await sha256Hex(`${hop.seq}|${hop.op}|${hop.prev}|${seed}`);
    if (hop.prev !== walk || expect !== hop.digest) {
      ok = false;
      breakAt = hop.seq;
      break;
    }
    walk = hop.digest;
  }
  return {
    ok,
    head: hops.at(-1)?.digest ?? ZERO,
    depth: hops.length,
    break_at: breakAt,
  };
}

export async function evaluateAnatomy(
  flags: TamperFlags = HEALTHY_FLAGS,
  seed = 11,
): Promise<AnatomyEval> {
  const axes: number[] = [...YUYAY_FLOORS];
  if (flags.zero_heart) axes[0] = 0;
  const heart = evaluateLambda(axes);
  const chain = await yawarChain(seed, flags.tamper_chain);
  const leaked = flags.leak_canal ? 1 : 0;
  const brainDown = leaked > 1e-9;
  const heartDown = heart.blocked;
  const yawarDown = !chain.ok;
  const nervousDown = flags.fabricate_joule;
  const skeletonPass = LOCKED_EIGHT.filter((id) => !(flags.break_skeleton && id === "F18")).length;
  const skeletonDown = skeletonPass < LOCKED_EIGHT.length;

  const organs: Organ[] = [
    {
      ...SPEC[0],
      status: brainDown ? "DOWN" : "LIVE",
      honesty: "LIVE",
      detail: brainDown
        ? `cross-canal leak ${leaked.toExponential(3)} — YACHAY cannot reason across a broken partition`
        : "read-only cortex · canal-partition silhouette leak 0 · MEASURED YARQA is the KHIPU Space",
      metric: leaked,
    },
    {
      ...SPEC[1],
      status: heartDown ? "DOWN" : "LIVE",
      honesty: "ADVISORY",
      detail: heartDown
        ? `Λ ${heart.value.toFixed(4)} · ${heart.reason}`
        : `Λ ${heart.value.toFixed(4)} · advisory · Conjecture 1 OPEN`,
      metric: heart.value,
    },
    {
      ...SPEC[2],
      status: yawarDown ? "DOWN" : "LIVE",
      honesty: "LIVE",
      detail: yawarDown
        ? `chain break at ${chain.break_at} — prev pointer does not walk. Fail closed.`
        : `3-hop SHA-256 · depth ${chain.depth} · head ${chain.head.slice(0, 16)}`,
      metric: chain.ok ? 0 : 1,
    },
    {
      ...SPEC[3],
      status: nervousDown ? "DOWN" : "LIVE",
      honesty: "UNAVAILABLE",
      detail: nervousDown
        ? "fabricated joule refused — energy stays UNAVAILABLE"
        : "loop-tax silhouette · energy UNAVAILABLE · never a fabricated joule",
      metric: nervousDown ? 1 : 0,
    },
    {
      ...SPEC[4],
      status: skeletonDown ? "DOWN" : "LIVE",
      honesty: "ADVISORY",
      detail: skeletonDown
        ? `locked-8 silhouettes ${skeletonPass}/${LOCKED_EIGHT.length} — a sorry cannot be painted green`
        : `locked-8 silhouettes ${skeletonPass}/${LOCKED_EIGHT.length} · CHECKED ≠ Lean PROVEN @ ${KERNEL_COMMIT}`,
      metric: skeletonPass,
    },
  ];

  const liveCount = organs.filter((o) => o.status === "LIVE").length;
  const organDown = organs.some((o) => o.status === "DOWN");
  const blocked = organDown || flags.willay_fire;
  let reason: string;
  if (flags.willay_fire) {
    reason = "WILLAY conscience veto — governance bypass refused (tamper-EVIDENT, not tamper-proof)";
  } else if (organDown) {
    const down = organs.filter((o) => o.status === "DOWN").map((o) => o.name).join(", ");
    reason = `organ integrity FAIL · ${down} DOWN · fail closed`;
  } else {
    reason = `organ integrity ${liveCount}/5 LIVE · Λ advisory · energy UNAVAILABLE · Conjecture 1 OPEN`;
  }

  return {
    organs,
    live_count: liveCount,
    blocked,
    verdict: blocked ? "BLOCKED" : "ADVISORY_BODY",
    willay_refused: flags.willay_fire,
    energy: "UNAVAILABLE",
    energy_j: null,
    lambda_advisory: true,
    conjecture_1: "OPEN",
    locked_proven: 8,
    kernel_commit: KERNEL_COMMIT,
    chain_head: chain.head,
    chain_ok: chain.ok,
    proven_trust: false,
    reason,
  };
}

export function evaluateAuthorization(ev: AnatomyEval): AuthEvaluation {
  if (ev.blocked) {
    return {
      verdict: "BODY_BLOCKED",
      evidence_class: "DEMO",
      authorized: false,
      meaning: `${ev.reason} Authorization stays closed.`,
    };
  }
  return {
    verdict: "ADVISORY_NOT_PROVEN",
    evidence_class: "DEMO",
    authorized: false,
    meaning:
      "5/5 LIVE is an advisory body. proven_trust stays false. Energy is UNAVAILABLE. Λ uniqueness is Conjecture 1 OPEN. A healthy kernel is not an authorization.",
  };
}
