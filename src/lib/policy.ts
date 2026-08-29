export type PolicyVerdict = "HARD_DENY" | "REQUIRE_HUMAN" | "ALLOW";

export type ProposedAction = {
  tool: string;
  resource: string;
  args: Record<string, unknown>;
  actor: string;
};

export type PolicyResult = {
  verdict: PolicyVerdict;
  policy_id: string;
  reason: string;
  effector_class: "NONE" | "ADVISORY" | "SIMULATED";
  human_can_approve: boolean;
};

export type Scenario = {
  id: string;
  title: string;
  product: "a11oy" | "killinchu";
  proposer: string;
  note: string;
  action: ProposedAction;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "pii-export",
    title: "Export customer roster",
    product: "a11oy",
    proposer: "MODELED proposer — not a live model",
    note: "PII export is fail-closed. Human authority cannot waive it in this gate.",
    action: {
      actor: "agent.receipt-draft",
      tool: "export_records",
      resource: "customers.pii",
      args: { format: "csv", fields: ["email", "ssn"] },
    },
  },
  {
    id: "deploy-adapter",
    title: "Deploy receipt adapter to staging",
    product: "a11oy",
    proposer: "MODELED proposer — not a live model",
    note: "Weight promotion is never automatic. Human binds the receipt.",
    action: {
      actor: "agent.forge",
      tool: "deploy_adapter",
      resource: "SZLHOLDINGS/SZL-Forge-1.5B-ReceiptAgent",
      args: { env: "staging", format: "safetensors" },
    },
  },
  {
    id: "query-ledger",
    title: "Query receipt ledger",
    product: "a11oy",
    proposer: "MODELED proposer — not a live model",
    note: "Read paths are allowed, but still mint a human-bound receipt.",
    action: {
      actor: "operator.console",
      tool: "query_ledger",
      resource: "receipts.chain",
      args: { since: "2026-08-01", limit: 50 },
    },
  },
  {
    id: "delete-evidence",
    title: "Delete evidence bucket objects",
    product: "a11oy",
    proposer: "MODELED proposer — not a live model",
    note: "Public serving identities cannot mutate evidence.",
    action: {
      actor: "space.a11oy.public",
      tool: "delete_objects",
      resource: "bucket:szl-evidence",
      args: { prefix: "/data/", mode: "recursive" },
    },
  },
  {
    id: "intercept-track",
    title: "Recommend intercept on track K-17",
    product: "killinchu",
    proposer: "MODELED fusion hint — advisory only",
    note: "Effectors are simulated. Approval records an advisory recommendation, not a weapon command.",
    action: {
      actor: "killinchu.fusion",
      tool: "recommend_intercept",
      resource: "track:K-17",
      args: { method: "advisory_vector", weapons: false },
    },
  },
];

export function evaluatePolicy(action: ProposedAction): PolicyResult {
  const tool = action.tool;
  const resource = action.resource.toLowerCase();
  const fields = JSON.stringify(action.args).toLowerCase();

  if (tool === "export_records" && (resource.includes("pii") || fields.includes("ssn"))) {
    return {
      verdict: "HARD_DENY",
      policy_id: "pol.pii-exfil-v1",
      reason: "PII export is denied by independent policy. The model cannot override this gate.",
      effector_class: "NONE",
      human_can_approve: false,
    };
  }

  if (tool === "delete_objects" || resource.includes("szl-evidence")) {
    return {
      verdict: "HARD_DENY",
      policy_id: "pol.evidence-append-only-v1",
      reason: "Evidence stores are append-only. Public serving identities cannot delete or overwrite.",
      effector_class: "NONE",
      human_can_approve: false,
    };
  }

  if (tool === "deploy_adapter" || tool === "promote_weights") {
    return {
      verdict: "REQUIRE_HUMAN",
      policy_id: "pol.no-auto-promote-v1",
      reason: "Candidate artifacts stay quarantined until a separate human promotion receipt is bound.",
      effector_class: "NONE",
      human_can_approve: true,
    };
  }

  if (tool === "recommend_intercept" || tool.startsWith("engage")) {
    return {
      verdict: "REQUIRE_HUMAN",
      policy_id: "pol.killinchu-advisory-v1",
      reason: "Track recommendations require a human operator. Effectors remain SIMULATED / ADVISORY.",
      effector_class: "ADVISORY",
      human_can_approve: true,
    };
  }

  if (tool === "query_ledger" || tool === "page_oncall" || tool === "read_status") {
    return {
      verdict: "ALLOW",
      policy_id: "pol.read-bound-v1",
      reason: "Read and paging actions are in policy. Human still binds the receipt before execution.",
      effector_class: "NONE",
      human_can_approve: true,
    };
  }

  return {
    verdict: "REQUIRE_HUMAN",
    policy_id: "pol.default-fail-closed-v1",
    reason: "Unknown tools default to human review. The proposer cannot self-authorize.",
    effector_class: "NONE",
    human_can_approve: true,
  };
}
