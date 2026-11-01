import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBangs, kagiBangs, splitBangs } from "./kagi-bangs.mjs";

const ddg = {
  t: "ddg",
  ts: ["ddg", "duckduckgo"],
  s: "DuckDuckGo",
  d: "duckduckgo.com",
  u: "https://duckduckgo.com/?q={{{s}}}",
  ad: "duckduckgo.com",
  fmt: ["open_base_path"],
};

test("groups aliases under their main shortcut and drops unused fields", () => {
  assert.deepEqual(normalizeBangs([ddg]), [
    {
      t: "ddg",
      ts: ["duckduckgo"],
      s: "DuckDuckGo",
      d: "duckduckgo.com",
      u: ddg.u,
    },
  ]);
});

test("sends relative Kagi search URLs to DuckDuckGo", () => {
  const [, site, html, path] = normalizeBangs([
    ddg,
    {
      t: "a",
      s: "A (Kagi Search)",
      d: "kagi.com",
      u: "/search?q={{{s}}}+site:a.org",
    },
    { t: "b", s: "B", d: "kagi.com", u: "/html/search?q={{{s}}}" },
    { t: "c", s: "C", d: "kagi.com", u: "/{{{s}}}+unix+time" },
  ]);
  assert.equal(site.u, "https://duckduckgo.com/?q={{{s}}}+site:a.org");
  assert.equal(site.d, "duckduckgo.com");
  assert.equal(site.s, "A (DuckDuckGo)");
  assert.equal(html.u, "https://duckduckgo.com/?q={{{s}}}");
  assert.equal(path.u, "https://duckduckgo.com/?q={{{s}}}+unix+time");
});

test("keeps regex search templates", () => {
  const entry = {
    t: "rsr",
    s: "Reddit",
    d: "reddit.com",
    u: "https://reddit.com/r/$1/search?q=$2",
    x: "(\\w+)\\s+(.*)",
  };
  assert.deepEqual(normalizeBangs([ddg, entry])[1], entry);
});

test("rejects invalid catalogs, duplicate shortcuts, and a missing fallback", () => {
  for (const data of [
    null,
    [],
    [{}],
    [ddg, ddg],
    [ddg, { ...ddg, t: "other", ts: ["duckduckgo"] }],
    [{ ...ddg, t: "dax", ts: [] }],
  ])
    assert.throws(() => normalizeBangs(data));
});

test("splits names and categories out of the redirect catalog", () => {
  const entry = { t: "a", s: "A", d: "a.org", u: "https://a.org", c: "Tech" };
  assert.deepEqual(splitBangs([entry, { ...entry, t: "b", c: "" }]), {
    bangs: [
      { t: "a", d: "a.org", u: "https://a.org" },
      { t: "b", d: "a.org", u: "https://a.org" },
    ],
    details: [{ s: "A", c: "Tech" }, { s: "A" }],
  });
});

test("only resolves the virtual catalog modules", () => {
  const plugin = kagiBangs();
  assert.equal(plugin.resolveId("./other"), undefined);
  assert.equal(plugin.resolveId("virtual:kagi-bangs"), "\0virtual:kagi-bangs");
  assert.equal(
    plugin.resolveId("virtual:kagi-bang-details"),
    "\0virtual:kagi-bang-details",
  );
});
