export const LOCKED_EIGHT_IDS = ["F1", "F4", "F7", "F11", "F12", "F18", "F19", "F22"] as const;

export type FormulaHonesty = "DEMO" | "CONJECTURE" | "UNAVAILABLE" | "MEASURED";

export type LockedFormula = {
  id: (typeof LOCKED_EIGHT_IDS)[number];
  name: string;
  organ: "BRAIN" | "HEART" | "CIRCULATORY" | "NERVOUS" | "SKELETON";
  quechua: string;
  lean: "CHECKED" | "CONJECTURE" | "UNAVAILABLE";
  honesty: FormulaHonesty;
  genome: string;
  productName: string;
  meaning: string;
};

export const LOCKED_FORMULAS: readonly LockedFormula[] = [
  {
    id: "F1",
    name: "YARQA canal attention",
    organ: "BRAIN",
    quechua: "YACHAY",
    lean: "CHECKED",
    honesty: "DEMO",
    genome: "lambda_bounded · canal partition",
    productName: "Euler-Khipu DAG Identity",
    meaning: "Read-only cortex. Cross-canal leak fail-closes write authority — there is none.",
  },
  {
    id: "F4",
    name: "YUYAY critique gate",
    organ: "HEART",
    quechua: "YUYAY",
    lean: "CHECKED",
    honesty: "DEMO",
    genome: "lambda_homogeneous A2",
    productName: "Gauss-Yuyay Aggregation",
    meaning: "13-axis conjunctive floors. A zero axis routes Λ to 0.",
  },
  {
    id: "F7",
    name: "YAWAR receipt bus",
    organ: "CIRCULATORY",
    quechua: "YAWAR",
    lean: "CHECKED",
    honesty: "DEMO",
    genome: "khipu_merkle_root TH11",
    productName: "Inverse-Square/Zeta Provenance",
    meaning: "Append-only SHA-256 hops. A broken prev pointer is the evaluation.",
  },
  {
    id: "F11",
    name: "Λ aggregate",
    organ: "HEART",
    quechua: "YUYAY",
    lean: "CONJECTURE",
    honesty: "CONJECTURE",
    genome: "lambda_aggregate D2 WGM",
    productName: "Frustum A-Shrink Law",
    meaning: "A1–A4 are CHECKED. Uniqueness is Conjecture 1 OPEN. Never painted theorem-green.",
  },
  {
    id: "F12",
    name: "Loop-tax / energy",
    organ: "NERVOUS",
    quechua: "OTel",
    lean: "UNAVAILABLE",
    honesty: "UNAVAILABLE",
    genome: "energy exporter delta",
    productName: "CRT-Hukulla Schedule",
    meaning: "Energy is UNAVAILABLE. A fabricated joule downs NERVOUS. No number is invented.",
  },
  {
    id: "F18",
    name: "Khipu singleton spine",
    organ: "SKELETON",
    quechua: "Khipu",
    lean: "CHECKED",
    honesty: "DEMO",
    genome: "reed_solomon_singleton",
    productName: "Kolmogorov A-Description Cap",
    meaning: "Locked-8 silhouettes. A sorry cannot be painted green.",
  },
  {
    id: "F19",
    name: "Khipu structural VCA",
    organ: "SKELETON",
    quechua: "Khipu",
    lean: "CHECKED",
    honesty: "DEMO",
    genome: "schur_concave_lambda_two_axis",
    productName: "Turing-Fuel Halting Safety",
    meaning: "CHECKED ≠ Lean PROVEN. Structural silhouette only.",
  },
  {
    id: "F22",
    name: "Chain verify",
    organ: "CIRCULATORY",
    quechua: "YAWAR",
    lean: "CHECKED",
    honesty: "DEMO",
    genome: "css_ingress_verify",
    productName: "Feynman-Puriq Path Integral",
    meaning: "Walk the prev pointer. Tamper is EVIDENT, not proof of a production signer.",
  },
] as const;

export type GenomeStatus = "PROVED" | "SORRY" | "CONJ" | "SKELETON";

export type GenomeFormula = {
  id: string;
  name: string;
  organ: string;
  status: GenomeStatus;
  locked: boolean;
};

export const GENOME: readonly GenomeFormula[] = [
  { id: "F1", name: "Euler-Khipu DAG Identity", organ: "Khipu", status: "PROVED", locked: true },
  { id: "F2", name: "Egyptian-Kallpa Allocation", organ: "Kallpa", status: "SKELETON", locked: false },
  { id: "F3", name: "Noether-Khipu Conservation", organ: "Khipu", status: "SORRY", locked: false },
  { id: "F4", name: "Gauss-Yuyay Aggregation", organ: "Yuyay", status: "PROVED", locked: true },
  { id: "F5", name: "Euler-Lagrange Agency", organ: "A/agency", status: "SKELETON", locked: false },
  { id: "F6", name: "Newton Risk-Velocity Tripwire", organ: "Hukulla", status: "SKELETON", locked: false },
  { id: "F7", name: "Inverse-Square/Zeta Provenance", organ: "Khipu", status: "PROVED", locked: true },
  { id: "F8", name: "Newton-Parsimony Pick", organ: "Hukulla", status: "SKELETON", locked: false },
  { id: "F9", name: "Sulba Yuyay Mass-Conservation", organ: "Yuyay", status: "SORRY", locked: false },
  { id: "F10", name: "Baudhayana Orthogonality Bound", organ: "Lambda-spine", status: "SORRY", locked: false },
  { id: "F11", name: "Frustum A-Shrink Law", organ: "A/agency", status: "PROVED", locked: true },
  { id: "F12", name: "CRT-Hukulla Schedule", organ: "Hukulla", status: "PROVED", locked: true },
  { id: "F13", name: "Gauss-Bonnet Spine Curvature", organ: "Lambda-spine", status: "CONJ", locked: false },
  { id: "F14", name: "Ramanujan A-Partition Bound", organ: "A/agency", status: "CONJ", locked: false },
  { id: "F15", name: "Grothendieck Organ Functor", organ: "compose", status: "SKELETON", locked: false },
  { id: "F16", name: "von-Neumann-Hukulla Minimax", organ: "Hukulla", status: "SKELETON", locked: false },
  { id: "F17", name: "Shannon-Kallpa Capacity", organ: "Kallpa", status: "SKELETON", locked: false },
  { id: "F18", name: "Kolmogorov A-Description Cap", organ: "A/agency", status: "PROVED", locked: true },
  { id: "F19", name: "Turing-Fuel Halting Safety", organ: "PURIQ-core", status: "PROVED", locked: true },
  { id: "F20", name: "Schrodinger Action Superposition", organ: "A/agency", status: "SORRY", locked: false },
  { id: "F21", name: "Dirac-Commit Projection", organ: "Khipu", status: "SORRY", locked: false },
  { id: "F22", name: "Feynman-Puriq Path Integral", organ: "A/agency", status: "PROVED", locked: true },
  { id: "F23", name: "Bekenstein A-Cap", organ: "A/agency", status: "CONJ", locked: false },
];

export function formulasForOrgan(organ: LockedFormula["organ"]): LockedFormula[] {
  return LOCKED_FORMULAS.filter((f) => f.organ === organ);
}

export function formulaById(id: string): LockedFormula | undefined {
  return LOCKED_FORMULAS.find((f) => f.id === id);
}

export function formulaByPolicy(policyId: string): LockedFormula {
  if (policyId.includes("pii") || policyId.includes("killinchu")) {
    return LOCKED_FORMULAS.find((f) => f.id === "F11")!;
  }
  if (policyId.includes("evidence")) return LOCKED_FORMULAS.find((f) => f.id === "F7")!;
  if (policyId.includes("promote") || policyId.includes("adapter")) {
    return LOCKED_FORMULAS.find((f) => f.id === "F18")!;
  }
  if (policyId.includes("read")) return LOCKED_FORMULAS.find((f) => f.id === "F22")!;
  return LOCKED_FORMULAS.find((f) => f.id === "F4")!;
}
