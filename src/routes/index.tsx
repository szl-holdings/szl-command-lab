import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ClaimChip } from "@/components/claim-chip";
import { Hologram } from "@/components/hologram";
import { KhipuLedger } from "@/components/khipu-ledger";
import { LiveStrip, useLiveEstate } from "@/components/live-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CANONICAL_ENTRIES, CAPTURED_AT, CATEGORY, GITHUB, HF } from "@/lib/census";
import { ORIGINS, RECOMMENDATION } from "@/lib/publish";
import { useLedger } from "@/lib/ledger-store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const receipts = useLedger((s) => s.receipts);
  const { estate } = useLiveEstate();
  const liveOrgans = estate?.kernel.organs.length ? estate.kernel.organs : undefined;

  return (
    <main>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 pt-12 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] sm:px-6 sm:pt-16">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ClaimChip kind="DEMO" />
            <ClaimChip kind="MEASURED" />
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-mute">
              Recapture {CAPTURED_AT}
            </span>
          </div>
          <h1 className="mt-6 max-w-3xl font-display text-5xl leading-tight tracking-tight text-bone sm:text-6xl">
            Policy before action.
            <span className="mt-2 block italic text-steel">The body is the hologram.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-mute">{CATEGORY}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link to="/command">Run demo</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/formulas">Locked-8 formulas</Link>
            </Button>
            <Link to="/organs" className="inline-flex min-h-11 items-center gap-1 text-sm text-steel hover:text-bone">
              Open the organs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-6 max-w-2xl text-sm text-mute">{RECOMMENDATION.verdict}</p>
        </div>
        <div className="flex flex-col gap-4">
          <LiveStrip />
          <Hologram
            organs={liveOrgans}
            title="SZL organism"
            caption={
              estate
                ? `${estate.kernel.live_count}/5 Hub kernel. Energy channel ${estate.kernel.energy.channel}. Joule ${estate.kernel.energy.honesty}. Not a 3D rehost of the product atlas.`
                : "Five organs. Locked-8 formulas. Energy channel LIVE. Joule UNAVAILABLE. Not a 3D rehost of the product atlas."
            }
          />
        </div>
      </section>

      <section className="border-y border-line">
        <div className="mx-auto grid max-w-6xl gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {ORIGINS.filter((o) => o.host !== "a11oy.com").map((origin) => (
            <article key={origin.host} className="bg-ink px-5 py-6">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">{origin.role}</p>
              <p className="mt-2 font-display text-2xl">{origin.host}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={origin.status === "LIVE" ? "allow" : "hold"}>{origin.status.replaceAll("_", " ")}</Badge>
                <ClaimChip kind={origin.claim} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-b border-line bg-ink-2">
        <div className="mx-auto grid max-w-6xl gap-px bg-line sm:grid-cols-4">
          <Stat label="GitHub repositories" value={GITHUB.org} claim="MEASURED" note={`anchor was ${GITHUB.expected_org}`} />
          <Stat label="Open pull requests" value={GITHUB.open_prs} claim="MEASURED" note={`${GITHUB.merge_qualified} merge-qualified this recapture`} />
          <Stat label="HF models" value={HF.models} claim="MEASURED" note={`${HF.joblib_still_present} still ship joblib`} />
          <Stat label="HF Spaces" value={HF.spaces} claim="MEASURED" note="running ≠ ready" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-mute">Two products first</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <ProductCard
            name="a11oy"
            kicker="Command"
            body="Governed-agent command and evidence platform. The model proposes. Independent policy decides. A human binds the receipt. Nothing self-authorizes."
            to="/command"
            href="https://github.com/szl-holdings/a11oy"
          />
          <ProductCard
            name="Killinchu"
            kicker="Intelligence"
            body="Bounded drones and maritime decision intelligence. Detection, classification, and governed decisions are LIVE. Public physical actuation is SIMULATED. Effectors are operator-owned."
            to="/killinchu"
            href="https://github.com/szl-holdings/killinchu"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-mute">Four five-minute demos</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DemoCard
            n="01"
            title="Run the body"
            body="A proposal hits independent policy and the five-organ hologram. HARD_DENY knots itself. Humans still bind anything else."
            to="/command"
          />
          <DemoCard
            n="02"
            title="Tamper and verify"
            body="Alter one field on a receipt. Offline verification fails deterministically. Restore the original and it passes."
            to="/verify"
          />
          <DemoCard
            n="03"
            title="Deny becomes the gate"
            body="HARD_DENY knots stay on an admission set. Named-N integers never flip publication_eligible. Matching GitHub and honest is not a Hub deploy."
            to="/frontier"
          />
          <DemoCard
            n="04"
            title="The body is the gate"
            body="Injure HEART, YAWAR, or WILLAY. The body fail-closes. Five LIVE organs still cannot authorize — proven_trust stays false."
            to="/organs"
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-mute">Session khipu</p>
          <h2 className="mt-3 font-display text-3xl">Knots you mint stay on this machine.</h2>
          <p className="mt-3 max-w-lg text-mute">
            Each knot is a DEMO receipt: SHA-256 of canonical JSON plus an HMAC that is
            explicitly not the production DSSE signer. The visualization is original SZL —
            a khipu, not a vendor swimlane.
          </p>
          <div className="mt-6">
            <KhipuLedger receipts={receipts} />
          </div>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-mute">Canonical entries</p>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {CANONICAL_ENTRIES.map((entry) => (
              <li key={entry.name} className="flex items-baseline justify-between gap-4 py-3">
                <div>
                  <p className="font-medium text-bone">{entry.name}</p>
                  <p className="text-sm text-mute">{entry.role}</p>
                </div>
                <a
                  className="shrink-0 font-mono text-xs text-steel hover:text-bone"
                  href={entry.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  source
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line bg-ink-2">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-mute">Frontier — original, not copied</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Frontier
              title="Inspectable action ontology"
              body="Signal → proposal → policy → human bind → effect → receipt → verify. Original khipu objects. The proposer never authors the decision."
              to="/trajectory"
            />
            <Frontier
              title="Lifecycle plane"
              body="Propose, build, test, review, deploy, observe, approve, retire — one identity per stage, honest UNAVAILABLE where proof is missing."
              to="/lifecycle"
            />
            <Frontier
              title="Public identity packet"
              body="Copy MEASURED facts. Point people at a-11-oy.com, a11oy.net, and Hugging Face. Famous is a receipt, not a slogan."
              to="/identity"
            />
            <Frontier
              title="Five-organ kernel"
              body="Any DOWN organ fail-closes the body. 5/5 LIVE is advisory. Energy UNAVAILABLE. Not a 3D rehost."
              to="/organs"
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  claim,
  note,
}: {
  label: string;
  value: number;
  claim: "MEASURED";
  note: string;
}) {
  return (
    <div className="bg-ink-2 px-5 py-6">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums text-bone">{value}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ClaimChip kind={claim} />
        <span className="text-xs text-faint">{note}</span>
      </div>
    </div>
  );
}

function ProductCard({
  name,
  kicker,
  body,
  to,
  href,
}: {
  name: string;
  kicker: string;
  body: string;
  to: "/command" | "/killinchu";
  href: string;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-line bg-ink-2 p-5">
      <Badge tone="steel">{kicker}</Badge>
      <h2 className="mt-4 font-display text-4xl">{name}</h2>
      <p className="mt-3 flex-1 text-mute">{body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to={to}>
            Enter <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <a href={href} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </Button>
      </div>
    </article>
  );
}

function DemoCard({
  n,
  title,
  body,
  to,
}: {
  n: string;
  title: string;
  body: string;
  to: "/command" | "/verify" | "/frontier" | "/organs";
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-xl border border-line bg-ink p-5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-ink-2"
    >
      <span className="font-mono text-xs text-steel">{n}</span>
      <h3 className="mt-3 font-display text-2xl">{title}</h3>
      <p className="mt-2 flex-1 text-sm text-mute">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm text-bone">
        Run demo <ArrowRight className="h-4 w-4 transition-transform duration-[var(--motion-quick)] group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Frontier({ title, body, to }: { title: string; body: string; to: "/trajectory" | "/lifecycle" | "/identity" | "/organs" }) {
  return (
    <Link to={to} className="group rounded-xl border border-line bg-ink p-5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-ink-3">
      <h3 className="font-display text-2xl">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-mute">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm text-bone">
        Open <ArrowRight className="h-4 w-4 transition-transform duration-[var(--motion-quick)] group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
