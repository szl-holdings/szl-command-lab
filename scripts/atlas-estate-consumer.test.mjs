import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

// Execute the production parser without installing the app framework or making
// requests. Only module wiring is substituted; parsing behavior is not copied.
const parserSource = readFileSync(new URL("../src/lib/live-estate.ts", import.meta.url), "utf8");
const executable = stripTypeScriptTypes(parserSource, { mode: "strip" })
  .replace(/^import .*;\r?\n/gm, "")
  .replace(/^export /gm, "");
const surfacesFrom = runInNewContext(`${executable}\nsurfacesFrom;`, {
  createServerFn: () => ({ handler: (callback) => callback }),
  hydrateLiveOrgan: () => { throw new Error("unexpected kernel hydration"); },
});

const remote = {
  id: "remote",
  role: "Synthetic test fixture",
  href: "https://huggingface.co/spaces/SZLHOLDINGS/test-only",
  honesty: "MEASURED",
  detail: "HTTP 200; reachability only, not capability or authorization",
  http: 200,
  reachable: true,
  evidence_scope: "http_reachability",
};
const local = {
  ...remote,
  id: "local",
  honesty: "SIMULATED",
  detail: "Synthetic kernel fixture; not a deployment verdict",
  http: null,
  reachable: null,
  evidence_scope: "synthetic_kernel",
};

function parse(rows, http = 200, schema = "szl.atlas.estate/v1") {
  // Normalize VM-realm prototypes for strict structural comparison.
  return JSON.parse(JSON.stringify(surfacesFrom(http, { schema, surfaces: rows })));
}

test("HTTP observations retain scope without a readiness claim", () => {
  assert.deepEqual(parse([remote]), [remote]);
  assert.equal(Object.hasOwn(parse([remote])[0], "ready"), false);
});

test("synthetic, blocked, and unavailable local observations never become HTTP observations", () => {
  for (const honesty of ["SIMULATED", "BLOCKED", "UNAVAILABLE"]) {
    const row = { ...local, honesty };
    assert.deepEqual(parse([row]), [row]);
  }
});

test("non-200 and absent remote observations remain unavailable", () => {
  for (const status of [null, 201, 301, 401, 404, 500, 503]) {
    const row = { ...remote, honesty: "UNAVAILABLE", http: status, reachable: false };
    assert.deepEqual(parse([row]), [row]);
  }
});

test("legacy and unsupported honesty labels are rejected, not promoted", () => {
  for (const honesty of ["LIVE", "REACHABLE", "DECLARED", "REPORTED", "", null]) {
    assert.deepEqual(parse([{ ...remote, honesty }]), []);
  }
});

test("inconsistent HTTP claims fail closed", () => {
  const changes = [
    { reachable: false },
    { reachable: null },
    { reachable: undefined },
    { http: 503 },
    { http: null },
    { http: "200" },
    { evidence_scope: "synthetic_kernel" },
    { evidence_scope: "unknown" },
    { evidence_scope: undefined },
    { honesty: "UNAVAILABLE" },
    { honesty: "BLOCKED" },
    { honesty: "SIMULATED" },
  ];
  for (const change of changes) assert.deepEqual(parse([{ ...remote, ...change }]), []);
});

test("inconsistent unavailable HTTP statuses fail closed", () => {
  for (const http of [undefined, "503", 0, 99, 200, 600, 503.5, NaN, Infinity]) {
    assert.deepEqual(parse([{ ...remote, honesty: "UNAVAILABLE", reachable: false, http }]), []);
  }
});

test("synthetic observations cannot claim a measured response", () => {
  const changes = [
    { reachable: true },
    { reachable: false },
    { reachable: undefined },
    { http: 200 },
    { http: undefined },
    { evidence_scope: "http_reachability" },
    { honesty: "MEASURED" },
  ];
  for (const change of changes) assert.deepEqual(parse([{ ...local, ...change }]), []);
});

test("the existing endpoint, schema, identity, and public Space boundaries remain enforced", () => {
  assert.deepEqual(parse([remote], 503), []);
  assert.deepEqual(parse([remote], 200, "other/v1"), []);
  for (const change of [{ id: null }, { role: 5 }, { href: "https://example.invalid" }]) {
    assert.deepEqual(parse([{ ...remote, ...change }]), []);
  }
  assert.deepEqual(parse([null, false, 123, [], {}]), []);
  assert.deepEqual(parse([{ ...remote, detail: null }]), [{ ...remote, detail: "" }]);
});

test("mixed observations preserve order and discard legacy classifications", () => {
  const unavailable = { ...remote, id: "offline", honesty: "UNAVAILABLE", http: null, reachable: false };
  assert.deepEqual(parse([local, { ...remote, honesty: "LIVE" }, remote, unavailable]), [local, remote, unavailable]);
});

test("surface presentation uses reachability and simulation, never an allow badge", () => {
  const strip = readFileSync(new URL("../src/components/live-strip.tsx", import.meta.url), "utf8");
  const hub = readFileSync(new URL("../src/routes/hub.tsx", import.meta.url), "utf8");
  assert.match(strip, /s\.reachable === true/);
  assert.match(strip, /s\.honesty === "SIMULATED"/);
  assert.doesNotMatch(strip, /surfaces LIVE|s\.honesty === "LIVE"|s\.honesty === "REACHABLE"/);
  assert.match(hub, /Observed Space surfaces/);
  assert.doesNotMatch(hub, /space\.honesty === "LIVE"|space\.honesty === "REACHABLE"/);
  const surfaceBadge = hub.match(/<Badge tone=\{[^\n]*space\.honesty[^\n]*/)?.[0];
  assert.ok(surfaceBadge, "surface badge has an explicit neutral or deny classification");
  assert.doesNotMatch(surfaceBadge, /"allow"/);
});
