import { loadBangDetails } from "./bang";
import {
  findEnabledBang,
  hasLegacyCatalog,
  mainShortcut,
  readBlockDisabledBangs,
  readDisabledBangs,
  readUserBangs,
  resolveDefaultBang,
} from "./bang-store";
import { parseQuery } from "./query";

const loadPages = () =>
  Promise.all([import("./pages"), loadBangDetails()]).then(([pages]) => pages);

function showSettings(filter?: string) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("page", "settings");
  if (filter) url.searchParams.set("filter", filter);
  url.hash = "built-in-bangs";
  window.history.replaceState(null, "", url);
  return loadPages().then(({ renderSettingsPage }) => renderSettingsPage());
}

function getRedirectUrl(query: string) {
  const userBangs = readUserBangs();
  const disabled = readDisabledBangs();
  const userCatalogBang = userBangs.some((b) => b.t === "bang");
  const { shortcut, terms } = parseQuery(
    query,
    (t) =>
      (t === "bang" && !userCatalogBang) ||
      !!findEnabledBang(t, userBangs, disabled),
    (t) =>
      readBlockDisabledBangs() &&
      !(t === "bang" && !userCatalogBang) &&
      disabled.has(mainShortcut(t, userBangs)),
  );
  if (shortcut === "bang" && !userCatalogBang) {
    void showSettings(terms);
    return null;
  }

  const bang =
    (shortcut && findEnabledBang(shortcut, userBangs, disabled)) ||
    resolveDefaultBang(userBangs, disabled).bang;
  // If the query is just `!gh`, use `github.com` instead of `github.com/search?q=`
  if (!terms) return `https://${bang.d}`;
  if (bang.x) {
    const match = new RegExp(bang.x.split("\\\\").join("\\")).exec(terms);
    if (match)
      return bang.u.replace(/\$(\d+)/g, (_, index: string) =>
        encodeURIComponent(match[Number(index)] ?? ""),
      );
    return `https://${bang.d}`;
  }
  // Replace %2F with / to fix formats like "!ghr+t3dotgg/unduck"
  return bang.u.replace(
    "{{{s}}}",
    encodeURIComponent(terms).replace(/%2F/g, "/"),
  );
}

const params = new URLSearchParams(window.location.search);
const page = params.get("page");
const query = params.get("q")?.trim() ?? "";
if (page === "settings") {
  void loadPages().then(({ renderSettingsPage }) => renderSettingsPage());
} else if (page === "bangs") {
  void showSettings();
} else if (query) {
  const redirect = () => {
    const url = getRedirectUrl(query);
    if (url) window.location.replace(url);
  };
  if (hasLegacyCatalog()) void loadBangDetails().then(redirect);
  else redirect();
} else {
  void loadPages().then(({ renderHomePage }) => renderHomePage());
}
