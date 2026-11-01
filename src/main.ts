import { bangs } from "./bang";
import { activeBangs } from "./bang-store";
import "./global.css";
import { readDisabledBangs, renderBuiltInBangs } from "./bangs-page";

function noSearchDefaultPageRender() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div class="page">
      <a class="settings-link" href="?page=settings" aria-label="Settings" title="Settings">⚙️</a>
      <div class="content-container">
        <h1>Und*ck</h1>
        <p>DuckDuckGo's bang redirects are too slow. Add the following URL as a custom search engine to your browser. Enables <a href="https://duckduckgo.com/bang.html" target="_blank">all of DuckDuckGo's bangs.</a></p>
        <div class="url-container"> 
          <input 
            type="text" 
            class="url-input"
            value="https://g-ongenae.github.io/unduck/?q=%s"
            readonly 
          />
          <button class="copy-button">
            <img src="${import.meta.env.BASE_URL}clipboard.svg" alt="Copy" />
          </button>
        </div>

      </div>
    </div>
  `;

  const copyButton = app.querySelector<HTMLButtonElement>(".copy-button")!;
  const copyIcon = copyButton.querySelector("img")!;
  const urlInput = app.querySelector<HTMLInputElement>(".url-input")!;

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(urlInput.value);
    copyIcon.src = `${import.meta.env.BASE_URL}clipboard-check.svg`;

    setTimeout(() => {
      copyIcon.src = `${import.meta.env.BASE_URL}clipboard.svg`;
    }, 2000);
  });
}

function renderSettingsPage() {
  document.title = "Settings | Und*ck";
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <main class="page settings-page">
      <div class="content-container">
        <a href="./">← Back to home</a>
        <h1>Settings</h1>
        <form id="default-form" class="default-row">
          <label for="default-bang">Default search engine</label>
          <input id="default-bang" type="text" placeholder="ddg" aria-describedby="default-status" />
          <button type="submit">Save</button>
          <span id="default-status" role="status"></span>
        </form>
        <div id="built-in-bangs"></div>
      </div>
    </main>
  `;

  renderBuiltInBangs(app.querySelector<HTMLElement>("#built-in-bangs")!);

  const defaultInput = app.querySelector<HTMLInputElement>("#default-bang")!;
  const defaultStatus = app.querySelector<HTMLParagraphElement>("#default-status")!;
  defaultInput.value = localStorage.getItem("default-bang") ?? "ddg";
  app.querySelector<HTMLFormElement>("#default-form")!.addEventListener("submit", (event) => {
    event.preventDefault();
    const shortcut = defaultInput.value.trim().replace(/^!/, "").toLowerCase();
    const available = activeBangs();
    if (!available.some((bang) => bang.t === shortcut)) {
      defaultStatus.textContent = "Enter a valid built-in or custom bang shortcut, such as ddg or g.";
      return;
    }
    localStorage.setItem("default-bang", shortcut);
    defaultInput.value = shortcut;
    defaultStatus.textContent = "Default search engine saved on this browser.";
  });

}

const LS_DEFAULT_BANG = localStorage.getItem("default-bang") ?? "ddg";
const defaultBang = activeBangs().find((b) => b.t === LS_DEFAULT_BANG)
  ?? bangs.find((b) => b.t === "ddg");

function getBangredirectUrl() {
  const url = new URL(window.location.href);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    noSearchDefaultPageRender();
    return null;
  }

  const match = query.match(/!(\S+)/i);

  const bangCandidate = match?.[1]?.toLowerCase();
  const disabled = readDisabledBangs();
  const selectedBang = activeBangs().filter((b) => !disabled.has(b.t)).find((b) => b.t === bangCandidate) ?? defaultBang;

  // Remove the first bang from the query
  const cleanQuery = query.replace(/!\S+\s*/i, "").trim();

  // If the query is just `!gh`, use `github.com` instead of `github.com/search?q=`
  if (cleanQuery === "")
    return selectedBang ? `https://${selectedBang.d}` : null;

  // Format of the url is:
  // https://www.google.com/search?q={{{s}}}
  const searchUrl = selectedBang?.u.replace(
    "{{{s}}}",
    // Replace %2F with / to fix formats like "!ghr+t3dotgg/unduck"
    encodeURIComponent(cleanQuery).replace(/%2F/g, "/"),
  );
  if (!searchUrl) return null;

  return searchUrl;
}

function doRedirect() {
  const searchUrl = getBangredirectUrl();
  if (!searchUrl) return;
  window.location.replace(searchUrl);
}

const page = new URLSearchParams(window.location.search).get("page");
if (page === "settings") {
  renderSettingsPage();
} else if (page === "bangs") {
  const settingsUrl = new URL(window.location.href);
  settingsUrl.searchParams.set("page", "settings");
  settingsUrl.hash = "built-in-bangs";
  window.history.replaceState(null, "", settingsUrl);
  renderSettingsPage();
  document.getElementById("built-in-bangs")!.scrollIntoView();
} else {
  doRedirect();
}
