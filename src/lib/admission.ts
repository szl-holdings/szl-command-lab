import type { Receipt } from "./receipt";

export type ReleaseVerdict = "NO_CASES" | "RELEASE_BLOCKED";

export type AdmissionCase = {
  id: string;
  issued_at: string;
  tool: string;
  resource: string;
  policy_id: string;
  policy_reason: string;
  digest: string;
};

export type ReleaseEvaluation = {
  verdict: ReleaseVerdict;
  evidence_class: "DEMO";
  meaning: string;
  cases: AdmissionCase[];
  knots: number;
  deny_knots: number;
};

export function admissionCases(receipts: Receipt[]): AdmissionCase[] {
  return receipts
    .filter((r) => r.decision === "DENY")
    .map((r) => ({
      id: r.id,
      issued_at: r.issued_at,
      tool: r.tool,
      resource: r.resource,
      policy_id: r.policy_id,
      policy_reason: r.policy_reason,
      digest: r.digest,
    }));
}

export function evaluateRelease(receipts: Receipt[]): ReleaseEvaluation {
  const cases = admissionCases(receipts);
  if (cases.length === 0) {
    return {
      verdict: "NO_CASES",
      evidence_class: "DEMO",
      meaning:
        "No deny knots yet. An empty set is not an admission pass. Mint a HARD_DENY on Command first.",
      cases,
      knots: receipts.length,
      deny_knots: 0,
    };
  }
  return {
    verdict: "RELEASE_BLOCKED",
    evidence_class: "DEMO",
    meaning: `${cases.length} deny knot${cases.length === 1 ? "" : "s"} stay on the admission set. Release remains fail-closed. Cases are not deleted.`,
    cases,
    knots: receipts.length,
    deny_knots: cases.length,
  };
}
