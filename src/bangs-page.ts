import { bangs } from "./bang";

export const DISABLED_BANGS_KEY = "disabled-built-in-bangs";

export function readDisabledBangs(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DISABLED_BANGS_KEY) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function renderBangsPage() {
  document.title = "Built-in bangs | Und*ck";
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <main class="bangs-page">
      <a href="./">← Back to settings</a>
      <h1>Built-in bangs</h1>
      <p>Browse the default list included with Und*ck. Use a shortcut such as <code>!gh</code> before your search terms. Search URLs use <code>{{{s}}}</code> for those terms.</p>
      <div class="settings-actions"><button type="button" id="select-all">Select all</button><button type="button" id="unselect-all">Unselect all</button></div>
      <p>Selections apply to the entire built-in list and are saved in this browser.</p>
      <label for="bang-filter">Search bangs</label>
      <input id="bang-filter" type="search" placeholder="Shortcut, site, domain, category or URL" />
      <label for="bang-sort">Order by</label>
      <select id="bang-sort">
        <option value="default">Default order</option>
        <option value="t">Shortcut</option>
        <option value="s">Site</option>
        <option value="d">Domain</option>
        <option value="c">Category</option>
        <option value="sc">Subcategory</option>
        <option value="u">Search URL</option>
      </select>
      <label for="bang-direction">Direction</label>
      <select id="bang-direction"><option value="asc">Ascending</option><option value="desc">Descending</option></select>
      <p id="bang-count" role="status" aria-live="polite"></p>
      <div class="bang-table-scroll" role="region" aria-label="Built-in bangs table" tabindex="0">
        <table class="bang-table">
          <caption>Default bang shortcuts and search destinations</caption>
          <thead><tr><th scope="col">Enabled</th><th scope="col">Shortcut</th><th scope="col">Site</th><th scope="col">Domain</th><th scope="col">Category</th><th scope="col">Subcategory</th><th scope="col">Search URL</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <nav class="bang-pagination" aria-label="Table pages">
        <button type="button" id="bang-previous">Previous</button>
        <span id="bang-page"></span>
        <button type="button" id="bang-next">Next</button>
      </nav>
    </main>`;

  const input = app.querySelector<HTMLInputElement>("#bang-filter")!;
  const sort = app.querySelector<HTMLSelectElement>("#bang-sort")!;
  const direction = app.querySelector<HTMLSelectElement>("#bang-direction")!;
  const body = app.querySelector<HTMLTableSectionElement>("tbody")!;
  const count = app.querySelector<HTMLParagraphElement>("#bang-count")!;
  const pageLabel = app.querySelector<HTMLSpanElement>("#bang-page")!;
  const previous = app.querySelector<HTMLButtonElement>("#bang-previous")!;
  const next = app.querySelector<HTMLButtonElement>("#bang-next")!;
  const pageSize = 100;
  let page = 0;
  let filtered = bangs;
  const disabled = readDisabledBangs();
  function saveSelection() {
    localStorage.setItem(DISABLED_BANGS_KEY, JSON.stringify([...disabled]));
  }
  app.querySelector<HTMLButtonElement>("#select-all")!.addEventListener("click", () => {
    disabled.clear(); saveSelection(); renderRows();
  });
  app.querySelector<HTMLButtonElement>("#unselect-all")!.addEventListener("click", () => {
    for (const bang of bangs) disabled.add(bang.t);
    saveSelection(); renderRows();
  });

  function renderRows() {
    const start = page * pageSize;
    const fragment = document.createDocumentFragment();
    for (const bang of filtered.slice(start, start + pageSize)) {
      const row = document.createElement("tr");
      const selection = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !disabled.has(bang.t);
      checkbox.setAttribute("aria-label", `Enable !${bang.t}`);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) disabled.delete(bang.t); else disabled.add(bang.t);
        saveSelection();
      });
      selection.append(checkbox);
      row.append(selection);
      for (const value of [`!${bang.t}`, bang.s, bang.d, bang.c ?? "—", bang.sc ?? "—", bang.u]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      fragment.append(row);
    }
    if (!filtered.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.textContent = "No bangs match your search.";
      row.append(cell);
      fragment.append(row);
    }
    body.replaceChildren(fragment);
    count.textContent = `${filtered.length ? start + 1 : 0}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length.toLocaleString()} bangs (${bangs.length.toLocaleString()} built-in total)`;
    pageLabel.textContent = `Page ${page + 1} of ${Math.max(1, Math.ceil(filtered.length / pageSize))}`;
    previous.disabled = page === 0;
    next.disabled = start + pageSize >= filtered.length;
  }

  function updateList() {
    const term = input.value.trim().toLowerCase().replace(/^!/, "");
    filtered = bangs.filter((bang) =>
      [bang.t, bang.s, bang.d, bang.c, bang.sc, bang.u].some((value) => value?.toLowerCase().includes(term)),
    );
    const key = sort.value as "t" | "s" | "d" | "c" | "sc" | "u" | "default";
    direction.disabled = key === "default";
    if (key !== "default") {
      const multiplier = direction.value === "asc" ? 1 : -1;
      filtered.sort((a, b) => multiplier * (a[key] ?? "").localeCompare(b[key] ?? "", undefined, { sensitivity: "base", numeric: true }));
    }
    page = 0;
    renderRows();
  }
  input.addEventListener("input", updateList);
  sort.addEventListener("change", updateList);
  direction.addEventListener("change", updateList);
  direction.disabled = true;
  previous.addEventListener("click", () => { page--; renderRows(); });
  next.addEventListener("click", () => { page++; renderRows(); });
  renderRows();
}
