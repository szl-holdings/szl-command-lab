import { Badge } from "@/components/ui/badge";

export type ClaimClass =
  | "MEASURED"
  | "REPORTED"
  | "MODELED"
  | "DEMO"
  | "CONJECTURE"
  | "ROADMAP"
  | "UNAVAILABLE"
  | "SIMULATED";

const tone: Record<ClaimClass, "steel" | "allow" | "hold" | "mute" | "deny" | "neutral"> = {
  MEASURED: "allow",
  REPORTED: "steel",
  MODELED: "hold",
  DEMO: "hold",
  CONJECTURE: "mute",
  ROADMAP: "neutral",
  UNAVAILABLE: "deny",
  SIMULATED: "hold",
};

export function ClaimChip({ kind }: { kind: ClaimClass }) {
  return <Badge tone={tone[kind]}>{kind}</Badge>;
}
