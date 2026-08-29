export const CAPTURED_AT = "2026-08-29T05:04:00Z";

export const CATEGORY =
  "SZL Holdings builds governed decision infrastructure that turns model proposals into policy-bounded, evidence-linked, human-accountable actions.";

export const GITHUB = {
  org: 85,
  public: 80,
  private: 5,
  archived: 7,
  founder: 2,
  open_prs: 0,
  merge_qualified: 0,
  expected_org: 63,
  expected_public: 58,
  expected_private: 5,
  additions: [
    "YARQA-ATTN",
    "szl-block-kv",
    "szl-blocked",
    "szl-formulas",
    "szl-govsign",
    "szl-invariants",
    "szl-maskmod",
    "szl-ouroboros",
    "szl-provctl",
    "szl-receipt-attn",
    "szl-serve",
    "szl-nemo",
    "szl-khipu",
    "nexus",
    "szl-organ-integrity",
  ] as const,
  identity: "stephenlutar2-hash",
  a11oy_main: "83dbdbb2269145c476d56d7d4dc6a54a60a77314",
  killinchu_main: "a31d39e3ec5c39768f1efe5afdfc433d00788c2a",
  platform_main: "de08cf8ec5836b0cef968d6560a92ecbd1bc6f4b",
  github_main: "458d8cbe664045ddca0301f154c8cf330b6a5e16",
  forge_main: "42fac35ee49ef2b32689593432caac5559f7cae7",
  a11oy_net_main: "a3cd1a69e4de118968b24535d6386c544d1a8b05",
  product_honest_sha: "83dbdbb2269145c476d56d7d4dc6a54a60a77314",
  hub_space_git: "7ef7a0a01178fc89afbf7c04654fa4311d9e9612",
  census_sha256: "MEASURED-LIVE-2026-08-29T05:04Z",
};

export const HF = {
  models: 40,
  datasets: 28,
  spaces: 35,
  collections: 13,
  expected_models: 17,
  expected_spaces: 27,
  joblib_still_present: 0,
  hf_cli: "UNAVAILABLE" as const,
  artifact_classes: {
    CARD_ONLY_ROADMAP: 11,
    SOFTWARE_KERNEL_CARD: 16,
    TRAINED_ADAPTER: 10,
    QUANTIZED_DERIVATIVE: 2,
    TRAINED_OR_CONVERTED_WEIGHTS_REQUIRES_RECEIPT: 1,
    DATASET: 28,
    SPACE_RUNTIME: 35,
  },
};

export const CONTROLLER_SHA =
  "690b55372055415d5bef1e2865aa1b2958baf16d16c98332cd38afcec64c0576";

export const RECEIPT_SHA256 =
  "5e3af7fba69b2bf2088fe7671dee75035d2962be7a30ee930bff98e4f0f1dae4";

export const CANONICAL_ENTRIES = [
  { name: "a11oy", role: "Flagship governed command and execution fabric", href: "https://github.com/szl-holdings/a11oy" },
  { name: "killinchu", role: "Bounded vertical product and edge decision surface", href: "https://github.com/szl-holdings/killinchu" },
  { name: "platform", role: "Broader platform suite and application architecture", href: "https://github.com/szl-holdings/platform" },
  { name: "szl-forge", role: "Canonical training, evaluation, conversion, and serving source", href: "https://github.com/szl-holdings/szl-forge" },
  { name: "szl-kernels", role: "Kernel family index and shared correctness harness", href: "https://github.com/szl-holdings/szl-kernels" },
  { name: "szl-receipt", role: "Receipt implementation; pair with governed-receipt-spec", href: "https://github.com/szl-holdings/szl-receipt" },
  { name: "szl-trust", role: "Trust, verification, and evidence documentation", href: "https://github.com/szl-holdings/szl-trust" },
  { name: "lutar-lean", role: "Formal and research entrance — Λ uniqueness is Conjecture 1", href: "https://github.com/szl-holdings/lutar-lean" },
  { name: "docs-site", role: "Contributor documentation and reproducible examples", href: "https://github.com/szl-holdings/docs-site" },
  { name: "a11oy-net", role: "Public proof registry and diligence surface", href: "https://github.com/szl-holdings/a11oy-net" },
] as const;

export type RepoClass =
  | "CONTROL_PLANE"
  | "PRODUCT_RUNTIME"
  | "RESEARCH_FORMAL"
  | "DOCS_PRESENTATION"
  | "PACKAGE_COMPONENT"
  | "SHOWCASE"
  | "ARCHIVE"
  | "PRIVATE_OPERATIONS"
  | "SUPPORTING_COMPONENT";

export function classifyRepo(name: string, archived: boolean, isPrivate: boolean): RepoClass {
  if (archived) return "ARCHIVE";
  if (isPrivate) return "PRIVATE_OPERATIONS";
  if ([".github", "szl-org-health", "szl-estate-os", "szl-defensive-control-plane"].includes(name)) {
    return "CONTROL_PLANE";
  }
  if (["a11oy", "killinchu", "platform", "gdw-frontier", "immune", "david-leads"].includes(name)) {
    return "PRODUCT_RUNTIME";
  }
  if (["lutar-lean", "szl-papers", "ouroboros", "evidence-doctrine", "lean-kernel"].includes(name)) {
    return "RESEARCH_FORMAL";
  }
  if (["docs-site", "szl-cookbook", "szl-brand", "szl-holdings.github.io", "a11oy-net"].includes(name)) {
    return "DOCS_PRESENTATION";
  }
  if (name.endsWith("-holo") || name.endsWith("-live") || name.includes("demo")) return "SHOWCASE";
  if (
    /kernel|receipt|router|substrate|mesh|mcp|quant|telemetry|consensus|attn|serve|block-kv|maskmod|lambda|norm|guardrail|formula|forge|gpu|otel|yarqa|sda|anatomy|invariants|govsign|provctl|blocked|formulas|nemo|khipu/.test(
      name,
    )
  ) {
    return "PACKAGE_COMPONENT";
  }
  return "SUPPORTING_COMPONENT";
}

export const HF_CLASS = {
  EXECUTABLE_SERIALIZATION: [] as const,
  QUARANTINED_JOBLIB_REMOVED: [
    "szl-governed-norm",
    "szl-blocked",
    "szl-govsign",
    "szl-provctl",
    "szl-nemo",
    "szl-invariants",
    "szl-ouroboros",
    "szl-formulas",
  ],
  TRAINED_ADAPTER: [
    "SZL-Forge-1.5B-ReceiptAgent",
    "SZL-Khipu-1.5B",
    "szl-receiptagent-qwen35-0.8b-v2",
    "KHIPU-R2",
    "chaski",
    "chaski-5050",
    "ReceiptAgent-Nano",
    "TinyKhipu-Nano",
    "MiniEmbed-Nano",
    "Moons-Nano",
  ],
  QUANTIZED_DERIVATIVE: ["SZL-Khipu-1.5B-GGUF", "A11OY-MINI"],
  WEIGHTS_REQUIRES_RECEIPT: ["szl-lambda-gate"],
  SOFTWARE_KERNEL_CARD: [
    "szl-invariants",
    "szl-governed-norm",
    "governed-inference-meter",
    "szl-kernels",
    "szl-blocked",
    "szl-govsign",
    "szl-provctl",
    "szl-nemo",
    "szl-ouroboros",
    "szl-formulas",
    "YARQA-ATTN",
    "szl-receipt-attn",
    "szl-maskmod",
    "szl-block-kv",
    "szl-khipu",
    "szl-khipu-kernels",
  ],
  CARD_ONLY: [
    "a11oy-v19-substrate",
    "SZLHOLDINGS",
    "WILLAY",
    "KILLINCHU-EYE",
    "qantu",
    "waman",
    "chakana",
    "tinku",
    "SZL-Khipu-1.5B-abstain",
    "chaski-r2",
    "szl-training-scripts",
  ],
} as const;

export const OPEN_PR_SUMMARY = [
  { id: "a11oy#1333", merge: "MERGED_AND_VERIFIED", note: "ORO control plane. Squash 23dc4d86 at 01:40:33Z. Now protected a11oy main. Parallel-lane merge, not this operator." },
  { id: "a11oy-net#32", merge: "MERGED_AND_VERIFIED", note: "Recapture after #1412. Squash caca903a at 01:38:51Z. Live /estate/ now serves that snapshot." },
  { id: "szl-khipu#5", merge: "MERGED_AND_VERIFIED", note: "Holographic chrome from lambda-gate-holo. Squash 4b7e6bef at 01:39:33Z." },
  { id: "a11oy#1412", merge: "MERGED_AND_VERIFIED", note: "Register kernel estate organ that import+calls SZL kernels. Squash 4133958a at 01:33:55Z." },
  { id: "a11oy#1405", merge: "MERGED_AND_VERIFIED", note: "Holographic estate cards. Squash 0cc669f8 at 01:31:45Z. Succeeded on product by #1333 honest SHA match." },
  { id: "platform#676", merge: "MERGED_AND_VERIFIED", note: "Replace LUMINA/PARAGON in vendored a11oy brand data. Squash de08cf8e at 01:35:15Z." },
  { id: "szl-forge#70", merge: "MERGED_AND_VERIFIED", note: "CHASKI-R2 Unsloth bf16 LoRA; QLoRA not recommended on Qwen3.5. Squash 1c988e09 at 01:33:06Z. Now forge main." },
  { id: "killinchu#343", merge: "MERGED_AND_VERIFIED", note: "Scope LIVE decision layer and bind HF manifest. Squash 62cb7359 at 01:28:51Z." },
  { id: ".github#480", merge: "MERGED_AND_VERIFIED", note: "Refresh exact Hugging Face organization-card publication. Squash 16c361b4 at 01:27:49Z. Now .github main." },
  { id: "governed-norm-holo#8", merge: "MERGED_AND_VERIFIED", note: "Rebind redacted merge revision publicly. Merged 01:32:19Z." },
  { id: "szl-doctrine#56", merge: "MERGED_AND_VERIFIED", note: "Authorize Governed Norm public rebind. Merged 01:18:34Z." },
  { id: "a11oy#1411", merge: "MERGED_AND_VERIFIED", note: "Cursor Cloud Agent install on main. Merged 01:19:00Z." },
  { id: "a11oy-net#31", merge: "MERGED_AND_VERIFIED", note: "Prior dated snapshot after #1410. Successor is #32 on main." },
  { id: "killinchu#342", merge: "MERGED_AND_VERIFIED", note: "Decision layer LIVE; public actuation SIMULATED; effector operator-owned." },
  { id: "a11oy#1410", merge: "MERGED_AND_VERIFIED", note: "Relock public domains and canonical Space. Squash 6f37a661." },
  { id: ".github#483", merge: "MERGED_AND_VERIFIED", note: "Relock SZLHOLDINGS organization card. Squash-merged 01:42:42Z via auto-merge after checks. No self-approval." },
  { id: ".github#484", merge: "MERGED_AND_VERIFIED", note: "Record public estate alignment. Squash-merged 01:42:42Z via auto-merge after checks. No self-approval." },
  { id: "a11oy-net#34", merge: "MERGED_AND_VERIFIED", note: "Successor recapture after #33. Squash f740dc8a at 01:49:08Z. Live /estate/ serving 01:47Z snapshot. Product honest SHA MATCHES #1333." },
  { id: "a11oy-net#35", merge: "MERGED_AND_VERIFIED", note: "Recapture after #1413 and forge#71. Squash 02fc5005 at 02:08:23Z. Named-N bake-off integers on the proof snapshot." },
  { id: "szl-forge#71", merge: "MERGED_AND_VERIFIED", note: "Named-N JSON-draft and refusal bake-off. Squash a3f982a7 at 01:59:31Z. chaski-r2 3/5 JSON-draft, 6/6 refusal. publication_eligible=false. No Hub PUT." },
  { id: "a11oy#1413", merge: "MERGED_AND_VERIFIED", note: "Normalize Series A freshness labels. Squash 8b8530b6 at 01:58:03Z. Now protected a11oy main. Product honest SHA MATCHES." },
  { id: "szl-khipu#6", merge: "MERGED_AND_VERIFIED", note: "Publish Moons-Nano and MiniEmbed-Nano (.npz + TRAINING_RECEIPT). Squash 3aebb267 at 02:10:35Z. Hub models 38→40." },
  { id: ".github#485", merge: "MERGED_AND_VERIFIED", note: "Qillqaq secret-name read successor. Squash 3a9562cf at 02:23:58Z. Now .github main." },
  { id: "a11oy-net#36", merge: "MERGED_AND_VERIFIED", note: "Recapture after Hub 40 / khipu#6 / .github#485. Squash af4e61ea at 02:26:36Z. Live /estate/ serving 02:25Z snapshot until #37." },
  { id: "a11oy#1414", merge: "MERGED_AND_VERIFIED", note: "Omit unofficial Yahoo misses from finance feed. Squash f9656dd5 at 02:24:48Z. Now protected a11oy main. Product honest SHA MATCHES." },
  { id: "a11oy#1415", merge: "MERGED_AND_VERIFIED", note: "Canonical hf-sync reconciliation trigger. Squash f58d6cd2 at 02:48:36Z. Hub Space git remains a distinct object." },
  { id: "a11oy-net#37", merge: "MERGED_AND_VERIFIED", note: "Recapture after #1414 and #36. Squash eb70f32c at 02:33:50Z. Live /estate/ served 02:30Z until #38." },
  { id: "szl-khipu#7", merge: "MERGED_AND_VERIFIED", note: "Five-organ fail-closed integrity kernel. Squash 615799a8 at 02:35:03Z." },
  { id: "killinchu#344", merge: "MERGED_AND_VERIFIED", note: "Retrigger hf-sync for hung Space probes. Squash a31d39e3 at 03:03:28Z." },
  { id: "szl-forge#72", merge: "MERGED_AND_VERIFIED", note: "CHASKI attempt 5 COMPLETED with Hub MEASURED fail. Squash 42fac35e at 03:12:03Z. publication_eligible stays false." },
  { id: ".github#489", merge: "MERGED_AND_VERIFIED", note: "Enlarge org-card navigation hit regions. Squash 458d8cbe at 03:32:02Z. Now .github main." },
  { id: "a11oy#1423", merge: "MERGED_AND_VERIFIED", note: "Wire five-organ fail-closed kernel onto a-11-oy.com. Squash 83dbdbb2 at 03:50:32Z. Now protected a11oy main. Product honest SHA MATCHES. Live organs/integrity 5/5 LIVE ADVISORY_BODY." },
  { id: "szl-forge#73", merge: "MERGED_AND_VERIFIED", note: "Receipted Unsloth loop + governed bench. Squash-merged 04:06:52Z. GGUF remains derived." },
  { id: "a11oy-net#38", merge: "MERGED_AND_VERIFIED", note: "Recapture after five-organ kernel and Hub 29. Squash a3cd1a69 at 03:58:43Z. Live /estate/ serving 03:54Z snapshot." },
  { id: ".github#490", merge: "BLOCKED", note: "Packet-5 snapshot. Native DCO failed. Auto-merge will not bypass a red required check." },
  { id: "a11oy#1421", merge: "BLOCKED", note: "Touch targets + Hub manifest. Required checks red (S7, contract, receipt UDS, HF admission). Conservative hold. No self-approval." },
  { id: "szl-khipu#8", merge: "BLOCKED", note: "Forty Hub cards + kernel smokes. test (3.11) FAILURE. Not merged." },
  { id: ".github#465", merge: "SUPERSEDED", note: "Closed unmerged. Secret-name health FAILURE. Successor is .github#485 on main." },
  { id: "a11oy-net#23", merge: "SUPERSEDED", note: "Closed unmerged 01:23:34Z. Investor smoke stayed red until S7 bind." },
  { id: "a11oy#1393", merge: "SUPERSEDED", note: "Closed unmerged. Strip KORA/LUMINA/PARAGON — vendor-sync FAILURE. Successor is platform#676 on main." },
] as const;

export const COMPETITOR_PRINCIPLES = [
  {
    name: "Palantir AIP",
    principle: "Human checkpoints and ontology-bound actions sit inside the operational workflow.",
    szl: "Every action is a typed object: Signal → Proposal → Policy → Human bind → Effect → Receipt → Verify. Original khipu graph, not a vendor object model.",
  },
  {
    name: "Microsoft Foundry Agent Service",
    principle: "Unify hosting, identity, tracing, evaluation, and monitoring around the agent lifecycle.",
    szl: "One lifecycle plane: propose, build, test, review, deploy, observe, approve, retire. Exact SHA and Hub revision on every stage.",
  },
  {
    name: "Google Gemini Enterprise Agent Platform",
    principle: "Present build, scale, govern, and optimize as one platform with registry and operations.",
    szl: "Generated estate registry. Counts come from live inventory. Trajectory evaluation, not final-text scores.",
  },
  {
    name: "Amazon Bedrock AgentCore",
    principle: "Deterministic policy lives outside the probabilistic agent, with runtime-level observability.",
    szl: "Independent policy gate the proposer cannot bypass. Deny and refuse are first-class receipts.",
  },
  {
    name: "OpenAI Agents",
    principle: "Offer a controllable primitive and a managed loop, with tracing, guardrails, and approvals.",
    szl: "Guardrail outcomes bind to the receipt chain. Incidents become permanent regression evaluations.",
  },
  {
    name: "NVIDIA NeMo Guardrails",
    principle: "Policy is portable from a local library to production.",
    szl: "Sensitive traces stay off public receipts. Retention and redaction are named contracts, not implied.",
  },
  {
    name: "Anduril Lattice",
    principle: "Operator-centered sensor fusion under human supervision.",
    szl: "Killinchu demos use simulated tracks. Effectors stay ADVISORY until an authorized path is proved.",
  },
  {
    name: "LangSmith",
    principle: "Production traces become debugging and evaluation datasets.",
    szl: "Receipt traces feed regression sets and release admission. A receipt is not a benchmark.",
  },
  {
    name: "Arize Phoenix",
    principle: "Open telemetry conventions and an inspect-improve-evaluate loop.",
    szl: "Export receipts through open schemas. Compare evaluations over exact builds.",
  },
  {
    name: "CrewAI",
    principle: "Make orchestration, state, memory, guardrails, and observability navigable.",
    szl: "Contributor funnel: clone, test, governed action, offline verify. No duplicate proprietary UX.",
  },
] as const;
