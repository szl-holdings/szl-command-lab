import { createFileRoute } from "@tanstack/react-router";
import { ClaimChip } from "@/components/claim-chip";
import { PageHeader } from "@/components/page-header";
import { CAPTURED_AT, CONTROLLER_SHA, GITHUB, HF } from "@/lib/census";
import { shortSha } from "@/lib/utils";

export const Route = createFileRoute("/provenance")({ component: Provenance });

const STEPS = [
  {
    n: "01",
    title: "Protected source",
    body: "a11oy main, recaptured. This is the product source SHA, not a Hub revision and not this demo surface.",
    value: GITHUB.a11oy_main,
    claim: "MEASURED" as const,
    href: `https://github.com/szl-holdings/a11oy/commit/${GITHUB.a11oy_main}`,
  },
  {
    n: "02",
    title: "Platform main",
    body: "Monorepo protected head at the same recapture. Adjacent PRs still target an older base.",
    value: GITHUB.platform_main,
    claim: "MEASURED" as const,
    href: `https://github.com/szl-holdings/platform/commit/${GITHUB.platform_main}`,
  },
  {
    n: "03",
    title: "Estate census digest",
    body: "SHA-256 of the GitHub inventory JSON written at recapture. Drift from the 63-repo anchor is recorded, not hidden.",
    value: GITHUB.census_sha256,
    claim: "MEASURED" as const,
    href: "/data/github-census.json",
  },
  {
    n: "04",
    title: "Embedded controller",
    body: "Payload controller, byte-verified. Audit and merge gates run from this exact file.",
    value: CONTROLLER_SHA,
    claim: "MEASURED" as const,
    href: null,
  },
];

export function Provenance() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker="Demo 03 · Source to runtime"
        title="Source SHA, then digest, then this surface."
        lede="A reachable preview is not a production deployment. This page binds the recapture clock to the exact heads it measured. It does not claim a-11-oy.com or a Hugging Face Space is serving these bytes."
        claims={["DEMO", "MEASURED"]}
      />

      <ol className="mt-10 grid gap-3">
        {STEPS.map((step) => (
          <li key={step.n} className="rounded-xl border border-line bg-ink-2 p-5 sm:grid sm:grid-cols-[4rem_1fr] sm:gap-6">
            <p className="font-mono text-[11px] text-steel">{step.n}</p>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl">{step.title}</h2>
                <ClaimChip kind={step.claim} />
              </div>
              <p className="mt-2 text-sm text-mute">{step.body}</p>
              {step.href ? (
                <a
                  className="mt-3 block break-all font-mono text-[11px] text-steel hover:text-bone"
                  href={step.href}
                  target={step.href.startsWith("http") ? "_blank" : undefined}
                  rel={step.href.startsWith("http") ? "noreferrer" : undefined}
                >
                  {step.value}
                </a>
              ) : (
                <p className="mt-3 break-all font-mono text-[11px] text-steel">{step.value}</p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <Marker label="Recapture" value={CAPTURED_AT} note="UTC snapshot" />
        <Marker label="HF CLI" value={HF.hf_cli} note="Authenticated Hub writes blocked" />
        <Marker
          label="Rollback"
          value={shortSha(GITHUB.a11oy_main, 6)}
          note="Prior census 16:32Z used a11oy 92b3f679. Revert the inventory files, not main."
        />
      </section>

      <p className="mt-8 max-w-2xl text-sm text-mute">
        Signer class on knots minted here is WEBCRYPTO_HMAC_DEMO. Founder-page copy that every
        interaction mints a DSSE-signed Khipu receipt is not true of this surface. Qualify that claim
        until production signing authority is present.
      </p>
    </main>
  );
}

function Marker({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="rounded-xl border border-line p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">{label}</p>
      <p className="mt-2 break-all font-mono text-sm text-bone">{value}</p>
      <p className="mt-2 text-sm text-mute">{note}</p>
    </article>
  );
}
