# Plan

Unduck aims for three things, in this order:

1. **Simplicity and configurability**: only the bangs you use, shaped to your needs.
2. **Privacy**: everything stays in the browser.
3. **Speed**: the redirect should cost as little as possible.

Ideally, nothing should be hosted at all: the redirect should run entirely in the browser.

## 1. Start with no bangs, and configure them while browsing

### Today

All ~14,000 Kagi built-ins are enabled by default: `disabled-built-in-bangs` starts empty.
Built-ins added by later catalog updates start disabled only once the user has disabled at
least one bang (`disableNewBuiltIns` in `src/bang-store.ts`). In practice, a new user gets
the whole catalog, which goes against the first goal.

### Goal

A new user starts with no bangs enabled, apart from the default search engine (`ddg`). The
selection grows from the bangs they actually use.

Each bang then has one of three states:

- **Enabled**: the user turned it on, or added it.
- **Disabled**: the user turned it off. Its `!` is removed before the default search, as
  today.
- **Not configured**: in the catalog, never chosen.

When the user searches with a shortcut that is not configured, two options:

- **A. Ask right away.** Unduck shows a small page instead of redirecting, for example
  "`!gh` → GitHub, `github.com/search?q=react`", with:
  - **Enable and go** (default, so Enter is enough).
  - **Go once**: redirect without enabling it.
  - **Edit**: open the bang panel with the catalog entry pre-filled.
  - **Disable**: then search without it.

  The same page handles shortcuts that are not in the catalog: "`!foo` is not a bang. Add
  one?", with the shortcut pre-filled.

- **B. Redirect, review later.** Unduck redirects with the catalog entry and records the
  shortcut as used. Settings then shows a **Used, not configured (n)** filter and a badge,
  where the user enables, edits or disables each one. Unknown shortcuts go to the default
  search, and are listed too, with an **Add bang** button.

Recommendation: B by default, so searching is never interrupted, with a setting **Ask before
using a new bang** that switches to A. Both share the "not configured" state and the
pre-filled bang panel.

### Details to settle

- **Existing users** keep their current selection. Settings could offer **Keep only the
  bangs I've used** once enough usage has been recorded locally.
- **Storage**: with few bangs enabled, storing the enabled list is smaller than the disabled
  one. Backups already support both (`enabled` or `disabled`).
- **Usage stays local**: the recorded shortcuts and counts never leave the browser, and are
  part of backups only if the user wants.
- **Speed bonus**: the enabled bangs' full entries could be copied to `localStorage`, so
  redirects to them don't need the 1.1 MB catalog chunk at all. The catalog would only load
  for shortcuts that are not configured yet.

## 2. Ideas from Flashbang

[Flashbang](https://github.com/ph1losof/flashbang) is the most complete bang redirector we
compared with, in November 2026. Ordered by value for our goals:

1. **Redirect from a service worker.** Flashbang's worker answers `?q=` with a 302 before
   the page renders; ours only precaches files, so every search loads the page and parses
   the catalog on the main thread. With `vite-plugin-pwa` in `injectManifest` mode, we can
   add a fetch handler. Service workers can't read `localStorage`, so settings would move
   to IndexedDB first. Skip this if the extension (section 3) replaces the hosted app.
2. **A smaller redirect table.** Flashbang ships a ~545 KiB packed shortcut → URL lookup;
   our redirect chunk is ~1.1 MB of JSON. Section 1's "enabled bangs only" achieves more
   with less work.
3. **Automatic catalog updates.** A scheduled workflow could open a pull request bumping
   `KAGI_BANGS_COMMIT` when kagisearch/bangs changes.
4. **OpenSearch for forks.** Generate `public/opensearch.xml` and the home page URL from
   Vite's `base` and an environment variable, so forks don't edit three files.
5. **Maybe, all opt-in:** site searches (`@w quantum` → `quantum site:wikipedia.org`),
   "Feeling Lucky" (`\query`), private `#q=%s` searches. Only if they stay simple.

Out of scope:

- **Address-bar suggestions**: they need a server, which goes against the privacy goal.
- **Suffix bangs**: already supported (`gh! react`, `react gh!`).

## 3. Run entirely in the browser: a WebExtension

A WebExtension runs the same code on Firefox and on Chromium browsers (Chrome, Edge, Brave,
Vivaldi, Arc), with nothing hosted. Firefox autoconfig (`mozilla.cfg`) would also work, but
only on Firefox.

### How it would work

1. **Search URL on a host that doesn't exist**, such as `https://unduck.invalid/?q=%s`.
2. **One `declarativeNetRequest` redirect rule per enabled bang**, built by the extension:

   ```json
   {
     "priority": 2,
     "action": {
       "type": "redirect",
       "redirect": { "regexSubstitution": "https://github.com/search?q=\\1" }
     },
     "condition": {
       "regexFilter": "^https://unduck\\.invalid/\\?q=!gh(?:\\+|%20)(.*)$",
       "resourceTypes": ["main_frame"]
     }
   }
   ```

   A lower-priority catch-all rule sends everything else to the default search engine. The
   browser applies these rules before the request is sent: no page load and no JavaScript
   on the search path.

3. **Rules rebuilt on every settings change**, with `updateDynamicRules` from the settings
   page, which becomes an extension page.
4. **An extension page for what rules can't express**: regex bangs, `shortcut!` syntax,
   `%2F` → `/`, `!bang` → settings, and section 1's "not configured" flow. It reuses
   `src/main.ts`.

### Limits

Chrome allows 5,000 dynamic redirect rules and 1,000 regex rules per extension. That rules
out the whole catalog, but fits section 1: most users enable tens to hundreds of bangs.
Above 1,000, the extra bangs go through the extension page.

### Check first, in a small prototype on Chrome and Firefox

- **Does a rule fire for a host that doesn't resolve?** Chrome's documentation says rules
  run before the request is sent, but doesn't mention DNS. If it doesn't fire, match bang
  queries on the user's real default engine instead, such as `google.com/search?q=!…`. That
  is also nicer: users keep their usual engine.
- **Can a rule redirect to an extension page with the query?** The documented
  `extensionPath` is a fixed path. A `regexSubstitution` to `chrome-extension://<id>/…`, with
  the page in `web_accessible_resources`, may work. Otherwise, use `webNavigation` and
  `tabs.update`, which is slightly slower but still never hits the network.
- **Can the extension register the search engine?** `chrome_settings_overrides` works on
  Firefox, and probably only on Windows and macOS on Chrome, after a prompt. Otherwise,
  users add it once by hand.

### Setup with policies

Enterprise policies also work on Chromium, not just Firefox:

- Firefox: `policies.json` (`ExtensionSettings`, `SearchEngines`).
- Chrome: `ExtensionInstallForcelist`, `DefaultSearchProviderSearchURL`, through a plist
  on macOS.

One policy file plus an import link could install the extension, set the search engine and
restore the same bangs on every browser.

### Distribution

- **Firefox**: extensions must be signed by Mozilla. Self-distributed signing is free and
  automated with `web-ext sign`. Only Developer Edition and Nightly run unsigned ones.
- **Chrome**: the Web Store has a one-time $5 fee and a review. Loading it unpacked in
  developer mode avoids both, but is clunkier.
- **Safari**: possible, with an Xcode wrapper.

### What carries over

`src/query.ts`, `src/bang-store.ts`, `src/pages.ts` and the Kagi Vite plugin carry over
almost unchanged. Storage moves from `localStorage` to `chrome.storage.local`.

## 4. Rename

"Unduck" refers to DuckDuckGo, but the catalog comes from Kagi and the project may stop
being a website. Pick a name before publishing an extension, since store listings are
harder to rename. Candidates, to check for conflicts on GitHub, npm and the extension
stores:

- **Pocketbang**: your own small set of bangs, carried in your browser.
- **Homebang**: bangs that run at home, on your machine.
- **Barebang**: minimal, nothing you didn't choose.
- **Onehop**: one hop straight to the site, no detour through a search engine.
- **Bangkit**: a kit you assemble from the bangs you use.

## Order

1. Section 1, start with no bangs: small, and the base for the rest.
2. Prototype section 3 to answer its open questions.
3. If the extension works, port the app and rename. If it doesn't, do section 2's service
   worker instead.
4. Section 2's smaller items whenever convenient.
