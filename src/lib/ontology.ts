import { evaluatePolicy, SCENARIOS, type PolicyResult, type Scenario } from "@/lib/policy";

/** Typed objects in the SZL action graph. Original — not a vendor ontology. */
export type ObjectKind =
  | "SIGNAL"
  | "PROPOSAL"
  | "POLICY_DECISION"
  | "HUMAN_BINDING"
  | "EFFECT"
  | "RECEIPT"
  | "VERIFICATION";

export type ObjectRecord = {
  kind: ObjectKind;
  id: string;
  title: string;
  body: string;
  evidence: "DEMO" | "MEASURED" | "MODELED" | "SIMULATED" | "UNAVAILABLE";
  authority: "NONE" | "POLICY" | "HUMAN";
};

export const OBJECT_ORDER: ObjectKind[] = [
  "SIGNAL",
  "PROPOSAL",
  "POLICY_DECISION",
  "HUMAN_BINDING",
  "EFFECT",
  "RECEIPT",
  "VERIFICATION",
];

export function objectsFor(scenario: Scenario, policy: PolicyResult, decided: "ALLOW" | "DENY" | null): ObjectRecord[] {
  const denied = policy.verdict === "HARD_DENY";
  const held = decided === null && !denied;
  return [
    {
      kind: "SIGNAL",
      id: `sig.${scenario.id}`,
      title: scenario.title,
      body: `Actor ${scenario.action.actor} raised a request against ${scenario.action.resource}.`,
      evidence: scenario.product === "killinchu" ? "SIMULATED" : "DEMO",
      authority: "NONE",
    },
    {
      kind: "PROPOSAL",
      id: `prop.${scenario.id}`,
      title: `${scenario.action.tool}`,
      body: `${scenario.proposer}. Args ${JSON.stringify(scenario.action.args)}. A proposal has zero authority.`,
      evidence: "MODELED",
      authority: "NONE",
    },
    {
      kind: "POLICY_DECISION",
      id: policy.policy_id,
      title: policy.verdict,
      body: policy.reason,
      evidence: "DEMO",
      authority: "POLICY",
    },
    {
      kind: "HUMAN_BINDING",
      id: held ? "bind.pending" : `bind.${decided ?? "blocked"}`,
      title: denied ? "Cannot waive" : decided ? `Human ${decided}` : "Awaiting operator",
      body: denied
        ? "HARD_DENY cannot be waived. The human sees the refusal; they do not override it."
        : decided
          ? "Operator bound the decision. Authority is HUMAN, never the proposer."
          : "Policy permits a human to allow or deny. Nothing executes until that bind.",
      evidence: "DEMO",
      authority: denied ? "POLICY" : "HUMAN",
    },
    {
      kind: "EFFECT",
      id: `eff.${scenario.id}`,
      title: denied || decided !== "ALLOW" ? "No effect" : policy.effector_class === "ADVISORY" ? "Advisory only" : "Recorded allow",
      body:
        policy.effector_class === "ADVISORY"
          ? "Killinchu effectors remain ADVISORY / SIMULATED. No weapon command is issued."
          : denied || decided !== "ALLOW"
            ? "Side effects did not run. The refusal is the evidence."
            : "Demo effect is a receipt append, not a production actuator.",
      evidence: scenario.product === "killinchu" ? "SIMULATED" : "DEMO",
      authority: "NONE",
    },
    {
      kind: "RECEIPT",
      id: "rcpt.session",
      title: "WEBCRYPTO_HMAC_DEMO",
      body: "Canonical JSON + HMAC. Proves the bind, not production DSSE authority.",
      evidence: "DEMO",
      authority: "HUMAN",
    },
    {
      kind: "VERIFICATION",
      id: "ver.offline",
      title: "Independent verify",
      body: "Tamper any field → digest/mac fail. Restore → pass. Verification is a first-class object.",
      evidence: "DEMO",
      authority: "NONE",
    },
  ];
}

export function defaultScenario(): Scenario {
  return SCENARIOS[0];
}

export function policyFor(scenario: Scenario): PolicyResult {
  return evaluatePolicy(scenario.action);
}
