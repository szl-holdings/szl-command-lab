import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useLedger } from "@/lib/ledger-store";
import type { FileRouteTypes } from "@/routeTree.gen";
import { cn, knotLabel } from "@/lib/utils";

type AppPath = FileRouteTypes["to"];
type NavItem = { to: AppPath; label: string };

const PRIMARY: readonly NavItem[] = [
  { to: "/command", label: "Command" },
  { to: "/organs", label: "Organs" },
  { to: "/formulas", label: "Formulas" },
  { to: "/ledger", label: "Ledger" },
  { to: "/verify", label: "Verify" },
  { to: "/frontier", label: "Frontier" },
  { to: "/diligence", label: "Room" },
];

const MORE_GROUPS: readonly { heading: string; items: readonly NavItem[] }[] = [
  {
    heading: "Products",
    items: [
      { to: "/killinchu", label: "Killinchu" },
      { to: "/hub", label: "Hub" },
      { to: "/registry", label: "Registry" },
      { to: "/publish", label: "Origins" },
    ],
  },
  {
    heading: "Doctrine",
    items: [
      { to: "/trajectory", label: "Ontology" },
      { to: "/lifecycle", label: "Lifecycle" },
      { to: "/graph", label: "Graph" },
      { to: "/identity", label: "Identity" },
      { to: "/contribute", label: "Contribute" },
    ],
  },
  {
    heading: "Estate",
    items: [
      { to: "/estate", label: "Estate" },
      { to: "/provenance", label: "Provenance" },
    ],
  },
];

const ALL_MORE = MORE_GROUPS.flatMap((group) => group.items);

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const hydrate = useLedger((s) => s.hydrate);
  const knots = useLedger((s) => s.receipts.length);
  const moreActive = ALL_MORE.some((item) => isActive(pathname, item.to));

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    setOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-ink text-bone">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-bone focus:px-3 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 py-2" aria-label="SZL Command home">
            <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-sm border border-line">
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M4 2v12M8 2v12M12 2v12" />
                <circle cx="4" cy="6" r="1.1" fill="currentColor" stroke="none" />
                <circle cx="8" cy="9" r="1.1" fill="currentColor" stroke="none" />
                <circle cx="12" cy="5" r="1.1" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span className="font-display text-xl tracking-tight">SZL</span>
          </Link>
          <Badge tone="hold" className="hidden xl:inline-flex">
            Unpublished demo
          </Badge>
          <nav className="hidden min-w-0 flex-1 items-stretch lg:flex" aria-label="Primary">
            {PRIMARY.map((item) => {
              const active = isActive(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "relative inline-flex min-h-12 items-center px-2.5 text-sm transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] xl:px-3",
                    active ? "text-bone" : "text-mute hover:text-bone",
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "absolute inset-x-2 bottom-0 h-px bg-bone transition-opacity duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                </Link>
              );
            })}
            <div className="relative ml-auto">
              <button
                type="button"
                className={cn(
                  "inline-flex min-h-12 items-center gap-1 px-2.5 text-sm transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                  moreActive || moreOpen ? "text-bone" : "text-mute hover:text-bone",
                )}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                onClick={() => setMoreOpen((v) => !v)}
              >
                More
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-[var(--motion-quick)]", moreOpen && "rotate-180")} />
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-px grid min-w-80 gap-4 rounded-b-lg border border-line bg-ink-2 p-4 sm:grid-cols-3"
                >
                  {MORE_GROUPS.map((group) => (
                    <div key={group.heading}>
                      <p className="px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{group.heading}</p>
                      <ul className="mt-1">
                        {group.items.map((item) => (
                          <li key={item.to} role="none">
                            <Link
                              role="menuitem"
                              to={item.to}
                              className={cn(
                                "flex min-h-11 items-center rounded-md px-2 text-sm",
                                isActive(pathname, item.to) ? "bg-ink-3 text-bone" : "text-mute hover:bg-ink-3 hover:text-bone",
                              )}
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </nav>
          <p className="ml-auto font-mono text-xs tabular-nums text-steel lg:ml-2 lg:shrink-0">{knotLabel(knots)}</p>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line lg:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-line px-4 py-3 lg:hidden" aria-label="Mobile">
            <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Command</p>
            <ul className="grid gap-1">
              {PRIMARY.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex min-h-11 items-center rounded-md px-3 text-base",
                      isActive(pathname, item.to) ? "bg-ink-2 text-bone" : "text-bone hover:bg-ink-2",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {MORE_GROUPS.map((group) => (
              <div key={group.heading} className="mt-3">
                <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{group.heading}</p>
                <ul className="grid gap-1">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={cn(
                          "flex min-h-11 items-center rounded-md px-3 text-base",
                          isActive(pathname, item.to) ? "bg-ink-2 text-bone" : "text-bone hover:bg-ink-2",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        )}
      </header>
      <div id="main">{children}</div>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-mute sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>This preview is unpublished. Product is a-11-oy.com. Proof is a11oy.net. Receipts here are DEMO-signed.</p>
          <p className="font-mono text-xs">Λ uniqueness remains Conjecture 1</p>
        </div>
      </footer>
    </div>
  );
}
