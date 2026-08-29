import { CAPTURED_AT, CATEGORY, GITHUB, HF } from "./census";

export function publicPacket(): string {
  return [
    "SZL Holdings — governed decision infrastructure.",
    "Control before action. Evidence after.",
    CATEGORY,
    "",
    "Products",
    "- a11oy (command): https://a-11-oy.com",
    "- Killinchu (intelligence): detection, classification, and governed decisions are LIVE. Public physical actuation is SIMULATED. Real effector engagement is operator-owned.",
    "",
    "Proof: https://a11oy.net",
    "Artifacts: https://huggingface.co/SZLHOLDINGS",
    "Source: https://github.com/szl-holdings",
    "",
    `MEASURED ${CAPTURED_AT}`,
    `- GitHub szl-holdings: ${GITHUB.org} repositories (${GITHUB.public} public). Anchor was ${GITHUB.expected_org}.`,
    `- Open pull requests: ${GITHUB.open_prs}. Merge-qualified this recapture: ${GITHUB.merge_qualified}.`,
    `- Hub: ${HF.models} models / ${HF.datasets} datasets / ${HF.spaces} spaces. remaining_joblib=${HF.joblib_still_present}.`,
    `- Product honest git_sha: ${GITHUB.product_honest_sha.slice(0, 8)} (#1423). Protected a11oy main: ${GITHUB.a11oy_main.slice(0, 8)} (#1423). They currently MATCH.`,
    "- Five-organ kernel LIVE on product: 5/5 organs, ADVISORY_BODY, energy UNAVAILABLE, proven_trust=false.",
    "- CHASKI named-N bake-off (forge#71/#72): chaski-r2 3/5 JSON-draft, 6/6 refusal. Attempt 5 Hub MEASURED fail. publication_eligible=false. Not SOTA.",
    "- Hub nanos: MiniEmbed-Nano and Moons-Nano (.npz research with TRAINING_RECEIPT, not safetensors).",
    "- Hub Space git 7ef7a0a0 is not a GitHub commit. Matching GitHub and honest is not a deploy claim.",
    "- Newest public repos this recapture: nexus, szl-organ-integrity.",
    "- Λ uniqueness is Conjecture 1 — not a theorem.",
    "- Never a11oy.com (foreign home-and-garden storefront).",
    "",
    "This packet is MEASURED inventory plus DEMO lab copy. It is not revenue, authorization, or a fourth public origin.",
  ].join("\n");
}
