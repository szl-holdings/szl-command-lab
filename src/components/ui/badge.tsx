import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tone = "neutral" | "steel" | "allow" | "deny" | "hold" | "mute";

const tones: Record<Tone, string> = {
  neutral: "border-line text-bone",
  steel: "border-steel/30 text-steel",
  allow: "border-allow/40 text-allow",
  deny: "border-deny/40 text-deny",
  hold: "border-hold/40 text-hold",
  mute: "border-line text-mute",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
