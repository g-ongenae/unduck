import { bangs as builtIns } from "./bang";
import {
  DEFAULT_BANG_KEY, activeBangs, builtInBang, exportBackup, parseBackup, readDefaultShortcut, readDisabledBangs,
  readUserBangs, sameBang, validateBang, writeDisabledBangs, writeUserBangs, type Bang,
} from "./bang-store";

type Options = { filter?: string; onChange?: () => void };

export function renderBuiltInBangs(app: HTMLElement, { filter = "", onChange = () => {} }: Options = {}) {
  const builtInShortcuts = new Set(builtIns.map((bang) => bang.t));
  let userBangs = readUserBangs();
  let bangs = activeBangs(userBangs);
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
            <th scope="col">Actions</th>
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
          <label>Shortcut<input name="t" id="bang-shortcut" placeholder="gh" required pattern="!?[^\\s!]+" /></label>
          <label>Site<input name="s" placeholder="GitHub" required /></label>
          <label>Domain<input name="d" placeholder="github.com" required /></label>
          <label>Category<input name="c" placeholder="Tech" /></label>
          <label class="full-field">Subcategory<input name="sc" placeholder="Programming" /></label>
          <label class="full-field">Search URL<input name="u" type="url" placeholder="https://github.com/search?q={{{s}}}" required /><small>Use {{{s}}} where the search terms go.</small></label>
          </div>
          <p id="add-error" role="alert"></p>
          <div class="panel-actions"><button type="button" id="cancel-panel">Cancel</button><button type="submit" class="primary" id="save-bang">Add bang</button></div>
        </form>
      </dialog>
    </section>`;

  const dialog = app.querySelector<HTMLDialogElement>('#bang-dialog')!;
  const form = app.querySelector<HTMLFormElement>('#add-form')!;
  const heading = app.querySelector<HTMLElement>('#add-heading')!;
  const saveButton = app.querySelector<HTMLButtonElement>('#save-bang')!;
  const shortcutInput = app.querySelector<HTMLInputElement>('#bang-shortcut')!;
  const status = app.querySelector<HTMLElement>('#list-status')!;
  const error = app.querySelector<HTMLElement>('#add-error')!;
  let editing: Bang | null = null;
  const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

  function saveUserBangs(list: Bang[], message: string) {
    writeUserBangs(list);
    userBangs = list;
    bangs = activeBangs(userBangs);
    updateList(false);
    status.textContent = message;
    onChange();
  }
  function openDialog(bang: Bang | null) {
    editing = bang;
    form.reset();
    error.textContent = '';
    heading.textContent = saveButton.textContent = bang ? `Edit !${bang.t}` : 'Add bang';
    if (bang) saveButton.textContent = 'Save';
    for (const key of ['t', 's', 'd', 'c', 'sc', 'u'] as const) (form.elements.namedItem(key) as HTMLInputElement).value = bang?.[key] ?? '';
    // A built-in can only be overridden under its own shortcut; rename by adding a new bang instead.
    shortcutInput.readOnly = !!bang && builtInShortcuts.has(bang.t);
    dialog.showModal();
  }
  app.querySelector('#add-bang')!.addEventListener('click', () => openDialog(null));
  for (const id of ['close-panel', 'cancel-panel']) app.querySelector(`#${id}`)!.addEventListener('click', () => dialog.close());
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const entry = validateBang(Object.fromEntries(new FormData(form)));
      const original = editing?.t;
      if (entry.t !== original && userBangs.some(b => b.t === entry.t)) throw new Error('You already have a bang with this shortcut. Edit it instead.');
      const builtIn = builtInBang(entry.t);
      if (!editing && builtIn && !window.confirm(`!${entry.t} is a built-in bang for ${builtIn.s}. Override it with your version?`)) return;
      const rest = userBangs.filter(b => b.t !== entry.t && b.t !== original);
      // Saving a built-in unchanged drops the override instead of storing a copy.
      const list = builtIn && sameBang(entry, builtIn) ? rest : [entry, ...rest];
      if (original && original !== entry.t && disabled.delete(original)) { disabled.add(entry.t); saveSelection(); }
      dialog.close();
      input.value = entry.t;
      saveUserBangs(list, `${editing ? 'Saved' : 'Added'} !${entry.t}. Saved in this browser.`);
    } catch (e) { error.textContent = (e as Error).message; }
  });

  function useAsDefault(bang: Bang) {
    disabled.delete(bang.t);
    saveSelection();
    localStorage.setItem(DEFAULT_BANG_KEY, bang.t);
    renderRows();
    status.textContent = `!${bang.t} is now your default search engine.`;
    onChange();
  }
  function removeUserBang(bang: Bang) {
    const builtIn = builtInBang(bang.t);
    const question = builtIn ? `Reset !${bang.t} to the built-in ${builtIn.s} bang?` : `Delete !${bang.t}?`;
    if (!window.confirm(question)) return;
    if (!builtIn && disabled.delete(bang.t)) saveSelection();
    saveUserBangs(userBangs.filter(b => b.t !== bang.t), builtIn ? `Reset !${bang.t} to the built-in bang.` : `Deleted !${bang.t}.`);
  }

  const fileInput = app.querySelector<HTMLInputElement>('#import-file')!;
  app.querySelector('#import-bangs')!.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const backup = parseBackup(JSON.parse(await file.text()));
      if (backup.disabled && backup.defaultBang) {
        if (!window.confirm(`Replace your bangs, enabled bangs and default search engine with this backup (${plural(backup.bangs.length, 'custom bang')})?`)) return;
        disabled.clear();
        for (const t of backup.disabled) disabled.add(t);
        saveSelection();
        localStorage.setItem(DEFAULT_BANG_KEY, backup.defaultBang);
        input.value = '';
        saveUserBangs(backup.bangs, `Restored backup with ${plural(backup.bangs.length, 'custom bang')}. Saved in this browser.`);
        return;
      }
      if (!window.confirm(`Add ${plural(backup.bangs.length, 'bang')}? Imported bangs replace your bangs with the same shortcut.`)) return;
      const imported = new Set(backup.bangs.map(b => b.t));
      const list = [...backup.bangs.filter(b => { const builtIn = builtInBang(b.t); return !builtIn || !sameBang(b, builtIn); }), ...userBangs.filter(b => !imported.has(b.t))];
      input.value = '';
      saveUserBangs(list, `Imported ${plural(backup.bangs.length, 'bang')}. Saved in this browser.`);
    } catch (e) { status.textContent = `Import failed: ${(e as Error).message}`; }
    finally { fileInput.value = ''; }
  });
  app.querySelector('#export-bangs')!.addEventListener('click', () => {
    const backup = exportBackup();
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'unduck-backup.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `Exported ${plural(backup.bangs.length, 'custom bang')}, ${plural(backup.disabled.length, 'disabled bang')} and your default search engine.`;
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
    writeDisabledBangs(disabled);
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
    onChange();
  });

  function renderRows() {
    updateSelection();
    const defaultShortcut = readDefaultShortcut();
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
        onChange();
      });
      selection.append(checkbox);
      for (const value of [`!${bang.t}`, bang.s, bang.d, bang.c || "—", bang.sc || "—", bang.u]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      const isUserBang = userBangs.includes(bang);
      if (isUserBang) {
        const badge = document.createElement("span");
        badge.className = "bang-badge";
        badge.textContent = builtInShortcuts.has(bang.t) ? "modified" : "custom";
        row.firstElementChild!.append(" ", badge);
      }
      const actions = document.createElement("td");
      actions.className = "bang-row-actions";
      const action = (label: string, handler: () => void, disabledButton = false) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.disabled = disabledButton;
        button.setAttribute("aria-label", `${label} !${bang.t}`);
        button.addEventListener("click", handler);
        actions.append(button);
      };
      action("Edit", () => openDialog(bang));
      const isDefault = defaultShortcut === bang.t;
      action(isDefault ? "Default" : "Use as default", () => useAsDefault(bang), isDefault);
      if (isUserBang) action(builtInShortcuts.has(bang.t) ? "Reset" : "Delete", () => removeUserBang(bang));
      row.append(selection, actions);
      fragment.append(row);
    }
    if (!filtered.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 8;
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

  function updateList(resetPage = true) {
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
    if (resetPage) page = 0;
    page = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
    renderRows();
  }
  input.addEventListener("input", () => updateList());
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
  input.value = filter;
  updateList();
}
