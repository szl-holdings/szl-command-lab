import { createServerFn } from "@tanstack/react-start";
import { hydrateLiveOrgan, type Organ } from "@/lib/organs";

export const COMMAND_LAB_SPACE = "https://huggingface.co/spaces/SZLHOLDINGS/szl-command-lab";
export const COMMAND_LAB_RUNTIME = "https://szlholdings-szl-command-lab.hf.space";

export type SurfaceHonesty = "LIVE" | "REACHABLE" | "UNAVAILABLE";

export type LiveSurface = {
  id: string;
  role: string;
  href: string;
  honesty: SurfaceHonesty;
  detail: string;
  http: number | null;
};

export type LiveEnergy = {
  channel: "LIVE" | "UNAVAILABLE";
  honesty: "MEASURED" | "UNAVAILABLE";
  energy_j: number | null;
  note: string;
};

export type LiveEstate = {
  captured_at: string;
  source: string;
  kernel: {
    ok: boolean;
    live_count: number;
    blocked: boolean;
    verdict: string;
    conjecture_1: "OPEN";
    proven_trust: false;
    reason: string;
    organs: Organ[];
    energy: LiveEnergy;
  };
  surfaces: LiveSurface[];
};

const SURFACES: Array<{ id: string; role: string; href: string; url: string }> = [
  { id: "command-lab", role: "Operator kernel", href: COMMAND_LAB_SPACE, url: `${COMMAND_LAB_RUNTIME}/healthz` },
  { id: "a11oy", role: "Product command", href: "https://huggingface.co/spaces/SZLHOLDINGS/a11oy", url: "https://szlholdings-a11oy.hf.space/healthz" },
  { id: "killinchu", role: "Bounded vertical", href: "https://huggingface.co/spaces/SZLHOLDINGS/killinchu", url: "https://szlholdings-killinchu.hf.space/healthz" },
  { id: "khipu", role: "Python kernels", href: "https://huggingface.co/spaces/SZLHOLDINGS/szl-khipu", url: "https://szlholdings-szl-khipu.hf.space/" },
  { id: "anatomy", role: "Living body", href: "https://huggingface.co/spaces/SZLHOLDINGS/anatomy", url: "https://szlholdings-anatomy.hf.space/healthz" },
  { id: "immune", role: "Defense matrix", href: "https://huggingface.co/spaces/SZLHOLDINGS/immune", url: "https://szlholdings-immune.hf.space/healthz" },
  { id: "sovereign-os", role: "Operator OS", href: "https://huggingface.co/spaces/SZLHOLDINGS/szl-sovereign-os", url: "https://szlholdings-szl-sovereign-os.hf.space/healthz" },
  { id: "real-estate", role: "Public records", href: "https://huggingface.co/spaces/SZLHOLDINGS/szl-real-estate", url: "https://szlholdings-szl-real-estate.hf.space/healthz" },
  { id: "cosmos", role: "Estate map", href: "https://huggingface.co/spaces/SZLHOLDINGS/cosmos", url: "https://szlholdings-cosmos.hf.space/" },
  { id: "counsel", role: "Counsel hologram", href: "https://huggingface.co/spaces/SZLHOLDINGS/counsel", url: "https://szlholdings-counsel.hf.space/" },
];

const EMPTY_ENERGY: LiveEnergy = {
  channel: "UNAVAILABLE",
  honesty: "UNAVAILABLE",
  energy_j: null,
  note: "Kernel recapture did not answer. Never a fabricated joule.",
};

let cache: { at: number; value: LiveEstate } | null = null;
const TTL_MS = 20_000;

async function pull(url: string, timeoutMs = 4500): Promise<{ http: number | null; text: string; json: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json, text/html;q=0.8", "User-Agent": "szl-command-lab-operator" },
    });
    const text = await res.text();
    let json: unknown = null;
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        json = JSON.parse(trimmed);
      } catch {
        json = null;
      }
    }
    return { http: res.status, text, json };
  } catch {
    return { http: null, text: "", json: null };
  } finally {
    clearTimeout(timer);
  }
}

function classify(http: number | null, json: unknown, text: string): { honesty: SurfaceHonesty; detail: string } {
  if (http !== 200) return { honesty: "UNAVAILABLE", detail: http ? `HTTP ${http}` : "no answer" };
  if (json && typeof json === "object") {
    const row = json as Record<string, unknown>;
    if (typeof row.live_count === "number") return { honesty: "LIVE", detail: `${row.live_count}/5 organs` };
    if (row.ok === true || row.status === "ok") return { honesty: "LIVE", detail: "healthz 200" };
    if (row.occupancy === "UNAVAILABLE") return { honesty: "LIVE", detail: "occupancy UNAVAILABLE" };
    return { honesty: "LIVE", detail: "json 200" };
  }
  if (text.toLowerCase().includes("<!doctype") || text.toLowerCase().includes("<html")) {
    return { honesty: "REACHABLE", detail: "html 200 · not a kernel healthz" };
  }
  return { honesty: "REACHABLE", detail: "http 200" };
}

function kernelFrom(organsRaw: unknown, energyRaw: unknown, healthRaw: unknown): LiveEstate["kernel"] {
  const organsJson = organsRaw && typeof organsRaw === "object" ? (organsRaw as Record<string, unknown>) : {};
  const body = (organsJson.body && typeof organsJson.body === "object" ? organsJson.body : organsJson) as Record<string, unknown>;
  const energyJson = energyRaw && typeof energyRaw === "object" ? (energyRaw as Record<string, unknown>) : {};
  const healthJson = healthRaw && typeof healthRaw === "object" ? (healthRaw as Record<string, unknown>) : {};
  const rows = Array.isArray(body.organs) ? body.organs : [];
  const organs = rows
    .map((row) => (row && typeof row === "object" ? hydrateLiveOrgan(row as { name?: string; status?: string; honesty?: string }) : null))
    .filter((row): row is Organ => Boolean(row));
  const channel = energyJson.channel === "LIVE" || (healthJson.energy && typeof healthJson.energy === "object" && (healthJson.energy as Record<string, unknown>).channel === "LIVE")
    ? "LIVE"
    : organs.length
      ? "LIVE"
      : "UNAVAILABLE";
  const honesty = energyJson.honesty === "MEASURED" ? "MEASURED" : "UNAVAILABLE";
  const energy: LiveEnergy = {
    channel,
    honesty,
    energy_j: typeof energyJson.energy_j === "number" ? energyJson.energy_j : null,
    note: typeof energyJson.note === "string" ? energyJson.note : "Energy channel LIVE only when the probe answers. Joule MEASURED only from RAPL/NVML.",
  };
  const liveCount = typeof body.live_count === "number" ? body.live_count : organs.filter((o) => o.status === "LIVE").length;
  const ok = organs.length === 5 && liveCount === 5;
  return {
    ok,
    live_count: liveCount,
    blocked: body.blocked === true,
    verdict: typeof body.verdict === "string" ? body.verdict : organs.length ? "ADVISORY_BODY" : "UNAVAILABLE",
    conjecture_1: "OPEN",
    proven_trust: false,
    reason:
      typeof body.reason === "string"
        ? body.reason
        : organs.length
          ? `organ integrity ${liveCount}/5 · energy ${honesty} · Conjecture 1 OPEN`
          : "command-lab kernel UNAVAILABLE this recapture",
    organs,
    energy,
  };
}

async function recapture(): Promise<LiveEstate> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value;

  const [health, energy, organs, ...surfaceHits] = await Promise.all([
    pull(`${COMMAND_LAB_RUNTIME}/healthz`),
    pull(`${COMMAND_LAB_RUNTIME}/api/energy`),
    pull(`${COMMAND_LAB_RUNTIME}/api/organs/integrity`),
    ...SURFACES.map((surface) => pull(surface.url)),
  ]);

  const value: LiveEstate = {
    captured_at: new Date().toISOString(),
    source: COMMAND_LAB_SPACE,
    kernel: kernelFrom(organs.json, energy.json, health.json),
    surfaces: SURFACES.map((surface, i) => {
      const hit = surfaceHits[i];
      const cls = classify(hit.http, hit.json, hit.text);
      return {
        id: surface.id,
        role: surface.role,
        href: surface.href,
        honesty: cls.honesty,
        detail: cls.detail,
        http: hit.http,
      };
    }),
  };
  cache = { at: now, value };
  return value;
}

export const recaptureEstate = createServerFn({ method: "GET" }).handler(async () => recapture());
