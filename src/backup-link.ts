/** Prefix of the URL hash that carries a backup, such as `#import=eyJ2ZXJzaW9uIjoxfQ`. */
export const IMPORT_HASH = "#import=";

/** The backup JSON a `#import=` link carries, as base64url without padding. */
export function encodeBackupLink(json: string): string {
  const binary = String.fromCodePoint(...new TextEncoder().encode(json));
  return (
    IMPORT_HASH +
    btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  );
}

/** Parses the backup a `#import=` hash carries, or returns undefined for other hashes. */
export function decodeBackupLink(hash: string): unknown {
  if (!hash.startsWith(IMPORT_HASH)) return undefined;
  const data = hash.slice(IMPORT_HASH.length);
  if (!/^[\w-]+$/.test(data))
    throw new Error("The import link is not valid base64url.");
  const binary = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (c) => c.codePointAt(0)!);
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
