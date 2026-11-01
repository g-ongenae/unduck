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

// Engines parse JSON much faster than an equivalent object literal.
const jsonModule = (name, value) =>
  `export const ${name} = JSON.parse(${JSON.stringify(JSON.stringify(value))});`;

export function kagiBangs() {
  const id = "virtual:kagi-bangs";
  let catalog;
  return {
    name: "kagi-bangs",
    resolveId(source) {
      if (source === id) return `\0${id}`;
    },
    async load(moduleId) {
      if (moduleId !== `\0${id}`) return;
      catalog ??= (async () => {
        const response = await fetch(source, {
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok)
          throw new Error(
            `Could not download Kagi bangs: HTTP ${response.status}`,
          );
        return normalizeBangs(await response.json());
      })();
      return jsonModule("bangs", await catalog);
    },
  };
}
