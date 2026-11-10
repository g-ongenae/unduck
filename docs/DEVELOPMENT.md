# Development

Install dependencies with `pnpm install`, then start the development server with `pnpm dev`.

- `pnpm lint` checks JavaScript and TypeScript with ESLint.
- `pnpm lint:fix` applies automatic lint fixes.
- `pnpm format` formats the project with Prettier.
- `pnpm format:check` checks formatting without changing files.
- `pnpm test` runs the tests in `scripts/*.test.mjs`.
- `pnpm build` checks TypeScript and builds the production app.

CI runs lint, formatting, test, and build checks on pull requests and pushes to `main`.
Pushes to `main` also deploy the app to GitHub Pages.

## Bang catalog

Development and production builds download `data/bangs.json` from
[kagisearch/bangs](https://github.com/kagisearch/bangs) at the commit pinned in
`scripts/kagi-bangs.mjs`; update `KAGI_BANGS_COMMIT` to pick up upstream changes.
Starting Vite requires network access, and a failed download or invalid catalog stops the
build. Upstream licensing is preserved in `scripts/KAGI-BANGS-LICENSE`.

See [Architecture](ARCHITECTURE.md#bang-catalog) for how the catalog is processed.

## Hosting a fork

The OpenSearch definition uses the deployed GitHub Pages URL. If you host a fork
elsewhere, update the URLs in `public/opensearch.xml`, the search URL shown on the home
page in `src/pages.ts`, and `base` in `vite.config.ts`.
