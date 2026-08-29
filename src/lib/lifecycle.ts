export type LifecycleStage =
  | "PROPOSE"
  | "BUILD"
  | "TEST"
  | "REVIEW"
  | "DEPLOY"
  | "OBSERVE"
  | "APPROVE"
  | "RETIRE";

export type StageRecord = {
  id: LifecycleStage;
  title: string;
  contract: string;
  current: string;
  evidence: "MEASURED" | "DEMO" | "ROADMAP" | "UNAVAILABLE" | "BLOCKED";
};

export const LIFECYCLE: StageRecord[] = [
  {
    id: "PROPOSE",
    title: "Propose",
    contract: "A model or operator may only emit a typed proposal. Proposals never grant tools.",
    current: "Command gate and ontology walk both treat the proposer as MODELED, not live inference.",
    evidence: "DEMO",
  },
  {
    id: "BUILD",
    title: "Build",
    contract: "Canonical GitHub source at an immutable revision. Hub is a published projection.",
    current: "a11oy main 83dbdbb2269145c476d56d7d4dc6a54a60a77314 (#1423). Forge main 42fac35e (#72). .github main 458d8cbe (#489). a11oy-net main a3cd1a69 (#38). Product honest SHA MATCHES.",
    evidence: "MEASURED",
  },
  {
    id: "TEST",
    title: "Test",
    contract: "Required checks SUCCESS/NEUTRAL/SKIPPED. No silent skip of S7/KALLPA gates.",
    current: "a11oy#1421 and .github#490 auto-merge queued. a11oy#1423 five-organ kernel merged. szl-forge#72 Hub MEASURED fail stamped. No self-approval.",
    evidence: "MEASURED",
  },
  {
    id: "REVIEW",
    title: "Review",
    contract: "Exact-head review, DCO or GitHub-verified committer, unresolved threads = 0.",
    current: "required_signatures on a11oy and a11oy-net. Extra-approval for unattributed changes. No --admin. No self-approval.",
    evidence: "MEASURED",
  },
  {
    id: "DEPLOY",
    title: "Deploy",
    contract: "Source SHA, build digest, provider revision, runtime identity, live readback.",
    current: "Honest git_sha MATCHES GitHub #1423. Live organs/integrity is 5/5 ADVISORY_BODY. Hub Space git 7ef7a0a0 is a distinct HF object. This surface remains a demo host. Production DSSE UNAVAILABLE here.",
    evidence: "UNAVAILABLE",
  },
  {
    id: "OBSERVE",
    title: "Observe",
    contract: "Traces, receipts, and evaluations share one identity. Sensitive payloads stay redacted.",
    current: "Session khipu is local-only. Public Spaces running ≠ ready. Runtime fields often null.",
    evidence: "DEMO",
  },
  {
    id: "APPROVE",
    title: "Approve / refuse",
    contract: "Human bind is mandatory for REQUIRE_HUMAN. HARD_DENY cannot be waived.",
    current: "Command gate enforces this. Five-organ kernel: 5/5 LIVE is advisory, not a grant. Training registry refuses all candidates. Named-N publication_eligible stays false.",
    evidence: "DEMO",
  },
  {
    id: "RETIRE",
    title: "Retire",
    contract: "Archives name a successor. Unsafe files are quarantined, not silently deleted from history.",
    current: "Eight joblib kernels quarantined; remaining_joblib=0. KHIPU-R2 retained as research, not promoted.",
    evidence: "MEASURED",
  },
];
