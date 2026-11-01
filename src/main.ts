import { bangs } from "./bang";
import "./global.css";

type CustomBang = { t: string; u: string; d: string };
const CUSTOM_KEY = "custom-bangs";

function readCustomBangs(): CustomBang[] | null {
  try {
    const saved = localStorage.getItem(CUSTOM_KEY);
    if (saved === null) return null;
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((b): b is CustomBang =>
      typeof b?.t === "string" && typeof b?.u === "string" && typeof b?.d === "string");
  } catch {
    return null;
  }
}

function noSearchDefaultPageRender() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div class="page">
      <div class="content-container">
        <h1>Und*ck</h1>
        <p>DuckDuckGo's bang redirects are too slow. Add the following URL as a custom search engine to your browser. Enables <a href="https://duckduckgo.com/bang.html" target="_blank">all of DuckDuckGo's bangs.</a></p>
        <div class="url-container"> 
          <input 
            type="text" 
            class="url-input"
            value="https://unduck.link?q=%s"
            readonly 
          />
          <button class="copy-button">
            <img src="/clipboard.svg" alt="Copy" />
          </button>
        </div>
        <section class="settings">
          <h2>Default search engine</h2>
          <p>Choose a bang shortcut for searches without a bang. This setting is saved in this browser.</p>
          <label for="default-bang">Default bang</label>
          <input id="default-bang" type="text" placeholder="ddg" />
          <div class="settings-actions"><button type="button" id="save-default">Save default</button></div>
          <p id="default-status" role="status"></p>
        </section>
        <section class="settings">
          <h2>Your bangs</h2>
          <p>Use your own list instead of the built-in bangs. Enter one shortcut and search URL per line, separated by a space. Use <code>{{{s}}}</code> where the search terms go.</p>
          <label for="custom-bangs">Custom bangs</label>
          <textarea id="custom-bangs" rows="5" placeholder="gh https://github.com/search?q={{{s}}}"></textarea>
          <div class="settings-actions">
            <button type="button" id="save-bangs">Save custom list</button>
            <button type="button" id="reset-bangs">Use built-in bangs</button>
          </div>
          <p id="bang-status" role="status"></p>
        </section>
      </div>
      <footer class="footer">
        <a href="https://t3.chat" target="_blank">t3.chat</a>
        •
        <a href="https://x.com/theo" target="_blank">theo</a>
        •
        <a href="https://github.com/t3dotgg/unduck" target="_blank">github</a>
      </footer>
    </div>
  `;

  const defaultInput = app.querySelector<HTMLInputElement>("#default-bang")!;
  const defaultStatus = app.querySelector<HTMLParagraphElement>("#default-status")!;
  defaultInput.value = localStorage.getItem("default-bang") ?? "ddg";
  app.querySelector<HTMLButtonElement>("#save-default")!.addEventListener("click", () => {
    const shortcut = defaultInput.value.trim().replace(/^!/, "").toLowerCase();
    const available = [...(readCustomBangs() ?? []), ...bangs];
    if (!available.some((bang) => bang.t === shortcut)) {
      defaultStatus.textContent = "Enter a valid built-in or custom bang shortcut, such as ddg or g.";
      return;
    }
    localStorage.setItem("default-bang", shortcut);
    defaultInput.value = shortcut;
    defaultStatus.textContent = "Default search engine saved on this browser.";
  });

  const editor = app.querySelector<HTMLTextAreaElement>("#custom-bangs")!;
  const status = app.querySelector<HTMLParagraphElement>("#bang-status")!;
  const custom = readCustomBangs();
  editor.value = custom?.map((b) => `${b.t} ${b.u}`).join("\n") ?? "";
  status.textContent = custom ? "Using your custom list on this browser." : "Using built-in bangs.";
  app.querySelector<HTMLButtonElement>("#save-bangs")!.addEventListener("click", () => {
    const entries: CustomBang[] = [];
    const seen = new Set<string>();
    for (const [index, line] of editor.value.split("\n").entries()) {
      if (!line.trim()) continue;
      const match = line.trim().match(/^!?([^\s!]+)\s+(\S+)$/);
      try {
        if (!match || !match[2].includes("{{{s}}}")) throw new Error();
        const url = new URL(match[2]);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
        const t = match[1].toLowerCase();
        if (seen.has(t)) throw new Error();
        seen.add(t);
        entries.push({ t, u: match[2], d: url.host });
      } catch {
        status.textContent = `Check line ${index + 1}: use a unique shortcut and an HTTP(S) URL containing {{{s}}}.`;
        return;
      }
    }
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(entries));
    status.textContent = "Custom list saved on this browser.";
  });
  app.querySelector<HTMLButtonElement>("#reset-bangs")!.addEventListener("click", () => {
    localStorage.removeItem(CUSTOM_KEY);
    status.textContent = "Using built-in bangs. Your editor contents have not been saved.";
  });

  const copyButton = app.querySelector<HTMLButtonElement>(".copy-button")!;
  const copyIcon = copyButton.querySelector("img")!;
  const urlInput = app.querySelector<HTMLInputElement>(".url-input")!;

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(urlInput.value);
    copyIcon.src = "/clipboard-check.svg";

    setTimeout(() => {
      copyIcon.src = "/clipboard.svg";
    }, 2000);
  });
}

const LS_DEFAULT_BANG = localStorage.getItem("default-bang") ?? "ddg";
const defaultBang = [...(readCustomBangs() ?? []), ...bangs].find((b) => b.t === LS_DEFAULT_BANG)
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
  const selectedBang = (readCustomBangs() ?? bangs).find((b) => b.t === bangCandidate) ?? defaultBang;

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

doRedirect();
