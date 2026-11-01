// Pinned so builds are reproducible; bump the commit to pick up upstream changes.
export const KAGI_BANGS_COMMIT = "d6cfe0de64d6990150a1bcfee7a31809816517d4";
const source = `https://raw.githubusercontent.com/kagisearch/bangs/${KAGI_BANGS_COMMIT}/data/bangs.json`;

// Kagi resolves relative URLs against its own search, which needs an account. Send those to
// DuckDuckGo with the same query instead.
function resolveUrl(u) {
  if (/^https?:\/\//.test(u)) return new URL(u).href;
  const url = new URL(u, "https://duckduckgo.com");
  if (!["/search", "/html/search"].includes(url.pathname))
    return `https://duckduckgo.com/?q=${url.pathname.slice(1)}`;
  return `https://duckduckgo.com/${url.search}`;
}

export function normalizeBangs(data) {
  if (!Array.isArray(data) || !data.length)
    throw new Error("Kagi bangs catalog must be a non-empty array.");
  const shortcuts = new Set();
  const bangs = data.map((entry) => {
    if (
      !entry ||
      ["t", "s", "d", "u"].some(
        (key) => typeof entry[key] !== "string" || !entry[key],
      ) ||
      (entry.ts !== undefined &&
        (!Array.isArray(entry.ts) ||
          entry.ts.some((t) => typeof t !== "string" || !t))) ||
      (entry.x !== undefined && typeof entry.x !== "string")
    )
      throw new Error("Invalid entry in Kagi bangs catalog.");
    const relative = !/^https?:\/\//.test(entry.u);
    const u = resolveUrl(entry.u).replaceAll("%7B", "{").replaceAll("%7D", "}");
    const ts = [...new Set(entry.ts ?? [])].filter((t) => t !== entry.t);
    for (const t of [entry.t, ...ts]) {
      if (shortcuts.has(t)) throw new Error(`Duplicate Kagi shortcut: ${t}`);
      shortcuts.add(t);
    }
    const { s, d, t, c, sc, x } = entry;
    return {
      s: relative ? s.replace("(Kagi Search)", "(DuckDuckGo)") : s,
      d: relative && d === "kagi.com" ? "duckduckgo.com" : d,
      t,
      ...(ts.length && { ts }),
      u,
      ...(x && { x }),
      ...(c && { c }),
      ...(sc && { sc }),
    };
  });
  if (!shortcuts.has("ddg"))
    throw new Error("Kagi bangs catalog is missing the ddg fallback.");
  return bangs;
}

// Redirects only load what they need; names and categories are only shown on the settings page.
export function splitBangs(bangs) {
  return {
    bangs: bangs.map(({ s: _s, c: _c, sc: _sc, ...redirect }) => redirect),
    details: bangs.map(({ s, c, sc }) => ({
      s,
      ...(c && { c }),
      ...(sc && { sc }),
    })),
  };
}

// Engines parse JSON much faster than an equivalent object literal.
const jsonModule = (name, value) =>
  `export const ${name} = JSON.parse(${JSON.stringify(JSON.stringify(value))});`;

export function kagiBangs() {
  const ids = {
    "virtual:kagi-bangs": "bangs",
    "virtual:kagi-bang-details": "details",
  };
  let catalog;
  return {
    name: "kagi-bangs",
    resolveId(source) {
      if (source in ids) return `\0${source}`;
    },
    async load(moduleId) {
      const name = ids[moduleId.slice(1)];
      if (!moduleId.startsWith("\0") || !name) return;
      catalog ??= (async () => {
        const response = await fetch(source, {
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok)
          throw new Error(
            `Could not download Kagi bangs: HTTP ${response.status}`,
          );
        return splitBangs(normalizeBangs(await response.json()));
      })();
      return jsonModule(name, (await catalog)[name]);
    },
  };
}
