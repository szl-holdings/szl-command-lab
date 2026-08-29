import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CANONICAL_ENTRIES } from "@/lib/census";

export const Route = createFileRoute("/contribute")({ component: Contribute });

const STEPS = [
  {
    n: "01",
    title: "Find the canonical repository",
    body: "Start with a11oy for the product, killinchu for the vertical, szl-forge for training source. Everything else is classified in the generated registry.",
  },
  {
    n: "02",
    title: "Clone and bootstrap",
    body: "Target: under ten minutes on a clean machine. Use the repository’s documented lockfile. Do not assume Replit.",
  },
  {
    n: "03",
    title: "Run tests and one local product path",
    body: "A green unit matrix is not a hosted gate. Still run it before opening a PR.",
  },
  {
    n: "04",
    title: "Execute one governed action",
    body: "In this demo, bind Approve or Deny on the Command gate. In source, call a policy-wrapped tool.",
  },
  {
    n: "05",
    title: "Verify the receipt offline",
    body: "Tamper one field. Verification must fail. Restore the original. It must pass. Download the packet.",
  },
  {
    n: "06",
    title: "Read the contract",
    body: "Architecture, issue taxonomy, versioning, security reporting, DCO, signatures, release, and where help is needed — then open a narrow PR from current protected main.",
  },
];

const ISSUES = [
  {
    title: "Safe republish of quarantined kernels",
    repo: "szl-kernels / Hub cards",
    why: "model.joblib is gone (remaining=0). Republish ONNX or SafeTensors with source pin — do not call that training.",
  },
  {
    title: "Signed successor for a11oy#1368",
    repo: "a11oy",
    why: "Read-only inventory is a candidate but MERGE_STATE_BLOCKED. Recreate with GitHub-verified committer on current main c038cc95.",
  },
  {
    title: "UI cluster successor",
    repo: "a11oy",
    why: "1391/1393/1395/1405 collide. One current-main branch for honest empty states and lexicon cleanup. Keep 1363 HOLD.",
  },
  {
    title: "Claim language cleanup",
    repo: "docs-site, founder-page, killinchu",
    why: "Replace production-ready / fully autonomous / defeat language with MEASURED, MODELED, RESEARCH, or ROADMAP.",
  },
  {
    title: "WILLAY dataset + bakeoff",
    repo: "szl-forge / Hub",
    why: "Highest-value next trained model, but rights, exact revisions, image digest, and cost cap are unbound. Training stays fail-closed.",
  },
];

export function Contribute() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker="Contributor machine"
        title="A clean machine, six steps."
        lede="Good-first issues below are tied to real gaps from this recapture. Decorative labels are not used. Bootstrap times on contributor laptops are ROADMAP until measured on a clean image."
        claims={["DEMO", "ROADMAP"]}
      />

      <ol className="mt-10 grid gap-3">
        {STEPS.map((step) => (
          <li key={step.n} className="rounded-xl border border-line bg-ink-2 p-5 sm:grid sm:grid-cols-[4rem_1fr] sm:gap-6">
            <p className="font-mono text-[11px] text-steel">{step.n}</p>
            <div>
              <h2 className="font-display text-2xl">{step.title}</h2>
              <p className="mt-2 text-sm text-mute">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/command">Step 04 — governed action</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/verify">Step 05 — verify offline</Link>
        </Button>
      </div>

      <section className="mt-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Where to land</p>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {CANONICAL_ENTRIES.map((entry) => (
            <li key={entry.name} className="flex items-baseline justify-between gap-4 py-3">
              <div>
                <p>{entry.name}</p>
                <p className="text-sm text-mute">{entry.role}</p>
              </div>
              <a className="font-mono text-[11px] text-steel hover:text-bone" href={entry.href} target="_blank" rel="noreferrer">
                clone
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Good first issues — real gaps</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {ISSUES.map((issue) => (
            <article key={issue.title} className="rounded-xl border border-line p-5">
              <h3 className="font-display text-2xl">{issue.title}</h3>
              <p className="mt-1 font-mono text-[11px] text-steel">{issue.repo}</p>
              <p className="mt-3 text-sm text-mute">{issue.why}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
