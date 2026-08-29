export type BindVerdict = "INCOMPLETE" | "HONEST_DIVERGED" | "HUB_PROJECTION_UNBOUND";

export type BindLeg = {
  id: "github_main" | "product_honest" | "hub_space_git";
  sha: string;
  namespace: "github" | "product" | "huggingface_space";
  is_github_commit: boolean;
};

export type BindEvaluation = {
  verdict: BindVerdict;
  evidence_class: "MEASURED";
  meaning: string;
  github_equals_honest: boolean;
  hub_is_github_commit: boolean;
  deploy_claim: false;
};

export const IDENTITY_BIND = {
  captured_at: "2026-08-29T03:54:00Z",
  github_main: "83dbdbb2269145c476d56d7d4dc6a54a60a77314",
  product_honest: "83dbdbb2269145c476d56d7d4dc6a54a60a77314",
  hub_space_git: "7ef7a0a01178fc89afbf7c04654fa4311d9e9612",
  hub_space_git_is_github_commit: false,
  reconcile_pr: "a11oy#1415",
  reconcile_open: false,
  claim_boundary:
    "GitHub source and product honest git_sha may match while the Hub Space git object remains a distinct projection. Matching two legs is not a deploy claim. #1415 merged; Space git is still not a GitHub commit.",
} as const;

export function bindLegs(): BindLeg[] {
  return [
    {
      id: "github_main",
      sha: IDENTITY_BIND.github_main,
      namespace: "github",
      is_github_commit: true,
    },
    {
      id: "product_honest",
      sha: IDENTITY_BIND.product_honest,
      namespace: "product",
      is_github_commit: true,
    },
    {
      id: "hub_space_git",
      sha: IDENTITY_BIND.hub_space_git,
      namespace: "huggingface_space",
      is_github_commit: IDENTITY_BIND.hub_space_git_is_github_commit,
    },
  ];
}

export function evaluateBind(): BindEvaluation {
  const github: string = IDENTITY_BIND.github_main;
  const honest: string = IDENTITY_BIND.product_honest;
  const hub: string = IDENTITY_BIND.hub_space_git;
  if (!github || !honest || !hub) {
    return {
      verdict: "INCOMPLETE",
      evidence_class: "MEASURED",
      meaning: "A missing identity leg is not a deploy. Incomplete bind fail-closes.",
      github_equals_honest: Boolean(github) && github === honest,
      hub_is_github_commit: false,
      deploy_claim: false,
    };
  }
  if (github !== honest) {
    return {
      verdict: "HONEST_DIVERGED",
      evidence_class: "MEASURED",
      meaning: `Product honest ${honest.slice(0, 8)} diverges from protected main ${github.slice(0, 8)}. Runtime is not source-bound.`,
      github_equals_honest: false,
      hub_is_github_commit: IDENTITY_BIND.hub_space_git_is_github_commit,
      deploy_claim: false,
    };
  }
  return {
    verdict: "HUB_PROJECTION_UNBOUND",
    evidence_class: "MEASURED",
    meaning: `GitHub and honest MATCH at ${github.slice(0, 8)} (#1423). Hub Space git ${hub.slice(0, 8)} is not a GitHub commit. ${IDENTITY_BIND.reconcile_pr} merged; the Space git object remains a distinct projection. Not a deploy claim.`,
    github_equals_honest: true,
    hub_is_github_commit: false,
    deploy_claim: false,
  };
}
