import { useEffect, useState } from "react";
import { ClaimChip } from "@/components/claim-chip";
import { Badge } from "@/components/ui/badge";
import { recaptureEstate, type LiveEstate } from "@/lib/live-estate";
import { cn } from "@/lib/utils";

let inflight: Promise<LiveEstate> | null = null;

function loadEstate() {
  if (!inflight) {
    inflight = recaptureEstate().finally(() => {
      globalThis.setTimeout(() => {
        inflight = null;
      }, 20_000);
    });
  }
  return inflight;
}

export function useLiveEstate() {
  const [estate, setEstate] = useState<LiveEstate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadEstate()
      .then((next) => {
        if (!cancelled) setEstate(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "kernel recapture unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { estate, error };
}

export function LiveStrip({ className }: { className?: string }) {
  const { estate, error } = useLiveEstate();
  const kernel = estate?.kernel;
  const liveSurfaces = estate?.surfaces.filter((s) => s.honesty === "LIVE").length ?? 0;
  const reachable = estate?.surfaces.filter((s) => s.honesty === "REACHABLE").length ?? 0;

  return (
    <section className={cn("rounded-xl border border-line bg-ink-2 px-4 py-4 sm:px-5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-mute">Live Hub kernel</p>
        {kernel ? (
          <>
            <ClaimChip kind={kernel.ok ? "MEASURED" : "UNAVAILABLE"} />
            <ClaimChip kind={kernel.energy.honesty === "MEASURED" ? "MEASURED" : "UNAVAILABLE"} />
            <ClaimChip kind="CONJECTURE" />
          </>
        ) : null}
      </div>
      <p className="mt-3 font-display text-2xl text-bone sm:text-3xl">
        {kernel
          ? `${kernel.live_count}/5 LIVE · energy channel ${kernel.energy.channel}`
          : error
            ? "Kernel recapture unavailable"
            : "Recapturing command-lab"}
      </p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-mute">
        {kernel
          ? `${kernel.reason} Joule ${kernel.energy.honesty}. proven_trust stays false. ${liveSurfaces} surfaces LIVE, ${reachable} reachable.`
          : "This preview is the DEMO operator. The published Space is the operational kernel."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone={kernel?.ok ? "allow" : "hold"}>{kernel?.verdict.replaceAll("_", " ") ?? "pending"}</Badge>
        <Badge tone="hold">Λ OPEN</Badge>
        <Badge tone="deny">not proven trust</Badge>
        <a
          className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-[0.12em] text-steel hover:text-bone"
          href="https://huggingface.co/spaces/SZLHOLDINGS/szl-command-lab"
          target="_blank"
          rel="noreferrer"
        >
          Open command-lab Space
        </a>
      </div>
    </section>
  );
}
