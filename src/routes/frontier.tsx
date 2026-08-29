import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { evaluateRelease } from "@/lib/admission";
import {
  BAKEOFF,
  evaluatePublication,
  type BakeoffCandidate,
} from "@/lib/bakeoff";
import { bindLegs, evaluateBind } from "@/lib/identity-bind";
import { useLedger } from "@/lib/ledger-store";

export const Route = createFileRoute("/frontier")({ component: Frontier });

export function Frontier() {
  const receipts = useLedger((s) => s.receipts);
  const evaluation = useMemo(() => evaluateRelease(receipts), [receipts]);
  const [attempted, setAttempted] = useState(false);
  const [picked, setPicked] = useState<BakeoffCandidate>(BAKEOFF.candidates[2]);
  const [putAttempted, setPutAttempted] = useState(false);
  const publication = useMemo(() => evaluatePublication(picked), [picked]);
  const bind = useMemo(() => evaluateBind(), []);
  const [deployAttempted, setDeployAttempted] = useState(false);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker="Admission set · named-N bake-off · identity bind"
        title="Deny becomes the release gate."
        lede="Traces are not a scoreboard. HARD_DENY knots stay on an admission set. Named-N integer counts never flip publication_eligible. Matching GitHub and honest is not a Hub deploy."
        claims={["DEMO", "MODELED", "MEASURED"]}
      />

      <section className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Mini label="Knots in session" value={String(evaluation.knots)} claim="DEMO" />
        <Mini label="Admission cases" value={String(evaluation.deny_knots)} claim="DEMO" />
        <Mini label="chaski-r2 JSON-draft" value="3/5" claim="MEASURED" />
        <Mini label="publication_eligible" value="false" claim="MEASURED" />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-xl border border-line bg-ink-2 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Attempt a DEMO release</p>
          <h2 className="mt-2 font-display text-2xl">
            {evaluation.verdict === "RELEASE_BLOCKED" ? "Blocked. Keep the failure." : "No cases yet."}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-mute">{evaluation.meaning}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="deny"
              disabled={evaluation.verdict === "NO_CASES"}
              onClick={() => setAttempted(true)}
            >
              Attempt release
            </Button>
            <Button asChild variant="secondary">
              <Link to="/command">Mint a deny knot</Link>
            </Button>
          </div>
          {attempted && (
            <p className="mt-4 text-sm text-deny">
              {evaluation.verdict === "RELEASE_BLOCKED"
                ? "Release refused. The admission set is the evaluation. Train loss is not."
                : "Empty set is not a pass. Bind a deny on Command, then retry."}
            </p>
          )}
        </article>

        <article className="rounded-xl border border-line p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Why this is a frontier</p>
          <ul className="mt-3 space-y-3 text-sm text-mute">
            <li>
              <span className="text-bone">Bedrock principle.</span> Policy sits outside the proposer. Deny
              is a first-class receipt, not a log line.
            </li>
            <li>
              <span className="text-bone">LangSmith principle.</span> Production traces become the
              evaluation dataset. A receipt is not a benchmark.
            </li>
            <li>
              <span className="text-bone">OpenAI principle.</span> Incidents stay as permanent regression
              cases. They block release instead of being cleared.
            </li>
          </ul>
        </article>
      </section>

      <section className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">
          Named-N bake-off · forge#71 · {BAKEOFF.revision.slice(0, 8)}
        </p>
        <h2 className="mt-2 font-display text-3xl">Integer counts. Never SOTA. Never a Hub PUT.</h2>
        <p className="mt-3 max-w-2xl text-sm text-mute">{BAKEOFF.claim_boundary}</p>

        <div className="mt-6 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-ink-2 font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">JSON-draft</th>
                <th className="px-4 py-3">Refusal</th>
                <th className="px-4 py-3">Kind</th>
              </tr>
            </thead>
            <tbody>
              {BAKEOFF.candidates.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-bone">{c.id}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {c.json_draft_valid}/{c.json_draft_total}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {c.adversarial_refused}/{c.adversarial_total}
                  </td>
                  <td className="px-4 py-3 text-mute">{c.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <article className="mt-6 rounded-xl border border-line bg-ink-2 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Attempt Hub PUT</p>
          <h3 className="mt-2 font-display text-2xl">{publication.verdict.replaceAll("_", " ")}</h3>
          <p className="mt-3 text-sm text-mute">{publication.meaning}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {BAKEOFF.candidates.map((c) => (
              <Button
                key={c.id}
                variant={picked.id === c.id ? "secondary" : "ghost"}
                onClick={() => {
                  setPicked(c);
                  setPutAttempted(false);
                }}
              >
                {c.id}
              </Button>
            ))}
          </div>
          <div className="mt-4">
            <Button
              variant="deny"
              onClick={() => setPutAttempted(true)}
            >
              Attempt Hub PUT
            </Button>
          </div>
          {putAttempted && (
            <p className="mt-4 text-sm text-deny">
              Refused. {publication.verdict === "INCOMPLETE_GATES"
                ? "Named-N is incomplete. Hub write stays closed."
                : "Even a full named-N does not flip publication_eligible. No Hub PUT."}
            </p>
          )}
        </article>
      </section>

      <section className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">
          Identity bind · GitHub · honest · Hub Space git
        </p>
        <h2 className="mt-2 font-display text-3xl">Two legs matching is not a deploy.</h2>
        <p className="mt-3 max-w-2xl text-sm text-mute">
          Product honest git_sha currently MATCHES protected a11oy main. The Hub Space git object is
          a distinct projection, not a GitHub commit. Canonical hf-sync reconciliation is a11oy#1415.
          A deploy claim fail-closes until that bind exists. This DEMO never issues one.
        </p>
        <div className="mt-6 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-ink-2 font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
              <tr>
                <th className="px-4 py-3">Leg</th>
                <th className="px-4 py-3">SHA</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">GitHub commit</th>
              </tr>
            </thead>
            <tbody>
              {bindLegs().map((leg) => (
                <tr key={leg.id} className="border-t border-line">
                  <td className="px-4 py-3 font-mono text-bone">{leg.id}</td>
                  <td className="px-4 py-3 font-mono text-[11px] tabular-nums">{leg.sha.slice(0, 12)}</td>
                  <td className="px-4 py-3 text-mute">{leg.namespace}</td>
                  <td className="px-4 py-3 font-mono text-[11px]">{leg.is_github_commit ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <article className="mt-6 rounded-xl border border-line bg-ink-2 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Attempt deploy claim</p>
          <h3 className="mt-2 font-display text-2xl">{bind.verdict.replaceAll("_", " ")}</h3>
          <p className="mt-3 text-sm text-mute">{bind.meaning}</p>
          <div className="mt-4">
            <Button variant="deny" onClick={() => setDeployAttempted(true)}>
              Attempt deploy claim
            </Button>
          </div>
          {deployAttempted && (
            <p className="mt-4 text-sm text-deny">
              Refused. deploy_claim stays false. Honest matching GitHub does not bind the Hub Space
              git object. a11oy#1415 is the reconciliation receipt, not this lab.
            </p>
          )}
        </article>
      </section>

      <section className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Admission cases</p>
        {evaluation.cases.length === 0 ? (
          <p className="mt-4 max-w-2xl text-sm text-mute">
            Empty. Deny a PII export or a public-space evidence delete on{" "}
            <Link to="/command" className="text-steel hover:text-bone">
              Command
            </Link>
            . Those knots land here and stay.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="bg-ink-2 font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
                <tr>
                  <th className="px-4 py-3">Case</th>
                  <th className="px-4 py-3">Tool</th>
                  <th className="px-4 py-3">Policy</th>
                  <th className="px-4 py-3">Digest</th>
                </tr>
              </thead>
              <tbody>
                {evaluation.cases.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <p className="font-mono text-[11px] text-steel">{c.issued_at}</p>
                      <p className="text-bone">{c.resource}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">{c.tool}</td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-[11px] text-steel">{c.policy_id}</p>
                      <p className="text-mute">{c.policy_reason}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] break-all text-mute">{c.digest.slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-8 text-sm text-mute">
        Signer class is WEBCRYPTO_HMAC_DEMO. This page is unpublished with the rest of the lab. The
        public proof snapshot stays on{" "}
        <a href="https://a11oy.net/estate/" className="text-steel hover:text-bone">
          a11oy.net/estate/
        </a>
        . Bake-off source is{" "}
        <a
          href="https://github.com/szl-holdings/szl-forge/pull/71"
          className="text-steel hover:text-bone"
          target="_blank"
          rel="noreferrer"
        >
          szl-forge#71
        </a>
        . Identity bind residual is{" "}
        <a
          href="https://github.com/szl-holdings/a11oy/pull/1415"
          className="text-steel hover:text-bone"
          target="_blank"
          rel="noreferrer"
        >
          a11oy#1415
        </a>
        .
      </p>
    </main>
  );
}

function Mini({
  label,
  value,
  claim,
}: {
  label: string;
  value: string;
  claim: "DEMO" | "MEASURED";
}) {
  return (
    <div className="bg-ink px-5 py-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">{label}</p>
      <p className="mt-2 font-display text-2xl text-bone">{value}</p>
      <div className="mt-2">
        <Badge tone={claim === "MEASURED" ? "allow" : "hold"}>{claim}</Badge>
      </div>
    </div>
  );
}
