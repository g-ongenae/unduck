# Unduck

DuckDuckGo's bang redirects are too slow. Add the following URL as a custom search engine to your browser. Enables all of DuckDuckGo's bangs to work, but much faster.

```
https://g-ongenae.github.io/unduck/?q=%s
```

## Development

Install dependencies with `pnpm install`, then start the development server with `pnpm dev`.

- `pnpm lint` checks JavaScript and TypeScript with ESLint.
- `pnpm lint:fix` applies automatic lint fixes.
- `pnpm format` formats the project with Prettier.
- `pnpm format:check` checks formatting without changing files.
- `pnpm build` checks TypeScript and builds the production app.

CI runs lint, formatting, and build checks on pull requests and pushes to `main`.

## Firefox

Visit https://g-ongenae.github.io/unduck/, right-click the address bar, and choose
**Add “Unduck”** to install the site's OpenSearch definition with its magnifying-glass icon.
If you already added Unduck manually and see a different icon, remove that entry in
`about:preferences#search`, then add it again from the site. Firefox caches search-engine
icons separately from tab icons. Select Unduck as your default search engine afterward
if desired.

The OpenSearch definition uses the deployed GitHub Pages URL. If you host a fork
elsewhere, update the URLs in `public/opensearch.xml`.

## How is it that much faster?

DuckDuckGo does their redirects server side. Their DNS is...not always great. Result is that it often takes ages.

I solved this by doing all of the work client side. Once you've went to https://g-ongenae.github.io/unduck/ once, the JS is all cache'd and will never need to be downloaded again. Your device does the redirects, not me.
