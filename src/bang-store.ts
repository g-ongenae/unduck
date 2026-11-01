import { bangs } from "./bang";
export type Bang = {
  t: string;
  s: string;
  d: string;
  c?: string;
  sc?: string;
  u: string;
  /** Aliases of a built-in shortcut. */
  ts?: string[];
  x?: string;
};
export type Backup = {
  version: 1;
  defaultBang: string;
  bangs: Bang[];
  disabled: string[];
};

export const USER_BANGS_KEY = "added-bangs";
const LEGACY_CATALOG_KEY = "custom-bangs";
export const DISABLED_BANGS_KEY = "disabled-built-in-bangs";
export const DEFAULT_BANG_KEY = "default-bang";
export const FALLBACK_BANG = "ddg";

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function readList(key: string): Bang[] | null {
  const data = readJson(key);
  if (!Array.isArray(data)) return null;
  return data
    .filter(
      (b) =>
        typeof b?.t === "string" &&
        typeof b?.u === "string" &&
        typeof b?.d === "string",
    )
    .map((b) => ({ ...b, s: b.s ?? b.d }));
}

const builtInsByShortcut = new Map(
  bangs.flatMap((b) => [b.t, ...(b.ts ?? [])].map((t) => [t, b] as const)),
);
/** The built-in bang whose main shortcut is `t`. */
export const builtInBang = (t: string): Bang | undefined => {
  const bang = builtInsByShortcut.get(t);
  return bang?.t === t ? bang : undefined;
};
/** The built-in bang that `t` triggers, either as its main shortcut or as an alias. */
export const builtInBangFor = (t: string): Bang | undefined =>
  builtInsByShortcut.get(t);
/** The main shortcut that `t` triggers: a user bang's own, or the built-in an alias belongs to. */
export const mainShortcut = (t: string, userBangs = readUserBangs()) =>
  userBangs.some((b) => b.t === t) ? t : (builtInBangFor(t)?.t ?? t);
export const sameBang = (a: Bang, b: Bang) =>
  a.t === b.t &&
  a.s === b.s &&
  a.d === b.d &&
  (a.c ?? "") === (b.c ?? "") &&
  (a.sc ?? "") === (b.sc ?? "") &&
  a.u === b.u;

// Imports used to replace the whole catalog under LEGACY_CATALOG_KEY. Keep that behavior by turning
// changed entries into overrides and disabling built-ins the imported catalog left out.
function migrateLegacyCatalog() {
  const catalog = readList(LEGACY_CATALOG_KEY);
  if (!catalog) return;
  const imported = new Map(catalog.map((b) => [b.t, b]));
  const overrides = catalog.filter((b) => {
    const builtIn = builtInBang(b.t);
    return !builtIn || !sameBang(b, builtIn);
  });
  const added = (readList(USER_BANGS_KEY) ?? []).filter(
    (b) => !overrides.some((o) => o.t === b.t),
  );
  const disabled = readDisabledBangs();
  for (const b of bangs)
    if (![b.t, ...(b.ts ?? [])].some((t) => imported.has(t))) disabled.add(b.t);
  writeUserBangs([...added, ...overrides]);
  writeDisabledBangs(disabled);
  localStorage.removeItem(LEGACY_CATALOG_KEY);
}

export function readUserBangs(): Bang[] {
  migrateLegacyCatalog();
  return readList(USER_BANGS_KEY) ?? [];
}
export function writeUserBangs(list: Bang[]) {
  localStorage.setItem(USER_BANGS_KEY, JSON.stringify(list));
}
export function readDisabledBangs(): Set<string> {
  const value = readJson(DISABLED_BANGS_KEY);
  return new Set(
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [],
  );
}
export function writeDisabledBangs(disabled: Set<string>) {
  localStorage.setItem(DISABLED_BANGS_KEY, JSON.stringify([...disabled]));
}
export const readDefaultShortcut = () =>
  localStorage.getItem(DEFAULT_BANG_KEY) ?? FALLBACK_BANG;

/** User bangs first, then the built-ins they don't override. */
export function activeBangs(userBangs = readUserBangs()): Bang[] {
  const overridden = new Set(userBangs.map((b) => b.t));
  return [...userBangs, ...bangs.filter((b) => !overridden.has(b.t))];
}

export function findEnabledBang(
  t: string,
  userBangs = readUserBangs(),
  disabled = readDisabledBangs(),
): Bang | undefined {
  const userBang = userBangs.find((b) => b.t === t);
  if (userBang) return disabled.has(t) ? undefined : userBang;
  // Aliases follow their built-in, including its enabled state and any override.
  const builtIn = builtInBangFor(t);
  if (!builtIn || disabled.has(builtIn.t)) return undefined;
  return userBangs.find((b) => b.t === builtIn.t) ?? builtIn;
}

export type DefaultResolution = {
  bang: Bang;
  requested: string;
  usable: boolean;
};
export function resolveDefaultBang(
  userBangs = readUserBangs(),
  disabled = readDisabledBangs(),
): DefaultResolution {
  const requested = readDefaultShortcut();
  const bang = findEnabledBang(requested, userBangs, disabled);
  const fallback = mainShortcut(FALLBACK_BANG, userBangs);
  return bang
    ? { bang, requested, usable: true }
    : {
        bang: userBangs.find((b) => b.t === fallback) ?? builtInBang(fallback)!,
        requested,
        usable: false,
      };
}

export function validateBang(value: unknown): Bang {
  const b = value as Bang;
  if (
    !b ||
    typeof b.t !== "string" ||
    !/^!?[^\s!]+$/.test(b.t) ||
    typeof b.u !== "string" ||
    !b.u.includes("{{{s}}}")
  )
    throw new Error(
      "Use a shortcut without spaces and a search URL containing {{{s}}}.",
    );
  let url: URL;
  try {
    url = new URL(b.u);
  } catch {
    throw new Error(
      "Enter a valid search URL, such as https://example.com/search?q={{{s}}}.",
    );
  }
  if (typeof b.d === "string") b.d = b.d.trim().toLowerCase();
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Search URLs must use HTTP or HTTPS.");
  if (
    typeof b.d !== "string" ||
    !b.d.trim() ||
    /[\s/?#]/.test(b.d) ||
    new URL(`https://${b.d}`).host !== b.d
  )
    throw new Error(
      "Enter a domain such as github.com, without a protocol or path.",
    );
  for (const key of ["s", "c", "sc"] as const)
    if (b[key] !== undefined && typeof b[key] !== "string")
      throw new Error("Site and categories must be text.");
  return {
    t: b.t.replace(/^!/, "").toLowerCase(),
    s: b.s?.trim() || b.d,
    d: b.d,
    c: b.c ?? "",
    sc: b.sc ?? "",
    u: b.u,
  };
}

export function exportBackup(): Backup {
  return {
    version: 1,
    defaultBang: readDefaultShortcut(),
    bangs: readUserBangs(),
    disabled: [...readDisabledBangs()],
  };
}

/** Accepts a full backup, or a plain array of bangs exported by earlier versions. */
export function parseBackup(data: unknown): {
  bangs: Bang[];
  disabled?: string[];
  defaultBang?: string;
} {
  const isBackup =
    !Array.isArray(data) &&
    typeof data === "object" &&
    data !== null &&
    (data as Backup).version === 1;
  const raw = isBackup ? (data as Backup).bangs : data;
  if (!Array.isArray(raw))
    throw new Error("Choose an Unduck backup or a JSON array of bangs.");
  const entries = raw.map((value, index) => {
    try {
      return validateBang(value);
    } catch (e) {
      if (e instanceof Error) e.message = `Entry ${index + 1}: ${e.message}`;
      throw e;
    }
  });
  if (new Set(entries.map((b) => b.t)).size !== entries.length)
    throw new Error("The file contains duplicate shortcuts.");
  if (!isBackup) return { bangs: entries };
  const { disabled, defaultBang } = data as Backup;
  if (!Array.isArray(disabled) || disabled.some((t) => typeof t !== "string"))
    throw new Error("The backup has an invalid list of disabled bangs.");
  if (typeof defaultBang !== "string" || !defaultBang)
    throw new Error("The backup has an invalid default search engine.");
  return { bangs: entries, disabled, defaultBang };
}
