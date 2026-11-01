import { bangs } from "./bang";
export type Bang = {
  t: string;
  s: string;
  d: string;
  c?: string;
  sc?: string;
  u: string;
  /** Other shortcuts for the same bang. A user bang without them keeps its built-in's aliases. */
  ts?: string[];
  /** Main shortcut of the built-in a user bang replaces, when its own shortcut differs. */
  o?: string;
  x?: string;
};
/** Holds whichever of `enabled` or `disabled` is shorter; bangs it doesn't list take the other state. */
export type Backup = {
  version: 1;
  defaultBang: string;
  bangs: Bang[];
  enabled?: string[];
  disabled?: string[];
};

export const USER_BANGS_KEY = "added-bangs";
const LEGACY_CATALOG_KEY = "custom-bangs";
export const DISABLED_BANGS_KEY = "disabled-built-in-bangs";
/** Built-in shortcuts at the time the user last saved a partial selection. */
const KNOWN_BUILT_INS_KEY = "known-built-in-bangs";
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
/** Main shortcut of the built-in that a user bang replaces, if any. */
export const overriddenShortcut = (b: Bang): string | undefined =>
  b.o ?? (builtInBang(b.t) ? b.t : undefined);
export const aliasesOf = (b: Bang): string[] =>
  b.ts ?? builtInBang(b.o ?? b.t)?.ts ?? [];

/** The bang that `t` triggers, enabled or not. User bangs win over built-ins they share a shortcut with. */
function findBang(t: string, userBangs: Bang[]): Bang | undefined {
  const userBang =
    userBangs.find((b) => b.t === t) ??
    userBangs.find((b) => aliasesOf(b).includes(t));
  if (userBang) return userBang;
  const builtIn = builtInBangFor(t);
  // A user bang replacing this built-in decides its shortcuts, so a renamed or removed one no longer applies.
  return builtIn && !userBangs.some((b) => overriddenShortcut(b) === builtIn.t)
    ? builtIn
    : undefined;
}
/** The main shortcut that `t` triggers: a user bang's own, or the built-in an alias belongs to. */
export const mainShortcut = (t: string, userBangs = readUserBangs()) =>
  findBang(t, userBangs)?.t ?? t;
export const sameBang = (a: Bang, b: Bang) =>
  a.t === b.t &&
  a.s === b.s &&
  a.d === b.d &&
  (a.c ?? "") === (b.c ?? "") &&
  (a.sc ?? "") === (b.sc ?? "") &&
  a.u === b.u &&
  aliasesOf(a).join(" ") === aliasesOf(b).join(" ");

/** Migrating it compares entries with the built-ins' names and categories, which must be loaded first. */
export const hasLegacyCatalog = () =>
  localStorage.getItem(LEGACY_CATALOG_KEY) !== null;

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
function readStrings(key: string): string[] | null {
  const value = readJson(key);
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : null;
}

// When the user picked a subset of bangs, built-ins added by a later catalog refresh start disabled
// instead of silently joining their selection. A built-in renamed to one of its former aliases keeps
// that alias's state.
function disableNewBuiltIns(disabled: Set<string>) {
  if (!disabled.size) return;
  const stored = readStrings(KNOWN_BUILT_INS_KEY);
  if (!stored) {
    writeDisabledBangs(disabled);
    return;
  }
  const known = new Set(stored);
  let changed = stored.length !== bangs.length;
  for (const b of bangs) {
    if (known.has(b.t)) continue;
    changed = true;
    const former = (b.ts ?? []).filter((t) => known.has(t));
    if (!former.length || former.some((t) => disabled.has(t)))
      disabled.add(b.t);
  }
  if (changed) writeDisabledBangs(disabled);
}

// Shortcuts that are no longer a bang, such as built-ins a catalog refresh removed or turned into
// aliases, would otherwise linger forever and silently disable a user bang later added under them.
function dropStaleShortcuts(disabled: Set<string>) {
  const userShortcuts = new Set(
    (readList(USER_BANGS_KEY) ?? []).map((b) => b.t),
  );
  let changed = false;
  for (const t of disabled)
    if (!builtInBang(t) && !userShortcuts.has(t)) changed = disabled.delete(t);
  if (changed) writeDisabledBangs(disabled);
}

export function readDisabledBangs(): Set<string> {
  const disabled = new Set(readStrings(DISABLED_BANGS_KEY) ?? []);
  disableNewBuiltIns(disabled);
  dropStaleShortcuts(disabled);
  return disabled;
}
export function writeDisabledBangs(disabled: Set<string>) {
  localStorage.setItem(DISABLED_BANGS_KEY, JSON.stringify([...disabled]));
  if (disabled.size)
    localStorage.setItem(
      KNOWN_BUILT_INS_KEY,
      JSON.stringify(bangs.map((b) => b.t)),
    );
  else localStorage.removeItem(KNOWN_BUILT_INS_KEY);
}
export const readDefaultShortcut = () =>
  localStorage.getItem(DEFAULT_BANG_KEY) ?? FALLBACK_BANG;

/** User bangs first, then the built-ins they don't override. */
export function activeBangs(userBangs = readUserBangs()): Bang[] {
  const overridden = new Set(userBangs.map(overriddenShortcut));
  return [...userBangs, ...bangs.filter((b) => !overridden.has(b.t))];
}

export function findEnabledBang(
  t: string,
  userBangs = readUserBangs(),
  disabled = readDisabledBangs(),
): Bang | undefined {
  // Aliases follow their bang's enabled state.
  const bang = findBang(t, userBangs);
  return bang && !disabled.has(bang.t) ? bang : undefined;
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
  if (bang) return { bang, requested, usable: true };
  // Follow the fallback built-in even if the user renamed it or removed its alias.
  const builtIn = builtInBangFor(FALLBACK_BANG)!;
  return {
    bang:
      findBang(FALLBACK_BANG, userBangs) ??
      userBangs.find((b) => overriddenShortcut(b) === builtIn.t) ??
      builtIn,
    requested,
    usable: false,
  };
}

const SHORTCUT = /^!?[^\s!]+$/;
const normalizeShortcut = (t: string) => t.replace(/^!/, "").toLowerCase();

export function validateBang(value: unknown): Bang {
  const b = value as Bang;
  if (
    !b ||
    typeof b.t !== "string" ||
    !SHORTCUT.test(b.t) ||
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
  if (
    b.ts !== undefined &&
    (!Array.isArray(b.ts) ||
      b.ts.some((t) => typeof t !== "string" || !SHORTCUT.test(t)))
  )
    throw new Error("Use aliases without spaces.");
  if (b.o !== undefined && (typeof b.o !== "string" || !builtInBang(b.o)))
    throw new Error("The replaced built-in bang does not exist.");
  const t = normalizeShortcut(b.t);
  return {
    t,
    s: b.s?.trim() || b.d,
    d: b.d,
    c: b.c ?? "",
    sc: b.sc ?? "",
    u: b.u,
    ...(b.ts && {
      ts: [...new Set(b.ts.map(normalizeShortcut))].filter((a) => a !== t),
    }),
    ...(b.o && b.o !== t && { o: b.o }),
  };
}

export function exportBackup(): Backup {
  const userBangs = readUserBangs();
  const disabled = readDisabledBangs();
  const shortcuts = activeBangs(userBangs).map((b) => b.t);
  const enabled = shortcuts.filter((t) => !disabled.has(t));
  return {
    version: 1,
    defaultBang: readDefaultShortcut(),
    bangs: userBangs,
    ...(enabled.length < disabled.size
      ? { enabled }
      : { disabled: shortcuts.filter((t) => disabled.has(t)) }),
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
  const { enabled, disabled, defaultBang } = data as Backup;
  const list = enabled ?? disabled;
  if (!Array.isArray(list) || list.some((t) => typeof t !== "string"))
    throw new Error("The backup has an invalid list of enabled bangs.");
  if (typeof defaultBang !== "string" || !defaultBang)
    throw new Error("The backup has an invalid default search engine.");
  if (!enabled) return { bangs: entries, disabled: list, defaultBang };
  const kept = new Set(list);
  return {
    bangs: entries,
    disabled: activeBangs(entries)
      .map((b) => b.t)
      .filter((t) => !kept.has(t)),
    defaultBang,
  };
}
