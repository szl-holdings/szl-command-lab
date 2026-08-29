import { create } from "zustand";
import type { Receipt } from "./receipt";

const KEY = "szl-command-ledger-v1";

type LedgerState = {
  hydrated: boolean;
  receipts: Receipt[];
  hydrate: () => void;
  append: (receipt: Receipt) => void;
  replace: (receipts: Receipt[]) => void;
  clear: () => void;
};

function read(): Receipt[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Receipt[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(receipts: Receipt[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(receipts));
  } catch {
    /* quota — demo continues in memory */
  }
}

export const useLedger = create<LedgerState>((set, get) => ({
  hydrated: false,
  receipts: [],
  hydrate: () => {
    if (get().hydrated) return;
    set({ hydrated: true, receipts: read() });
  },
  append: (receipt) => {
    const receipts = [...get().receipts, receipt];
    write(receipts);
    set({ receipts, hydrated: true });
  },
  replace: (receipts) => {
    write(receipts);
    set({ receipts, hydrated: true });
  },
  clear: () => {
    write([]);
    set({ receipts: [], hydrated: true });
  },
}));

export function chainHead(receipts: Receipt[]): string | null {
  if (!receipts.length) return null;
  return receipts[receipts.length - 1].digest;
}
