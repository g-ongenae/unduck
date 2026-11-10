# Features

## Bang syntax

Bangs are case-insensitive. Any word written as `!shortcut` works, and `shortcut!` works as
the first or last word:

| Query          | Result                         |
| -------------- | ------------------------------ |
| `!gh react`    | GitHub search for "react"      |
| `react !gh`    | GitHub search for "react"      |
| `gh! react`    | GitHub search for "react"      |
| `react gh!`    | GitHub search for "react"      |
| `!gh`          | github.com home page           |
| `react`        | Your default search engine     |
| `!bang github` | Settings, filtered on "github" |

Unknown and disabled shortcuts stay in the search terms. By default, disabled bangs also
lose their `!`, so the default search engine cannot run them itself; turn off **Prevent
search engines from using disabled bangs** in settings to keep it.

Some catalog bangs use a regular expression to pick parts of the query, such as a repository
name. When the query doesn't match, they open the site's home page.

## Settings

Open settings with the ⚙️ button on the home page, or search `!bang`.

- **Default search engine**: the bang used when a query has none. It falls back to `ddg`
  when the chosen bang is missing or disabled, and the page warns about it.
- **Enable and disable bangs**: the bang list can be searched by shortcut, site, domain,
  category or URL, and sorted. It shows how many bangs are enabled, disabled,
  custom and modified. Once you disable a bang, bangs added to the catalog later start
  disabled, so they don't silently join your selection.
- **Custom bangs**: add your own, or edit a built-in one. You can change its shortcut, name,
  domain, categories, search URL and aliases, and reset it to the catalog version later.
  Custom bangs take priority over built-ins with the same shortcut.

## Backups

**Export** downloads your custom bangs, enabled bangs and default search engine as JSON.
**Import** restores such a file, after confirmation.

### Import links

Settings opened with `#import=` followed by a backup's JSON in base64url restore that backup
after you confirm, as the **Import** button does, so a setup script can bring the same bangs
to every browser:

```
https://g-ongenae.github.io/unduck/?page=settings#import=eyJ2ZXJzaW9uIjox...
```

The hash never reaches the server, and is removed from the address bar before the import.

## Firefox

Visit https://g-ongenae.github.io/unduck/, right-click the address bar, and choose
**Add “Unduck”** to install the site's OpenSearch definition with its magnifying-glass icon.
If you already added Unduck manually and see a different icon, remove that entry in
`about:preferences#search`, then add it again from the site. Firefox caches search-engine
icons separately from tab icons. Select Unduck as your default search engine afterward if
desired.

## Offline

The app is a PWA: once you've visited it, its files are cached, and redirects work without a
network connection to GitHub Pages.
