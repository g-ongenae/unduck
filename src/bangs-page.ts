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
      <a href="?page=settings">← Back to settings</a>
      <h1>Built-in bangs</h1>
      <p>Browse the default list included with Und*ck. Use a shortcut such as <code>!gh</code> before your search terms. Search URLs use <code>{{{s}}}</code> for those terms.</p>
      <p>Selections apply to the entire built-in list and are saved in this browser.</p>
      <label for="bang-filter">Search bangs</label>
      <input id="bang-filter" type="search" placeholder="Shortcut, site, domain, category or URL" />
      <p id="bang-count" role="status" aria-live="polite"></p>
      <div class="bang-table-scroll" role="region" aria-label="Built-in bangs table" tabindex="0">
        <table class="bang-table">
          <caption>Default bang shortcuts and search destinations</caption>
          <thead><tr>
            ${([["t", "Shortcut"], ["s", "Site"], ["d", "Domain"], ["c", "Category"], ["sc", "Subcategory"], ["u", "Search URL"]]).map(([key, label]) => `<th scope="col" aria-sort="none"><button type="button" class="bang-sort" data-key="${key}">${label}<span aria-hidden="true"> ↕</span></button></th>`).join("")}
            <th scope="col" aria-sort="none"><div class="bang-select-all"><button type="button" class="bang-sort" data-key="enabled">Enabled<span aria-hidden="true"> ↕</span></button><input id="select-all" type="checkbox" aria-label="Enable all built-in bangs" /></div></th>
          </tr></thead>
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
  type SortKey = "t" | "s" | "d" | "c" | "sc" | "u" | "enabled";
  let sortKey: SortKey | null = null;
  let ascending = true;
  const sortButtons = app.querySelectorAll<HTMLButtonElement>(".bang-sort");
  const selectAll = app.querySelector<HTMLInputElement>("#select-all")!;
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
  function updateSelection() {
    const enabledCount = bangs.reduce((total, bang) => total + Number(!disabled.has(bang.t)), 0);
    selectAll.checked = enabledCount === bangs.length;
    selectAll.indeterminate = enabledCount > 0 && enabledCount < bangs.length;
  }
  selectAll.addEventListener("change", () => {
    if (selectAll.checked) disabled.clear();
    else for (const bang of bangs) disabled.add(bang.t);
    saveSelection();
    renderRows();
  });

  function renderRows() {
    updateSelection();
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
        updateSelection();
      });
      selection.append(checkbox);
      for (const value of [`!${bang.t}`, bang.s, bang.d, bang.c ?? "—", bang.sc ?? "—", bang.u]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      row.append(selection);
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
    if (sortKey) {
      const key = sortKey;
      const multiplier = ascending ? 1 : -1;
      filtered.sort((a, b) => {
        if (key === "enabled") {
          // Ascending puts disabled (false) before enabled (true).
          return multiplier * (Number(!disabled.has(a.t)) - Number(!disabled.has(b.t)));
        }
        return multiplier * (a[key] ?? "").localeCompare(b[key] ?? "", undefined, { sensitivity: "base", numeric: true });
      });
    }
    page = 0;
    renderRows();
  }
  input.addEventListener("input", updateList);
  sortButtons.forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.key as SortKey;
    ascending = sortKey === key ? !ascending : true;
    sortKey = key;
    sortButtons.forEach((headerButton) => {
      const active = headerButton === button;
      headerButton.closest("th")!.setAttribute("aria-sort", active ? (ascending ? "ascending" : "descending") : "none");
      headerButton.querySelector("span")!.textContent = active ? (ascending ? " ↑" : " ↓") : " ↕";
    });
    updateList();
  }));
  previous.addEventListener("click", () => { page--; renderRows(); });
  next.addEventListener("click", () => { page++; renderRows(); });
  renderRows();
}
