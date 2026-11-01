import { DEFAULT_BANG_KEY, findEnabledBang, readUserBangs, resolveDefaultBang } from "./bang-store";
import { renderBuiltInBangs } from "./bangs-page";
import "./global.css";

const FONT_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

// Kept out of index.html so search redirects never wait on third-party requests.
function loadExternalAssets() {
  const font = Object.assign(document.createElement("link"), { rel: "stylesheet", href: FONT_URL });
  const analytics = Object.assign(document.createElement("script"), { defer: true, src: "https://plausible.io/js/script.js" });
  analytics.dataset.domain = "unduck.link";
  document.head.append(font, analytics);
}

export function renderHomePage() {
  loadExternalAssets();
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

export function renderSettingsPage() {
  loadExternalAssets();
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

  const defaultInput = app.querySelector<HTMLInputElement>("#default-bang")!;
  const defaultStatus = app.querySelector<HTMLSpanElement>("#default-status")!;
  function refreshDefault(message = "") {
    const { bang, requested, usable } = resolveDefaultBang();
    defaultInput.value = requested;
    defaultStatus.classList.toggle("warning", !usable);
    defaultStatus.textContent = usable
      ? message
      : `!${requested} is disabled or no longer exists, so searches use !${bang.t}. Choose another default or enable it.`;
  }

  const filter = new URLSearchParams(window.location.search).get("filter") ?? "";
  renderBuiltInBangs(app.querySelector<HTMLElement>("#built-in-bangs")!, { filter, onChange: refreshDefault });
  refreshDefault();

  app.querySelector<HTMLFormElement>("#default-form")!.addEventListener("submit", (event) => {
    event.preventDefault();
    const shortcut = defaultInput.value.trim().replace(/^!/, "").toLowerCase();
    if (!findEnabledBang(shortcut, readUserBangs())) {
      defaultStatus.textContent = "Enter an enabled bang shortcut, such as ddg or g.";
      return;
    }
    localStorage.setItem(DEFAULT_BANG_KEY, shortcut);
    refreshDefault("Default search engine saved on this browser.");
  });

  if (window.location.hash === "#built-in-bangs") document.getElementById("built-in-bangs")!.scrollIntoView();
}
