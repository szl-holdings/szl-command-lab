import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("../space/index.html", import.meta.url), "utf8");
const start = html.indexOf("    function renderSurfaces() {");
const end = html.indexOf("    function renderModelSpotlights() {", start);
assert.ok(start >= 0 && end > start, "test the shipped static renderer");
const renderer = html.slice(start, end);
const observationHelpers = html.slice(html.indexOf("    function observationTime("), html.indexOf("    function assetBySlug("));

function render(estate, asset = null) {
  const nodes = new Map();
  const node = (selector) => {
    if (!nodes.has(selector)) {
      nodes.set(selector, {
        children: [],
        replaceChildren() { this.children = []; },
        append(child) { this.children.push(child); },
      });
    }
    return nodes.get(selector);
  };
  vm.runInNewContext(`${observationHelpers}\n${renderer}\nrenderSurfaces();`, {
    state: { estate },
    FLAGSHIPS: [{ slug: "remote", index: "01", title: "Remote", role: "Navigation" }],
    assetBySlug: () => asset,
    $: node,
    el: (tag, attrs, children = []) => ({ tag, ...attrs, children: children.filter(child => child != null) }),
    safeDate: () => "fixture time",
  });
  return nodes;
}

test("HTTP observations and simulation are not shown as live or authorization", () => {
  const nodes = render({
    live_surfaces: 99,
    reachable_surfaces: 2,
    simulated_surfaces: 1,
    surfaces: [{ id: "remote", honesty: "MEASURED", detail: "HTTP 200; reachability only, capability UNKNOWN" }],
  });
  assert.equal(nodes.get("#estate-state").textContent, "2 HTTP 200 · 1 simulated");
  assert.equal(nodes.get("#estate-state").className, "status-pill partial");
  const card = nodes.get("#surface-grid").children[0];
  assert.equal(card.children[0].text, "01 / MEASURED");
  assert.match(card.children[3].text, /reachability only, capability UNKNOWN/);
});

test("a returned estate with no positive observations is not green", () => {
  const nodes = render({ surfaces: [], reachable_surfaces: 0, simulated_surfaces: 0 });
  assert.equal(nodes.get("#estate-state").className, "status-pill down");
  assert.equal(nodes.get("#estate-state").textContent, "0 HTTP 200 · 0 simulated");
});

test("unavailable estate stays unavailable", () => {
  const nodes = render(null);
  assert.equal(nodes.get("#estate-state").textContent, "Runtime unavailable");
  assert.equal(nodes.get("#estate-state").className, "status-pill down");
});

test("catalog-only navigation is declared, not measured", () => {
  const nodes = render(null, { href: "https://example.invalid" });
  assert.equal(nodes.get("#surface-grid").children[0].children[0].text, "01 / DECLARED");
});

test("cached public listing remains separate from current HTTP reachability", () => {
  const nodes = render(null, { href: "https://example.invalid", observation_state: "CACHED", observed_at: "2026-10-04T16:00:00Z" });
  const card = nodes.get("#surface-grid").children[0];
  assert.equal(card.children[0].text, "01 / DECLARED");
  assert.match(card.children[3].text, /Cached listing · observed Oct 4, 16:00 UTC/);
  assert.equal(nodes.get("#estate-state").textContent, "Runtime unavailable");
});

for (const legacy of ["LIVE", "REACHABLE"]) {
  test(`legacy ${legacy} labels are not replayed as evidence`, () => {
    const nodes = render({ surfaces: [{ id: "remote", honesty: legacy }] });
    assert.equal(nodes.get("#surface-grid").children[0].children[0].text, "01 / UNKNOWN");
  });
}
