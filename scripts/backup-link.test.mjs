import assert from "node:assert/strict";
import test from "node:test";
import { decodeBackupLink, encodeBackupLink } from "../src/backup-link.ts";

test("import links round-trip backups, including non-ASCII text", () => {
  const backup = { version: 1, defaultBang: "ddg", bangs: [{ s: "Café ☕" }] };
  const hash = encodeBackupLink(JSON.stringify(backup));
  assert.match(hash, /^#import=[\w-]+$/);
  assert.deepEqual(decodeBackupLink(hash), backup);
});

test("import links decode base64url written by other tools", () => {
  // Python: base64.urlsafe_b64encode(b'{"a":"?>"}').rstrip(b"=")
  assert.deepEqual(decodeBackupLink("#import=eyJhIjoiPz4ifQ"), { a: "?>" });
});

test("other hashes are not import links", () => {
  assert.equal(decodeBackupLink(""), undefined);
  assert.equal(decodeBackupLink("#built-in-bangs"), undefined);
});

test("malformed import links throw", () => {
  assert.throws(() => decodeBackupLink("#import=not base64"));
  assert.throws(() => decodeBackupLink("#import=bm90IGpzb24"));
});
