import { activeBangs, readList, validateBang } from "./bang-store";

export const DISABLED_BANGS_KEY = "disabled-built-in-bangs";

export function readDisabledBangs(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DISABLED_BANGS_KEY) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function renderBuiltInBangs(app: HTMLElement) {
  let bangs = activeBangs();
  app.innerHTML = `
    <section class="bangs-section" aria-labelledby="built-in-heading">
      <div class="bang-toolbar"><h2 id="built-in-heading">Bangs</h2>
        <div class="bang-actions"><button id="import-bangs" type="button">Import</button><button id="export-bangs" type="button">Export</button><button id="add-bang" type="button" class="primary">+ Add bang</button></div>
      </div>
      <input id="import-file" type="file" accept=".json,application/json" hidden />
      <p id="list-status" role="status"></p>
      <label for="bang-filter">Search bangs</label>
      <input id="bang-filter" type="search" placeholder="Shortcut, site, domain, category or URL" />
      <p id="bang-count" role="status" aria-live="polite"></p>
      <div class="bang-table-scroll" role="region" aria-label="Bangs table" tabindex="0">
        <table class="bang-table">
          <caption class="sr-only">Bang shortcuts and search destinations</caption>
          <thead><tr>
            ${([["t", "Shortcut"], ["s", "Site"], ["d", "Domain"], ["c", "Category"], ["sc", "Subcategory"], ["u", "Search URL"]]).map(([key, label]) => `<th scope="col" aria-sort="none"><button type="button" class="bang-sort" data-key="${key}">${label}<span aria-hidden="true"> ↕</span></button></th>`).join("")}
            <th scope="col" aria-sort="none"><div class="bang-select-all"><button type="button" class="bang-sort" data-key="enabled">Enabled<span aria-hidden="true"> ↕</span></button><input id="select-all" type="checkbox" aria-label="Enable all bangs" /></div></th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <nav class="bang-pagination" aria-label="Table pages">
        <button type="button" id="bang-previous">Previous</button>
        <span id="bang-page"></span>
        <button type="button" id="bang-next">Next</button>
      </nav>
      <dialog id="bang-dialog" aria-labelledby="add-heading">
        <form id="add-form">
          <div class="panel-heading"><h2 id="add-heading">Add bang</h2><button type="button" id="close-panel" aria-label="Close panel">✕</button></div>
          <div class="panel-fields">
          <label>Shortcut<input name="t" placeholder="gh" required pattern="!?[^\\s!]+" /></label>
          <label>Site<input name="s" placeholder="GitHub" required /></label>
          <label>Domain<input name="d" placeholder="github.com" required /></label>
          <label>Category<input name="c" placeholder="Tech" /></label>
          <label class="full-field">Subcategory<input name="sc" placeholder="Programming" /></label>
          <label class="full-field">Search URL<input name="u" type="url" placeholder="https://github.com/search?q={{{s}}}" required /><small>Use {{{s}}} where the search terms go.</small></label>
          </div>
          <p id="add-error" role="alert"></p>
          <div class="panel-actions"><button type="button" id="cancel-panel">Cancel</button><button type="submit" class="primary">Add bang</button></div>
        </form>
      </dialog>
    </section>`;

  const dialog = app.querySelector<HTMLDialogElement>('#bang-dialog')!;
  const form = app.querySelector<HTMLFormElement>('#add-form')!;
  const status = app.querySelector<HTMLElement>('#list-status')!;
  const error = app.querySelector<HTMLElement>('#add-error')!;
  app.querySelector('#add-bang')!.addEventListener('click', () => { form.reset(); error.textContent = ''; dialog.showModal(); });
  for (const id of ['close-panel', 'cancel-panel']) app.querySelector(`#${id}`)!.addEventListener('click', () => dialog.close());
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const entry = validateBang(Object.fromEntries(new FormData(form)));
      if (bangs.some(b => b.t === entry.t)) throw new Error('This shortcut already exists. Choose another shortcut.');
      localStorage.setItem('added-bangs', JSON.stringify([entry, ...(readList('added-bangs') ?? [])]));
      bangs = activeBangs();
      input.value = entry.t;
      updateList();
      dialog.close();
      status.textContent = `Added !${entry.t}. Saved in this browser.`;
    } catch (e) { error.textContent = (e as Error).message; }
  });
  const fileInput = app.querySelector<HTMLInputElement>('#import-file')!;
  app.querySelector('#import-bangs')!.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!Array.isArray(data)) throw new Error('Choose a JSON array of bangs.');
      const entries = data.map((value, index) => {
        try { return validateBang(value); } catch (e) { throw new Error(`Entry ${index + 1}: ${(e as Error).message}`); }
      });
      if (new Set(entries.map(b => b.t)).size !== entries.length) throw new Error('The file contains duplicate shortcuts.');
      if (!window.confirm(`Replace the current list with ${entries.length} imported bangs?`)) return;
      localStorage.setItem('custom-bangs', JSON.stringify(entries));
      localStorage.removeItem('added-bangs');
      disabled.clear();
      saveSelection();
      bangs = activeBangs(); input.value = ''; updateList();
      status.textContent = `Imported ${entries.length} bangs. Saved in this browser.`;
    } catch (e) { status.textContent = `Import failed: ${(e as Error).message}`; }
    finally { fileInput.value = ''; }
  });
  app.querySelector('#export-bangs')!.addEventListener('click', () => {
    const entries = bangs.filter(b => !disabled.has(b.t));
    const url = URL.createObjectURL(new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'bangs.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `Exported ${entries.length} enabled bangs.`;
  });

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
    count.textContent = `${filtered.length ? start + 1 : 0}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length.toLocaleString()} bangs${filtered.length !== bangs.length ? ` (${bangs.length.toLocaleString()} total)` : ""}`;
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
