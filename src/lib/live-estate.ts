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

// The curated surface list has one source: the deployed Atlas runtime
// (`server.py` SURFACES, served at /api/estate). This app never keeps a second
// typed copy of Space ids, so a retired Space leaves both surfaces at once.
const ESTATE_URL = `${COMMAND_LAB_RUNTIME}/api/estate`;
const ESTATE_SCHEMA = "szl.atlas.estate/v1";
const SPACE_HREF_PREFIX = "https://huggingface.co/spaces/SZLHOLDINGS/";
const HONESTY: ReadonlySet<SurfaceHonesty> = new Set(["LIVE", "REACHABLE", "UNAVAILABLE"]);

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

function surfacesFrom(http: number | null, json: unknown): LiveSurface[] {
  if (http !== 200 || !json || typeof json !== "object") return [];
  const body = json as Record<string, unknown>;
  if (body.schema !== ESTATE_SCHEMA || !Array.isArray(body.surfaces)) return [];
  const surfaces: LiveSurface[] = [];
  for (const raw of body.surfaces) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const { id, role, href, honesty, detail, http: status } = row;
    if (typeof id !== "string" || typeof role !== "string" || typeof href !== "string") continue;
    if (!href.startsWith(SPACE_HREF_PREFIX) || typeof honesty !== "string") continue;
    if (!HONESTY.has(honesty as SurfaceHonesty)) continue;
    surfaces.push({
      id,
      role,
      href,
      honesty: honesty as SurfaceHonesty,
      detail: typeof detail === "string" ? detail : "",
      http: typeof status === "number" ? status : null,
    });
  }
  return surfaces;
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

  const [health, energy, organs, estate] = await Promise.all([
    pull(`${COMMAND_LAB_RUNTIME}/healthz`),
    pull(`${COMMAND_LAB_RUNTIME}/api/energy`),
    pull(`${COMMAND_LAB_RUNTIME}/api/organs/integrity`),
    // The runtime probes its surfaces in parallel with 4 s bounds; allow for that.
    pull(ESTATE_URL, 12_000),
  ]);

  const value: LiveEstate = {
    captured_at: new Date().toISOString(),
    source: COMMAND_LAB_SPACE,
    kernel: kernelFrom(organs.json, energy.json, health.json),
    surfaces: surfacesFrom(estate.http, estate.json),
  };
  cache = { at: now, value };
  return value;
}

export const recaptureEstate = createServerFn({ method: "GET" }).handler(async () => recapture());
