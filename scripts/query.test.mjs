import assert from "node:assert/strict";
import test from "node:test";
import { parseQuery } from "../src/query.ts";

const parse = (query, blockDisabled = true) =>
  parseQuery(
    query,
    (t) => t === "g",
    (t) => blockDisabled && ["docs", "scribd"].includes(t),
  );

test("disabled bangs are forwarded unchanged when prevention is off", () => {
  for (const query of ["!scribd book", "book docs!", "!DOCS", "scribd! book"]) {
    assert.deepEqual(parse(query, false), { terms: query });
  }
  assert.deepEqual(parse("!g !scribd book", false), {
    shortcut: "g",
    terms: "!scribd book",
  });
});

test("disabled main shortcuts and aliases become ordinary search terms", () => {
  for (const shortcut of ["docs", "scribd", "SCRIBD"]) {
    assert.deepEqual(parse(`!${shortcut} book`), { terms: `${shortcut} book` });
    assert.deepEqual(parse(`book !${shortcut}`), { terms: `book ${shortcut}` });
    assert.deepEqual(parse(`${shortcut}! book`), { terms: `${shortcut} book` });
    assert.deepEqual(parse(`book ${shortcut}!`), { terms: `book ${shortcut}` });
    assert.deepEqual(parse(`!${shortcut}`), { terms: shortcut });
  }
});

test("enabled bangs still work with disabled bangs in the remaining terms", () => {
  assert.deepEqual(parse("!scribd book !g !docs"), {
    shortcut: "g",
    terms: "scribd book docs",
  });
});

test("unknown bangs and punctuation keep their existing behavior", () => {
  assert.deepEqual(parse("!unknown book"), { terms: "!unknown book" });
  assert.deepEqual(parse("book scribd! review"), {
    terms: "book scribd! review",
  });
  assert.deepEqual(
    parseQuery("!scribd book", () => false),
    {
      terms: "!scribd book",
    },
  );
});
