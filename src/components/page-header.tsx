import { ClaimChip, type ClaimClass } from "@/components/claim-chip";
import { cn } from "@/lib/utils";

type Props = {
  kicker: string;
  title: string;
  lede: string;
  claims?: ClaimClass[];
  className?: string;
};

export function PageHeader({ kicker, title, lede, claims = ["DEMO"], className }: Props) {
  return (
    <header className={cn("max-w-3xl", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {claims.map((kind) => (
          <ClaimChip key={kind} kind={kind} />
        ))}
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-mute">{kicker}</span>
      </div>
      <h1 className="mt-4 font-display text-4xl leading-tight tracking-tight text-bone sm:text-5xl">{title}</h1>
      <p className="mt-3 text-lg leading-relaxed text-mute">{lede}</p>
    </header>
  );
}
