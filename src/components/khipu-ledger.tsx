import { cn, knotLabel } from "@/lib/utils";
import type { Receipt } from "@/lib/receipt";

type Props = {
  receipts: Receipt[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
};

const CORDS = 4;

export function KhipuLedger({ receipts, selectedId, onSelect, className }: Props) {
  const width = 320;
  const top = 28;
  const gap = 22;
  const height = Math.max(180, top + receipts.length * gap + 36);
  const xs = [48, 122, 196, 270];

  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-ink-2", className)}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Khipu ledger</p>
        <p className="font-mono text-[11px] tabular-nums text-steel">{knotLabel(receipts.length)}</p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Receipt chain drawn as khipu cords"
      >
        {xs.map((x) => (
          <line
            key={x}
            x1={x}
            x2={x}
            y1={8}
            y2={height - 8}
            stroke="currentColor"
            className="text-line"
            strokeWidth="1.25"
          />
        ))}
        {receipts.length === 0 && (
          <text x={width / 2} y={height / 2} textAnchor="middle" fill="#6e6c68" fontSize="11" fontFamily="IBM Plex Mono, monospace">
            No knots yet — bind a receipt
          </text>
        )}
        {receipts.map((receipt, i) => {
          const x = xs[i % CORDS];
          const y = top + i * gap;
          const selected = receipt.id === selectedId;
          const fill = receipt.decision === "ALLOW" ? "#8fa38c" : "#c17b74";
          return (
            <g key={receipt.id}>
              <circle
                cx={x}
                cy={y}
                r={selected ? 7 : 5}
                fill={fill}
                stroke={selected ? "#f2efe8" : "none"}
                strokeWidth={selected ? 1.5 : 0}
                className={onSelect ? "cursor-pointer" : undefined}
                onClick={() => onSelect?.(receipt.id)}
              >
                <title>{`${receipt.tool} · ${receipt.decision}`}</title>
              </circle>
              {i > 0 && (
                <line
                  x1={xs[(i - 1) % CORDS]}
                  y1={top + (i - 1) * gap}
                  x2={x}
                  y2={y}
                  stroke="#b8c2cc"
                  strokeOpacity="0.35"
                  strokeWidth="0.8"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
