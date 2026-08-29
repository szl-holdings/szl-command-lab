export const PUBLISH_CAPTURED_AT = "2026-08-29T05:04:00Z";

export const ORIGINS = [
  {
    host: "a-11-oy.com",
    role: "Product runtime",
    status: "LIVE",
    claim: "MEASURED" as const,
    href: "https://a-11-oy.com",
    note: "Hugging Face Space SZLHOLDINGS/a11oy. Honest git_sha is 83dbdbb2 (#1423 five-organ kernel). Protected a11oy main is 83dbdbb2 (#1423). They currently MATCH. Live /api/a11oy/v1/organs/integrity is 5/5 LIVE, ADVISORY_BODY, energy UNAVAILABLE. Lean-8 locked_formula_count=8. Hub Space git 7ef7a0a0 is a distinct object.",
  },
  {
    host: "a11oy.net",
    role: "Proof registry",
    status: "LIVE",
    claim: "MEASURED" as const,
    href: "https://a11oy.net",
    note: "GitHub Pages from szl-holdings/a11oy-net. RECORD, diligence, /estate/. Recapture this run stamps 85 repos, 0 open PRs, Hub 40/28/34. No receipt store. Do not merge hosts.",
  },
  {
    host: "huggingface.co/SZLHOLDINGS",
    role: "Public artifact registry",
    status: "LIVE",
    claim: "MEASURED" as const,
    href: "https://huggingface.co/SZLHOLDINGS",
    note: "40 models, 28 datasets, 35 spaces. remaining_joblib=0. Hub CLI write from this lab UNAVAILABLE. Canonical GitHub publishers: szl-atelier SUCCESS, immune SUCCESS, ayllu SUCCESS. szl-khipu publish-hf still requires HF_ORG_TOKEN on that repo. Training stays fail-closed.",
  },
  {
    host: "this preview",
    role: "Unpublished DEMO lab",
    status: "NOT_PUBLISHED",
    claim: "DEMO" as const,
    href: "/",
    note: "Grok Build SPA. DEMO HMAC receipts. Not a fourth public origin. Fold MEASURED tables into a11oy.net; keep /command and /verify off Proof.",
  },
  {
    host: "a11oy.com",
    role: "Not SZL",
    status: "FOREIGN",
    claim: "MEASURED" as const,
    href: "https://a11oy.com",
    note: "Cloudways storefront titled Alloy Home and Garden. Doctrine: never a11oy.com. Do not point product or proof here.",
  },
] as const;

export const RECOMMENDATION = {
  verdict: "Keep Product | Proof. Fold MEASURED inventory into a11oy.net. Do not publish this preview as a fourth public origin.",
  keep_separate: [
    "a-11-oy.com remains the command center and interactive /verify.",
    "a11oy.net remains RECORD, diligence, Hub atlas, and the /estate/ snapshot.",
    "This preview stays DEMO: policy gate, khipu, tamper loop, PR graph, admission set.",
  ],
  never: [
    "Never merge Product and Proof onto one host.",
    "Never use a11oy.com as canonical.",
    "Never clone /verify onto a11oy.net.",
    "Never force-merge HOLD, draft, dirty, or failed-check pull requests.",
  ],
} as const;
