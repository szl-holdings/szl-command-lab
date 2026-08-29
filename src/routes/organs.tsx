import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClaimChip } from "@/components/claim-chip";
import { Hologram } from "@/components/hologram";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveStrip, useLiveEstate } from "@/components/live-strip";
import {
  evaluateAnatomy,
  evaluateAuthorization,
  HEALTHY_FLAGS,
  TAMPER_CONTROLS,
  type AnatomyEval,
  type TamperFlags,
} from "@/lib/organs";

export const Route = createFileRoute("/organs")({ component: Organs });

export function Organs() {
  const [flags, setFlags] = useState<TamperFlags>(HEALTHY_FLAGS);
  const [body, setBody] = useState<AnatomyEval | null>(null);
  const [attempted, setAttempted] = useState(false);
  const { estate } = useLiveEstate();
  const tampered = Object.values(flags).some(Boolean);
  const hologramOrgans = tampered ? body?.organs : (estate?.kernel.organs.length ? estate.kernel.organs : body?.organs);

  useEffect(() => {
    let cancelled = false;
    setAttempted(false);
    void evaluateAnatomy(flags).then((ev) => {
      if (!cancelled) setBody(ev);
    });
    return () => {
      cancelled = true;
    };
  }, [flags]);

  const auth = body ? evaluateAuthorization(body) : null;
  const pulse = body?.blocked ? "deny" : "idle";
  const down = body?.organs.find((organ) => organ.status === "DOWN");

  function toggle(id: keyof TamperFlags) {
    setFlags((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker="Five-organ fail-closed kernel"
        title="The body is the gate."
        lede="HEART, BRAIN, CIRCULATORY, NERVOUS, SKELETON. Any DOWN organ or a WILLAY veto fail-closes. Five LIVE organs are still advisory. The hologram is the same kernel the product maps."
        claims={["DEMO", "MEASURED", "CONJECTURE"]}
      />
      <div className="mt-6">
        <LiveStrip />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Hologram
          organs={hologramOrgans}
          pulse={pulse}
          activeOrgan={down?.id ?? null}
          caption={
            tampered
              ? (body?.reason ?? "Evaluating DEMO tamper.")
              : (estate?.kernel.reason ?? body?.reason ?? "Evaluating.")
          }
        />
        <article className="rounded-xl border border-line bg-ink-2 p-5">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">
            {tampered ? "DEMO tamper · this preview" : "Injure a DEMO organ"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {TAMPER_CONTROLS.map((control) => (
              <Button
                key={control.id}
                variant={flags[control.id] ? "deny" : "secondary"}
                onClick={() => toggle(control.id)}
                aria-pressed={flags[control.id]}
              >
                {control.label}
                <span className="font-mono text-xs text-mute">{control.organ}</span>
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setFlags(HEALTHY_FLAGS)}>
              Restore body
            </Button>
          </div>
          <h2 className="mt-6 font-display text-2xl">
            {auth ? auth.verdict.replaceAll("_", " ") : "Evaluating"}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-mute">{auth?.meaning ?? body?.reason}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="deny" disabled={!body} onClick={() => setAttempted(true)}>
              Attempt authorize
            </Button>
            <Button asChild variant="secondary">
              <Link to="/command">Run a proposal through it</Link>
            </Button>
          </div>
          {attempted && auth && (
            <p className="mt-4 text-sm text-deny">
              Refused. authorized=false. {auth.verdict === "BODY_BLOCKED"
                ? "A DOWN organ or WILLAY veto is the evaluation."
                : "A healthy advisory body is not a production grant."}
            </p>
          )}
        </article>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(body?.organs ?? []).map((organ) => (
          <article key={organ.id} className="rounded-xl border border-line bg-ink-2 p-4">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-mute">{organ.quechua}</p>
            <h2 className="mt-1 font-display text-xl">{organ.name}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={organ.status === "LIVE" ? "allow" : "deny"}>{organ.status}</Badge>
              <ClaimChip
                kind={
                  organ.honesty === "UNAVAILABLE"
                    ? "UNAVAILABLE"
                    : organ.honesty === "ADVISORY"
                      ? "CONJECTURE"
                      : "DEMO"
                }
              />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-mute">{organ.detail}</p>
            <p className="mt-3 font-mono text-xs text-steel">{organ.formulas.join(" · ")}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
