# Architecture

Unduck is a static site on GitHub Pages. Everything happens in the browser: there is no
server code, and the bang catalog is bundled with the app.

## Redirects

The browser opens `?q=<query>`. `src/main.ts` then:

1. Reads the user's bangs, disabled bangs and default search engine from `localStorage`
   (`src/bang-store.ts`).
2. Finds the bang in the query with `parseQuery` (`src/query.ts`), accepting only enabled
   shortcuts.
3. Builds the destination: the search URL with `{{{s}}}` replaced by the encoded terms, the
   regular-expression captures for regex bangs, or the site's home page when there are no
   terms.
4. Calls `window.location.replace`, so the Unduck page stays out of the history.

`?page=settings` and the home page load `src/pages.ts` lazily, so searches don't download
or run the settings UI.

The PWA service worker from `vite-plugin-pwa` only precaches the app's files. It doesn't
handle searches: every search still loads the page and runs `main.ts`.

## Bang catalog

`scripts/kagi-bangs.mjs` is a Vite plugin. At build time it downloads `data/bangs.json` from
[kagisearch/bangs](https://github.com/kagisearch/bangs) at a pinned commit, then validates
and normalizes it:

- Relative URLs, which point at Kagi search and need an account, go to DuckDuckGo instead.
- Duplicate shortcuts and a missing `ddg` fallback fail the build.

The catalog is then split into two virtual modules:

- `virtual:kagi-bangs` holds what redirects need: shortcut, aliases, domain, URL and regex.
  It is embedded as a `JSON.parse` string, which browsers parse faster than a JavaScript
  object literal.
- `virtual:kagi-bang-details` holds names and categories. Only the settings page loads it,
  through `loadBangDetails` in `src/bang.ts`.

## Storage

Settings live in `localStorage`:

| Key                       | Content                                                 |
| ------------------------- | ------------------------------------------------------- |
| `added-bangs`             | Custom bangs, and built-ins the user edited             |
| `disabled-built-in-bangs` | Main shortcuts of disabled bangs                        |
| `known-built-in-bangs`    | The catalog's shortcuts when the selection last changed |
| `default-bang`            | The default search engine's shortcut                    |
| `block-disabled-bangs`    | `"false"` to keep the `!` of disabled bangs             |

Bangs not in `disabled-built-in-bangs` are enabled. When a catalog update brings shortcuts
missing from `known-built-in-bangs`, they start disabled, as long as the user has disabled
at least one bang.

Older versions stored a full edited catalog under `custom-bangs`; it is migrated on first
read.
