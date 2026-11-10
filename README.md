# Unduck

Fork of [T3-Content/unduck](https://github.com/T3-Content/unduck), focused on:

1. **Simplicity and configurability**: keep only the bangs you use, and shape them to your needs.
2. **Privacy**: redirects run in your browser, with no analytics and no server.
3. **Speed**: no round-trip to a search engine before the redirect.

Add this URL as a custom search engine in your browser:

```
https://g-ongenae.github.io/unduck/?q=%s
```

On Firefox, you can instead right-click the address bar on
https://g-ongenae.github.io/unduck/ and choose **Add “Unduck”**.

## Comparison with others

- **DuckDuckGo, Kagi, Brave**: resolve bangs on their servers, which adds a network
  round-trip to every search.
- **[T3-Content/unduck](https://github.com/T3-Content/unduck)**: the original. DuckDuckGo
  catalog, Plausible analytics, no settings page.
- **[Flashbang](https://github.com/ph1losof/flashbang)**: redirects from a service worker
  before the page renders. 14,000+ bangs, all enabled, plus site searches (`@w`), "Feeling
  Lucky" and address-bar suggestions through its server. AGPL-3.0.
- **[unduckified](https://github.com/taciturnaxolotl/unduckified)**: service-worker
  redirects and address-bar suggestions. The hosted version loads Cloudflare's analytics
  beacon.
- **[bangs.fast](https://github.com/kristianvld/bangs.fast)**: static like this one, with a
  choice of the DuckDuckGo or Kagi catalog and private `#q=` searches.
- **[ReBang](https://github.com/Void-n-Null/rebang)** and
  **[cf-unduck](https://github.com/mynameistito/cf-unduck)**: redirect from a Cloudflare
  Worker, so searches go through a server. Both ship analytics.

Details on the other tools come from
[Flashbang's comparison](https://github.com/ph1losof/flashbang#comparison-with-other-bang-tools)
as of November 2026.

## Learn more

- [Features](docs/FEATURES.md): bang syntax, settings, backups and import links.
- [Architecture](docs/ARCHITECTURE.md): how redirects and the catalog work.
- [Development](docs/DEVELOPMENT.md): commands, catalog updates and CI.
- [Plan](PLAN.md): what comes next.
