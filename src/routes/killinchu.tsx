import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { chainHead, useLedger } from "@/lib/ledger-store";
import { evaluatePolicy } from "@/lib/policy";
import { mintReceipt } from "@/lib/receipt";

export const Route = createFileRoute("/killinchu")({ component: Killinchu });

type Track = {
  id: string;
  callsign: string;
  kind: "UAS" | "VESSEL" | "UNKNOWN";
  x: number;
  y: number;
  heading: number;
  speed: number;
  threat: number;
};

const SEED: Track[] = [
  { id: "K-04", callsign: "CONDOR", kind: "UAS", x: 22, y: 30, heading: 40, speed: 28, threat: 0.21 },
  { id: "K-11", callsign: "PUNA", kind: "VESSEL", x: 58, y: 62, heading: 190, speed: 12, threat: 0.08 },
  { id: "K-17", callsign: "QOSQO", kind: "UAS", x: 71, y: 28, heading: 265, speed: 41, threat: 0.67 },
  { id: "K-22", callsign: "WILKA", kind: "UNKNOWN", x: 40, y: 48, heading: 10, speed: 9, threat: 0.44 },
  { id: "K-29", callsign: "AMARU", kind: "UAS", x: 81, y: 70, heading: 310, speed: 33, threat: 0.31 },
];

export function Killinchu() {
  const [tracks, setTracks] = useState(SEED);
  const [selected, setSelected] = useState("K-17");
  const [message, setMessage] = useState<string | null>(null);
  const receipts = useLedger((s) => s.receipts);
  const append = useLedger((s) => s.append);
  const track = tracks.find((t) => t.id === selected) ?? tracks[0];
  const action = useMemo(
    () => ({
      actor: "killinchu.fusion",
      tool: "recommend_intercept",
      resource: `track:${track.id}`,
      args: { method: "advisory_vector", weapons: false, threat: track.threat },
    }),
    [track],
  );
  const policy = evaluatePolicy(action);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = window.setInterval(() => {
      setTracks((prev) =>
        prev.map((t) => {
          const rad = (t.heading * Math.PI) / 180;
          const nx = (t.x + Math.cos(rad) * t.speed * 0.012 + 100) % 100;
          const ny = (t.y + Math.sin(rad) * t.speed * 0.012 + 100) % 100;
          return { ...t, x: nx, y: ny };
        }),
      );
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  async function bind(decision: "ALLOW" | "DENY") {
    const receipt = await mintReceipt({
      actor: "human.operator",
      tool: action.tool,
      resource: action.resource,
      args: action.args,
      policy_id: policy.policy_id,
      policy_reason: policy.reason,
      decision,
      authority: "HUMAN",
      effector_class: "ADVISORY",
      prev_sha256: chainHead(receipts),
    });
    append(receipt);
    setMessage(
      decision === "ALLOW"
        ? `Advisory recommendation recorded for ${track.id}. No effector fired.`
        : `Recommendation withheld for ${track.id}.`,
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        kicker="Decisions LIVE · actuation SIMULATED · effectors operator-owned"
        title="Killinchu"
        lede="This board is DEMO tracks. On the public Space, detection, classification, and governed decisions are LIVE. Public physical actuation stays SIMULATED. A recommendation is not a defeat. Human authority still binds the receipt."
        claims={["DEMO", "MODELED", "SIMULATED"]}
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="overflow-hidden rounded-xl border border-line bg-ink-2">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Live track board</p>
            <p className="font-mono text-[11px] text-steel">ROE WEAPONS HOLD</p>
          </div>
          <div className="relative aspect-[4/3] bg-ink">
            <div className="absolute inset-4 rounded-full border border-line/80" />
            <div className="absolute inset-[18%] rounded-full border border-line/50" />
            <div className="absolute inset-[36%] rounded-full border border-line/40" />
            <div className="absolute left-1/2 top-0 h-full w-px bg-line/60" />
            <div className="absolute left-0 top-1/2 h-px w-full bg-line/60" />
            {tracks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t.id)}
                style={{ left: `${t.x}%`, top: `${t.y}%` }}
                className={`absolute min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 ${
                  t.id === selected ? "z-10" : ""
                }`}
                aria-label={`Select track ${t.id}`}
              >
                <span
                  className={`block h-2.5 w-2.5 rounded-full ${
                    t.threat > 0.6 ? "bg-deny" : t.kind === "UNKNOWN" ? "bg-hold" : "bg-steel"
                  } ${t.id === selected ? "ring-2 ring-bone" : ""}`}
                />
                <span className="mt-1 block font-mono text-[10px] text-mute">{t.id}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-ink-2 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Selected track</p>
          <h2 className="mt-2 font-display text-3xl">{track.callsign}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-[11px]">
            <div>
              <dt className="text-faint">ID</dt>
              <dd>{track.id}</dd>
            </div>
            <div>
              <dt className="text-faint">Class</dt>
              <dd>{track.kind}</dd>
            </div>
            <div>
              <dt className="text-faint">Speed</dt>
              <dd className="tabular-nums">{track.speed} kn</dd>
            </div>
            <div>
              <dt className="text-faint">Threat</dt>
              <dd className="tabular-nums">{track.threat.toFixed(2)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-mute">{policy.reason}</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button variant="allow" onClick={() => void bind("ALLOW")}>
              Record advisory
            </Button>
            <Button variant="deny" onClick={() => void bind("DENY")}>
              Withhold
            </Button>
          </div>
          {message && <p className="mt-4 text-sm text-steel">{message}</p>}
        </section>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="bg-ink-2 font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
            <tr>
              <th className="px-4 py-3">Track</th>
              <th className="px-4 py-3">Callsign</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Threat</th>
              <th className="px-4 py-3">Posture</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((t) => (
              <tr
                key={t.id}
                className={`border-t border-line ${t.id === selected ? "bg-ink-2" : ""}`}
              >
                <td className="px-4 py-3 font-mono">
                  <button type="button" className="min-h-11 text-left" onClick={() => setSelected(t.id)}>
                    {t.id}
                  </button>
                </td>
                <td className="px-4 py-3">{t.callsign}</td>
                <td className="px-4 py-3 text-mute">{t.kind}</td>
                <td className="px-4 py-3 tabular-nums">{t.threat.toFixed(2)}</td>
                <td className="px-4 py-3 text-hold">ADVISORY</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
