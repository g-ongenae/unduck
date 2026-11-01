import { bangs } from './bang';
export type Bang = { t: string; s: string; d: string; c?: string; sc?: string; u: string };
export function readList(key: string): Bang[] | null {
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!Array.isArray(data)) return null;
    return data.filter(b => typeof b?.t === 'string' && typeof b?.u === 'string' && typeof b?.d === 'string').map(b => ({ ...b, s: b.s ?? b.d }));
  } catch { return null; }
}
export function activeBangs(): Bang[] {
  return [...(readList('added-bangs') ?? []), ...(readList('custom-bangs') ?? bangs)];
}
export function validateBang(value: unknown): Bang {
  const b = value as Bang;
  if (!b || typeof b.t !== 'string' || !/^!?[^\s!]+$/.test(b.t) || typeof b.u !== 'string' || !b.u.includes('{{{s}}}')) throw new Error('Use a shortcut without spaces and a search URL containing {{{s}}}.');
  let url: URL;
  try { url = new URL(b.u); } catch { throw new Error("Enter a valid search URL, such as https://example.com/search?q={{{s}}}."); }
  if (typeof b.d === "string") b.d = b.d.trim().toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Search URLs must use HTTP or HTTPS.');
  if (typeof b.d !== 'string' || !b.d.trim() || /[\s/?#]/.test(b.d) || new URL(`https://${b.d}`).host !== b.d) throw new Error('Enter a domain such as github.com, without a protocol or path.');
  for (const key of ['s', 'c', 'sc'] as const) if (b[key] !== undefined && typeof b[key] !== 'string') throw new Error('Site and categories must be text.');
  return { t: b.t.replace(/^!/, '').toLowerCase(), s: b.s?.trim() || b.d, d: b.d, c: b.c ?? '', sc: b.sc ?? '', u: b.u };
}
