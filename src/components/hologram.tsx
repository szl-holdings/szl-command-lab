import { useEffect, useRef, useState } from "react";
import { LOCKED_FORMULAS } from "@/lib/formulas";
import type { Organ } from "@/lib/organs";
import { cn } from "@/lib/utils";

type Pulse = "idle" | "allow" | "deny" | "hold";

type Props = {
  organs?: Organ[];
  pulse?: Pulse;
  title?: string;
  caption?: string;
  className?: string;
  activeOrgan?: Organ["id"] | null;
  activeFormula?: string | null;
};

const FALLBACK: Organ[] = [
  { id: "brain", name: "BRAIN", quechua: "YACHAY", formulas: ["F1"], role: "", status: "LIVE", honesty: "LIVE", detail: "", metric: 0 },
  { id: "heart", name: "HEART", quechua: "YUYAY", formulas: ["F4", "F11"], role: "", status: "LIVE", honesty: "ADVISORY", detail: "", metric: 0 },
  { id: "circulatory", name: "CIRCULATORY", quechua: "YAWAR", formulas: ["F7", "F22"], role: "", status: "LIVE", honesty: "LIVE", detail: "", metric: 0 },
  { id: "nervous", name: "NERVOUS", quechua: "OTel", formulas: ["F12"], role: "", status: "LIVE", honesty: "UNAVAILABLE", detail: "", metric: 0 },
  { id: "skeleton", name: "SKELETON", quechua: "Khipu", formulas: ["F18", "F19"], role: "", status: "LIVE", honesty: "ADVISORY", detail: "", metric: 0 },
];

const SLOT: Record<Organ["id"], { top: string; left: string; z: string; w: string; h: string }> = {
  brain: { top: "10%", left: "50%", z: "44px", w: "7.25rem", h: "4.25rem" },
  heart: { top: "34%", left: "50%", z: "58px", w: "5.4rem", h: "4.1rem" },
  circulatory: { top: "52%", left: "50%", z: "30px", w: "3.1rem", h: "7.6rem" },
  nervous: { top: "54%", left: "50%", z: "18px", w: "12rem", h: "2.2rem" },
  skeleton: { top: "78%", left: "50%", z: "38px", w: "8.25rem", h: "4.75rem" },
};

function organTone(organ: Organ, active: boolean, modeled: boolean) {
  if (modeled) return active ? "holo-node-active" : "holo-node-modeled";
  if (organ.status === "DOWN") return "holo-node-down";
  if (organ.honesty === "UNAVAILABLE") return "holo-node-hold";
  if (active) return "holo-node-active";
  return "holo-node-live";
}

export function Hologram({
  organs,
  pulse = "idle",
  title = "Living body",
  caption,
  className,
  activeOrgan = null,
  activeFormula = null,
}: Props) {
  const modeled = !organs?.length;
  const body = organs?.length ? organs : FALLBACK;
  const stageRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const live = modeled ? 0 : body.filter((o) => o.status === "LIVE").length;
  const pulseSlot = activeOrgan ? SLOT[activeOrgan] : null;

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const node = el;
    function onMove(event: PointerEvent) {
      const box = node.getBoundingClientRect();
      const nx = ((event.clientX - box.left) / box.width) * 2 - 1;
      const ny = ((event.clientY - box.top) / box.height) * 2 - 1;
      setTilt({ x: ny * -8, y: nx * 10 });
    }
    function onLeave() {
      setTilt({ x: 0, y: 0 });
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <article className={cn("holo-foil overflow-hidden rounded-xl", className)}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-mute">{title}</p>
        <p className="font-mono text-xs tabular-nums text-steel">
          {modeled ? "MODELED silhouette" : `${live}/5 LIVE`}
          {activeFormula ? ` · ${activeFormula}` : ""}
        </p>
      </div>

      <div
        ref={stageRef}
        className={cn("holo-stage", pulse !== "idle" && `holo-stage-${pulse}`)}
        role="img"
        aria-label="Five-organ holographic body"
      >
        <div className="holo-grid" aria-hidden />
        <div className="holo-scan" aria-hidden />
        <div
          className="holo-rig"
          style={{
            transform: `rotateX(${12 + tilt.x}deg) rotateY(${tilt.y}deg)`,
          }}
        >
          <svg className="holo-figure" viewBox="0 0 200 320" aria-hidden>
            <ellipse cx="100" cy="38" rx="26" ry="22" />
            <path d="M74 66C74 54 126 54 126 66L140 148C140 168 124 182 100 182C76 182 60 168 60 148Z" />
            <path d="M78 180H122L136 268H108L100 198L92 268H64Z" />
            <line x1="100" y1="60" x2="100" y2="268" />
            <line x1="48" y1="168" x2="152" y2="168" />
          </svg>
          <span className="holo-vessel" aria-hidden />
          {pulseSlot && (
            <span
              className={cn("holo-bead", pulse === "deny" && "holo-bead-deny", pulse === "allow" && "holo-bead-allow")}
              style={{ top: pulseSlot.top, left: pulseSlot.left }}
              aria-hidden
            />
          )}
          {body.map((organ) => {
            const slot = SLOT[organ.id];
            const active = activeOrgan === organ.id;
            return (
              <div
                key={organ.id}
                className={cn("holo-node", organTone(organ, active, modeled), active && "holo-node-lit")}
                style={{
                  top: slot.top,
                  left: slot.left,
                  width: slot.w,
                  height: slot.h,
                  transform: `translate(-50%, -50%) translateZ(${slot.z})`,
                }}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute">{organ.name}</p>
                <p className="font-display text-lg leading-none text-bone">{organ.quechua}</p>
                <p className="mt-1 font-mono text-[10px] text-steel">{organ.formulas.join(" · ")}</p>
              </div>
            );
          })}
        </div>
      </div>

      <ul className="grid grid-cols-5 gap-px border-t border-line bg-line text-center">
        {body.map((organ) => (
          <li
            key={organ.id}
            className={cn("bg-ink-2 px-1 py-2", activeOrgan === organ.id && "bg-ink-3")}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-mute">{organ.name}</p>
            <p
              className={
                modeled
                  ? "font-mono text-[10px] text-hold"
                  : organ.status === "DOWN"
                    ? "font-mono text-[10px] text-deny"
                    : "font-mono text-[10px] text-allow"
              }
            >
              {modeled ? "SIL" : organ.status}
            </p>
          </li>
        ))}
      </ul>

      <ul className="flex flex-wrap gap-1 border-t border-line px-3 py-2">
        {LOCKED_FORMULAS.map((formula) => (
          <li
            key={formula.id}
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
              formula.id === activeFormula
                ? "border-steel/50 text-bone"
                : formula.honesty === "CONJECTURE"
                  ? "border-line text-mute"
                  : formula.honesty === "UNAVAILABLE"
                    ? "border-line text-hold"
                    : "border-line text-steel",
            )}
          >
            {formula.id}
          </li>
        ))}
      </ul>

      {caption && <p className="border-t border-line px-4 py-3 text-sm text-mute">{caption}</p>}
    </article>
  );
}
