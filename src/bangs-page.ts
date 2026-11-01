import {
  DEFAULT_BANG_KEY,
  activeBangs,
  aliasesOf,
  builtInBang,
  builtInBangFor,
  mainShortcut,
  overriddenShortcut,
  exportBackup,
  parseBackup,
  readDefaultShortcut,
  readDisabledBangs,
  readUserBangs,
  sameBang,
  validateBang,
  writeDisabledBangs,
  writeUserBangs,
  type Bang,
} from "./bang-store";

type Options = { filter?: string; onChange?: () => void };

export function renderBuiltInBangs(
  app: HTMLElement,
  { filter = "", onChange = () => {} }: Options = {},
) {
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
            ${[
              ["t", "Shortcut"],
              ["s", "Site"],
              ["d", "Domain"],
              ["c", "Category"],
              ["sc", "Subcategory"],
              ["u", "Search URL"],
            ]
              .map(
                ([key, label]) =>
                  `<th scope="col" aria-sort="none"><button type="button" class="bang-sort" data-key="${key}">${label}<span aria-hidden="true"> ↕</span></button></th>`,
              )
              .join("")}
            <th scope="col" aria-sort="none"><div class="bang-select-all"><button type="button" class="bang-sort" data-key="enabled">Enabled<span aria-hidden="true"> ↕</span></button><input id="select-all" type="checkbox" aria-label="Enable all bangs" /></div></th>
            <th scope="col"><span class="sr-only">Actions</span></th>
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
          <label>Shortcut<input name="t" id="bang-shortcut" placeholder="gh" required pattern="!?[^\\s!]+" /><small id="shortcut-note" hidden></small></label>
          <label>Site<input name="s" placeholder="GitHub" required /></label>
          <label>Domain<input name="d" placeholder="github.com" required /></label>
          <label>Category<input name="c" placeholder="Tech" /></label>
          <label class="full-field">Subcategory<input name="sc" placeholder="Programming" /></label>
          <div class="full-field alias-field" role="group" aria-labelledby="alias-label">
            <span id="alias-label">Aliases</span>
            <ul id="alias-list"></ul>
            <div class="alias-add"><input id="alias-input" placeholder="github" pattern="!?[^\\s!]+" aria-label="New alias" /><button type="button" id="add-alias">Add alias</button></div>
            <small>Other shortcuts that open this bang.</small>
          </div>
          <label class="full-field">Search URL<input name="u" type="url" placeholder="https://github.com/search?q={{{s}}}" required /><small>Use {{{s}}} where the search terms go.</small></label>
          </div>
          <p id="add-error" role="alert"></p>
          <div class="panel-actions"><button type="button" id="cancel-panel">Cancel</button><button type="submit" class="primary" id="save-bang">Add bang</button></div>
          <div class="panel-secondary" id="panel-secondary"><button type="button" id="default-panel"></button><button type="button" id="remove-panel" class="danger"></button></div>
        </form>
      </dialog>
    </section>`;

  const dialog = app.querySelector<HTMLDialogElement>("#bang-dialog")!;
  const form = app.querySelector<HTMLFormElement>("#add-form")!;
  const heading = app.querySelector<HTMLElement>("#add-heading")!;
  const saveButton = app.querySelector<HTMLButtonElement>("#save-bang")!;
  const status = app.querySelector<HTMLElement>("#list-status")!;
  const error = app.querySelector<HTMLElement>("#add-error")!;
  const secondary = app.querySelector<HTMLElement>("#panel-secondary")!;
  const defaultButton = app.querySelector<HTMLButtonElement>("#default-panel")!;
  const removeButton = app.querySelector<HTMLButtonElement>("#remove-panel")!;
  const shortcutNote = app.querySelector<HTMLElement>("#shortcut-note")!;
  const aliasList = app.querySelector<HTMLUListElement>("#alias-list")!;
  const aliasInput = app.querySelector<HTMLInputElement>("#alias-input")!;
  let editing: Bang | null = null;
  let aliases: string[] = [];
  const plural = (count: number, noun: string) =>
    `${count} ${noun}${count === 1 ? "" : "s"}`;

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
    error.textContent = "";
    heading.textContent = saveButton.textContent = bang
      ? `Edit !${bang.t}`
      : "Add bang";
    if (bang) saveButton.textContent = "Save";
    for (const key of ["t", "s", "d", "c", "sc", "u"] as const)
      (form.elements.namedItem(key) as HTMLInputElement).value =
        bang?.[key] ?? "";
    aliases = bang ? [...aliasesOf(bang)] : [];
    renderAliases();
    const overridden = bang && overriddenShortcut(bang);
    shortcutNote.hidden = !overridden || overridden === bang.t;
    shortcutNote.textContent = `Replaces the built-in !${overridden}.`;
    secondary.hidden = !bang;
    if (bang) {
      updateDefaultButton(bang);
      const isUserBang = userBangs.includes(bang);
      removeButton.hidden = !isUserBang;
      removeButton.textContent = overridden ? "Reset to built-in" : "Delete";
    }
    dialog.showModal();
  }
  function renderAliases() {
    aliasList.replaceChildren(
      ...aliases.map((alias) => {
        const item = document.createElement("li");
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "✕";
        remove.setAttribute("aria-label", `Remove alias !${alias}`);
        remove.addEventListener("click", () => {
          aliases = aliases.filter((a) => a !== alias);
          renderAliases();
          aliasInput.focus();
        });
        item.append(`!${alias}`, remove);
        return item;
      }),
    );
  }
  function addAlias() {
    const alias = aliasInput.value.trim().replace(/^!/, "").toLowerCase();
    if (!alias) return;
    if (!aliasInput.checkValidity()) {
      error.textContent = "Use an alias without spaces or !.";
      return;
    }
    error.textContent = "";
    if (!aliases.includes(alias)) aliases.push(alias);
    aliasInput.value = "";
    renderAliases();
  }
  app.querySelector("#add-alias")!.addEventListener("click", addAlias);
  aliasInput.addEventListener("keydown", (event) => {
    // Enter adds the alias instead of submitting the whole form.
    if (event.key !== "Enter") return;
    event.preventDefault();
    addAlias();
  });
  function updateDefaultButton(bang: Bang) {
    const isDefault = mainShortcut(readDefaultShortcut(), userBangs) === bang.t;
    defaultButton.disabled = isDefault;
    defaultButton.textContent = isDefault
      ? "Default search engine ✓"
      : "Use as default";
  }
  defaultButton.addEventListener("click", () => {
    if (editing) {
      useAsDefault(editing);
      updateDefaultButton(editing);
    }
  });
  removeButton.addEventListener("click", () => {
    if (editing && removeUserBang(editing)) dialog.close();
  });
  app
    .querySelector("#add-bang")!
    .addEventListener("click", () => openDialog(null));
  for (const id of ["close-panel", "cancel-panel"])
    app
      .querySelector(`#${id}`)!
      .addEventListener("click", () => dialog.close());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.textContent = "";
    try {
      // Count an alias typed but not yet added.
      addAlias();
      if (error.textContent) return;
      const own = editing ? overriddenShortcut(editing) : undefined;
      const entry = validateBang({
        ...Object.fromEntries(new FormData(form)),
        ts: aliases,
        ...(own && { o: own }),
      });
      const original = editing?.t;
      const shortcuts = [entry.t, ...aliasesOf(entry)];
      const rest = userBangs.filter((b) => b.t !== original);
      const taken = shortcuts.find((t) =>
        rest.some((b) => b.t === t || aliasesOf(b).includes(t)),
      );
      if (taken)
        throw new Error(
          `You already have a bang using !${taken}. Edit it instead.`,
        );
      const previous = editing ? [editing.t, ...aliasesOf(editing)] : [];
      const clashes = shortcuts.flatMap((t) => {
        const triggered = builtInBangFor(t);
        return triggered && triggered.t !== own && !previous.includes(t)
          ? [`!${t} (${triggered.s})`]
          : [];
      });
      if (
        clashes.length &&
        !window.confirm(
          `${clashes.join(", ")} already ${clashes.length === 1 ? "opens a built-in bang" : "open built-in bangs"}. Use ${clashes.length === 1 ? "it" : "them"} for your bang instead?`,
        )
      )
        return;
      const builtIn = builtInBang(overriddenShortcut(entry) ?? "");
      // Aliases left as they are keep following the built-in's.
      if (builtIn && entry.ts?.join(" ") === (builtIn.ts ?? []).join(" "))
        delete entry.ts;
      // Saving a built-in unchanged drops the override instead of storing a copy.
      const list =
        builtIn && sameBang(entry, builtIn) ? rest : [entry, ...rest];
      if (original && original !== entry.t && disabled.delete(original)) {
        disabled.add(entry.t);
        saveSelection();
      }
      if (original) keepDefault(original, entry.t, list);
      dialog.close();
      input.value = entry.t;
      saveUserBangs(
        list,
        `${editing ? "Saved" : "Added"} !${entry.t}. Saved in this browser.`,
      );
    } catch (e) {
      error.textContent = (e as Error).message;
    }
  });

  /** Keeps a bang as the default search engine when its shortcut or aliases change. */
  function keepDefault(from: string, to: string, list: Bang[]) {
    const requested = readDefaultShortcut();
    if (
      mainShortcut(requested, userBangs) === from &&
      mainShortcut(requested, list) !== to
    )
      localStorage.setItem(DEFAULT_BANG_KEY, to);
  }
  function useAsDefault(bang: Bang) {
    disabled.delete(bang.t);
    saveSelection();
    localStorage.setItem(DEFAULT_BANG_KEY, bang.t);
    renderRows();
    status.textContent = `!${bang.t} is now your default search engine.`;
    onChange();
  }
  function removeUserBang(bang: Bang) {
    const builtIn = builtInBang(overriddenShortcut(bang) ?? "");
    const question = builtIn
      ? `Reset !${bang.t} to the built-in ${builtIn.s} bang (!${builtIn.t})?`
      : `Delete !${bang.t}?`;
    if (!window.confirm(question)) return false;
    if (builtIn?.t !== bang.t && disabled.delete(bang.t)) {
      if (builtIn) disabled.add(builtIn.t);
      saveSelection();
    }
    const list = userBangs.filter((b) => b.t !== bang.t);
    if (builtIn) keepDefault(bang.t, builtIn.t, list);
    saveUserBangs(
      list,
      builtIn
        ? `Reset !${bang.t} to the built-in !${builtIn.t}.`
        : `Deleted !${bang.t}.`,
    );
    return true;
  }

  const fileInput = app.querySelector<HTMLInputElement>("#import-file")!;
  app
    .querySelector("#import-bangs")!
    .addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const backup = parseBackup(JSON.parse(await file.text()));
      if (backup.disabled && backup.defaultBang) {
        if (
          !window.confirm(
            `Replace your bangs, enabled bangs and default search engine with this backup (${plural(backup.bangs.length, "custom bang")})?`,
          )
        )
          return;
        disabled.clear();
        for (const t of backup.disabled) disabled.add(t);
        saveSelection();
        localStorage.setItem(DEFAULT_BANG_KEY, backup.defaultBang);
        input.value = "";
        saveUserBangs(
          backup.bangs,
          `Restored backup with ${plural(backup.bangs.length, "custom bang")}. Saved in this browser.`,
        );
        return;
      }
      if (
        !window.confirm(
          `Add ${plural(backup.bangs.length, "bang")}? Imported bangs replace your bangs with the same shortcut.`,
        )
      )
        return;
      const imported = new Set(backup.bangs.map((b) => b.t));
      const list = [
        ...backup.bangs.filter((b) => {
          const builtIn = builtInBang(overriddenShortcut(b) ?? "");
          return !builtIn || !sameBang(b, builtIn);
        }),
        ...userBangs.filter((b) => !imported.has(b.t)),
      ];
      input.value = "";
      saveUserBangs(
        list,
        `Imported ${plural(backup.bangs.length, "bang")}. Saved in this browser.`,
      );
    } catch (e) {
      status.textContent = `Import failed: ${(e as Error).message}`;
    } finally {
      fileInput.value = "";
    }
  });
  app.querySelector("#export-bangs")!.addEventListener("click", () => {
    const backup = exportBackup();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "unduck-backup.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `Exported ${plural(backup.bangs.length, "custom bang")}, ${plural(backup.disabled.length, "disabled bang")} and your default search engine.`;
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
    const enabledCount = bangs.reduce(
      (total, bang) => total + Number(!disabled.has(bang.t)),
      0,
    );
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
    const defaultShortcut = mainShortcut(readDefaultShortcut(), userBangs);
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
        if (checkbox.checked) disabled.delete(bang.t);
        else disabled.add(bang.t);
        saveSelection();
        updateSelection();
        onChange();
      });
      selection.append(checkbox);
      const shortcut = document.createElement("td");
      shortcut.textContent = `!${bang.t}`;
      row.append(shortcut);
      for (const value of [
        bang.s,
        bang.d,
        bang.c || "—",
        bang.sc || "—",
        bang.u,
      ]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      const badges = [
        ...(defaultShortcut === bang.t ? ["default"] : []),
        ...(userBangs.includes(bang)
          ? [overriddenShortcut(bang) ? "modified" : "custom"]
          : []),
      ];
      for (const label of badges) {
        const badge = document.createElement("span");
        badge.className = `bang-badge bang-badge-${label}`;
        badge.textContent = label;
        shortcut.append(" ", badge);
      }
      const aliases = aliasesOf(bang);
      if (aliases.length) {
        const list = document.createElement("small");
        list.className = "bang-aliases";
        list.textContent = aliases.map((t) => `!${t}`).join(" ");
        shortcut.append(list);
      }
      const actions = document.createElement("td");
      actions.className = "bang-row-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.title = "Edit";
      edit.setAttribute("aria-label", `Edit !${bang.t}`);
      edit.innerHTML = '<span aria-hidden="true">🖊️</span>';
      edit.addEventListener("click", () => openDialog(bang));
      actions.append(edit);
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
      [
        bang.t,
        ...aliasesOf(bang),
        bang.s,
        bang.d,
        bang.c,
        bang.sc,
        bang.u,
      ].some((value) => value?.toLowerCase().includes(term)),
    );
    if (sortKey) {
      const key = sortKey;
      const multiplier = ascending ? 1 : -1;
      filtered.sort((a, b) => {
        if (key === "enabled") {
          // Ascending puts disabled (false) before enabled (true).
          return (
            multiplier *
            (Number(!disabled.has(a.t)) - Number(!disabled.has(b.t)))
          );
        }
        return (
          multiplier *
          (a[key] ?? "").localeCompare(b[key] ?? "", undefined, {
            sensitivity: "base",
            numeric: true,
          })
        );
      });
    }
    if (resetPage) page = 0;
    page = Math.min(
      page,
      Math.max(0, Math.ceil(filtered.length / pageSize) - 1),
    );
    renderRows();
  }
  input.addEventListener("input", () => updateList());
  sortButtons.forEach((button) =>
    button.addEventListener("click", () => {
      const key = button.dataset.key as SortKey;
      ascending = sortKey === key ? !ascending : true;
      sortKey = key;
      sortButtons.forEach((headerButton) => {
        const active = headerButton === button;
        headerButton
          .closest("th")!
          .setAttribute(
            "aria-sort",
            active ? (ascending ? "ascending" : "descending") : "none",
          );
        headerButton.querySelector("span")!.textContent = active
          ? ascending
            ? " ↑"
            : " ↓"
          : " ↕";
      });
      updateList();
    }),
  );
  previous.addEventListener("click", () => {
    page--;
    renderRows();
  });
  next.addEventListener("click", () => {
    page++;
    renderRows();
  });
  input.value = filter;
  updateList();
}
