import { findEnabledBang, readDisabledBangs, readUserBangs, resolveDefaultBang } from "./bang-store";
import { parseQuery } from "./query";

function showSettings(filter?: string) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("page", "settings");
  if (filter) url.searchParams.set("filter", filter);
  url.hash = "built-in-bangs";
  window.history.replaceState(null, "", url);
  return import("./pages").then(({ renderSettingsPage }) => renderSettingsPage());
}

function getRedirectUrl(query: string) {
  const userBangs = readUserBangs();
  const disabled = readDisabledBangs();
  const userCatalogBang = userBangs.some((b) => b.t === "bang");
  const { shortcut, terms } = parseQuery(
    query,
    (t) => (t === "bang" && !userCatalogBang) || !!findEnabledBang(t, userBangs, disabled),
  );
  if (shortcut === "bang" && !userCatalogBang) {
    void showSettings(terms);
    return null;
  }

  const bang = (shortcut && findEnabledBang(shortcut, userBangs, disabled)) || resolveDefaultBang(userBangs, disabled).bang;
  // If the query is just `!gh`, use `github.com` instead of `github.com/search?q=`
  if (!terms) return `https://${bang.d}`;
  // Replace %2F with / to fix formats like "!ghr+t3dotgg/unduck"
  return bang.u.replace("{{{s}}}", encodeURIComponent(terms).replace(/%2F/g, "/"));
}

const params = new URLSearchParams(window.location.search);
const page = params.get("page");
const query = params.get("q")?.trim() ?? "";
if (page === "settings") {
  void import("./pages").then(({ renderSettingsPage }) => renderSettingsPage());
} else if (page === "bangs") {
  void showSettings();
} else if (query) {
  const url = getRedirectUrl(query);
  if (url) window.location.replace(url);
} else {
  void import("./pages").then(({ renderHomePage }) => renderHomePage());
}
