# Unduck

DuckDuckGo's bang redirects are too slow. Add the following URL as a custom search engine to your browser. Uses the community-maintained [Kagi bangs catalog](https://github.com/kagisearch/bangs) for fast client-side redirects.

```
https://g-ongenae.github.io/unduck/?q=%s
```

## Development

Install dependencies with `pnpm install`, then start the development server with `pnpm dev`.

- `pnpm lint` checks JavaScript and TypeScript with ESLint.
- `pnpm lint:fix` applies automatic lint fixes.
- `pnpm format` formats the project with Prettier.
- `pnpm format:check` checks formatting without changing files.
- `pnpm test` runs the catalog import tests.
- `pnpm build` checks TypeScript and builds the production app.

Development and production builds download `data/bangs.json` from
[kagisearch/bangs](https://github.com/kagisearch/bangs) at the commit pinned in
`scripts/kagi-bangs.mjs`; update `KAGI_BANGS_COMMIT` to pick up upstream changes.
Relative search URLs, which point at Kagi search, are sent to DuckDuckGo with the same
query instead. The catalog is bundled with the app; searches do not fetch it at
runtime. Starting Vite requires network access, and a failed download or invalid
catalog stops the build. Upstream licensing is preserved in
`scripts/KAGI-BANGS-LICENSE`.

CI runs lint, formatting, test, and build checks on pull requests and pushes to `main`.

## Firefox

Visit https://g-ongenae.github.io/unduck/, right-click the address bar, and choose
**Add “Unduck”** to install the site's OpenSearch definition with its magnifying-glass icon.
If you already added Unduck manually and see a different icon, remove that entry in
`about:preferences#search`, then add it again from the site. Firefox caches search-engine
icons separately from tab icons. Select Unduck as your default search engine afterward
if desired.

The OpenSearch definition uses the deployed GitHub Pages URL. If you host a fork
elsewhere, update the URLs in `public/opensearch.xml`.

## Import links

Settings opened with `#import=` followed by a backup's JSON in base64url restore that
backup after you confirm, as the **Import** button does, so a setup script can bring the
same bangs to every browser:

```
https://g-ongenae.github.io/unduck/?page=settings#import=eyJ2ZXJzaW9uIjox...
```

The hash never reaches the server, and is removed from the address bar before the import.

## How is it that much faster?

DuckDuckGo does their redirects server side. Their DNS is...not always great. Result is that it often takes ages.

I solved this by doing all of the work client side. Once you've went to https://g-ongenae.github.io/unduck/ once, the JS is all cache'd and will never need to be downloaded again. Your device does the redirects, not me.
