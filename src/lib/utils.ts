import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortSha(value: string, size = 8) {
  if (!value) return "UNAVAILABLE";
  return value.length <= size * 2 ? value : `${value.slice(0, size)}…${value.slice(-4)}`;
}

export function knotLabel(n: number) {
  return n === 1 ? "1 knot" : `${n} knots`;
}

export function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(new Date(iso)) + " UTC";
  } catch {
    return iso;
  }
}
