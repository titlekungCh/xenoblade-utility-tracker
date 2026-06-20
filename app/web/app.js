// Xenoblade Utility Tracker — render orchestration, game switcher, autosave.
import { CAMPAIGNS, CAMPAIGN_ORDER, CATEGORY_DEFS } from "./constants.js";
import { loadCatalog, catSection, itemsFor } from "./catalog.js";
import {
  blankState, normalize, setField, getField, getRow, isDone, customItems,
  addCustom, removeCustom, statsFor,
} from "./progress.js";
import { renderCategory, renderDashboard, renderGems, esc } from "./render.js";

let state = blankState();
let camp = CAMPAIGN_ORDER[0];
let tab = "dashboard";
let catalog = null;
const uiState = {}; // `${camp}:${cat}` -> { search, onlyIncomplete, sortKey, sortDir }

function ui(c, cat) {
  const k = `${c}:${cat}`;
  if (!uiState[k]) {
    const ds = (CATEGORY_DEFS[cat] && CATEGORY_DEFS[cat].defaultSort) || null;
    uiState[k] = { search: "", onlyIncomplete: false, sortKey: ds ? ds.key : null, sortDir: ds ? ds.dir : null };
  }
  return uiState[k];
}
// Category tabs that actually have items for the current campaign's dlc.
function visibleCats() {
  const C = CAMPAIGNS[camp];
  return C.cats.filter((cat) => itemsFor(catalog, cat, C.dlc).length > 0);
}

// ---------- save ----------
let saveTimer = null;
function setStatus(text, cls) {
  const el = document.getElementById("saveStatus");
  el.textContent = text;
  el.className = "save-status " + (cls || "");
}
function markDirty() {
  setStatus("unsaved…", "dirty");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 700);
}
async function saveNow() {
  clearTimeout(saveTimer);
  try {
    const r = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    setStatus(r.ok ? "saved" : "save failed", r.ok ? "saved" : "dirty");
  } catch {
    setStatus("offline", "dirty");
  }
}

// ---------- render ----------
function applyAccent() {
  document.documentElement.style.setProperty("--accent", CAMPAIGNS[camp].accent);
}
function renderSwitcher() {
  document.getElementById("gameSwitch").innerHTML = CAMPAIGN_ORDER
    .map((c) => {
      const C = CAMPAIGNS[c];
      const dlcCls = C.dlc ? " dlc" : "";
      return `<button class="gbtn${dlcCls} ${c === camp ? "active" : ""}" data-camp="${c}" title="${esc(C.name)}">${esc(C.short)}</button>`;
    })
    .join("");
}
function renderTabs() {
  const cats = ["dashboard", ...visibleCats()];
  document.getElementById("tabs").innerHTML = cats.map((c) => {
    const def = c === "dashboard" ? null : CATEGORY_DEFS[c];
    const label = def ? def.label : "Dashboard";
    const icon = def ? def.icon : "📊";
    return `<button class="tab ${c === tab ? "active" : ""}" data-tab="${c}">${icon} ${esc(label)}</button>`;
  }).join("");
}
function dashCards() {
  const dlc = CAMPAIGNS[camp].dlc;
  return visibleCats().map((cat) => {
    const def = CATEGORY_DEFS[cat];
    const items = itemsFor(catalog, cat, dlc).concat(customItems(state, camp, cat));
    return { cat, label: def.label, icon: def.icon, stats: statsFor(def, items, state, camp, cat) };
  });
}
function renderView() {
  const host = document.getElementById("view");
  if (tab === "dashboard") {
    host.innerHTML = renderDashboard(camp, CAMPAIGNS[camp].name, dashCards());
  } else {
    const def = CATEGORY_DEFS[tab];
    const sec = catSection(catalog, tab);
    const baseItems = itemsFor(catalog, tab, CAMPAIGNS[camp].dlc);
    const ctx = { def, catKey: tab, camp, section: sec, baseItems, state, ui: ui(camp, tab) };
    host.innerHTML = def.render === "gems" ? renderGems(ctx) : renderCategory(ctx);
  }
}
// Re-render the current view while keeping scroll position + search focus.
function rerender() {
  const wraps = [...document.querySelectorAll(".table-wrap")].map((w) => w.scrollTop);
  const y = window.scrollY;
  const focused = document.activeElement;
  const searchFocused = focused && focused.dataset && focused.dataset.act === "search";
  const caret = searchFocused ? focused.selectionStart : null;
  renderView();
  document.querySelectorAll(".table-wrap").forEach((w, i) => { if (wraps[i] != null) w.scrollTop = wraps[i]; });
  window.scrollTo(0, y);
  if (searchFocused) {
    const s = document.querySelector('[data-act="search"]');
    if (s) { s.focus(); if (caret != null) s.setSelectionRange(caret, caret); }
  }
}

// In-place update after a single field toggle on a checklist (no full rebuild).
function incrementalField(input, def) {
  const tr = input.closest("tr");
  if (tr) tr.classList.toggle("done", isDone(def, getRow(state, camp, tab, input.dataset.id)));
  updateChecklistStats(def);
}
function cssAttr(v) {
  return String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function updateChecklistStats(def) {
  const items = itemsFor(catalog, tab, CAMPAIGNS[camp].dlc).concat(customItems(state, camp, tab));
  const s = statsFor(def, items, state, camp, tab);
  const cs = document.querySelector(".cat-stats");
  if (cs) cs.textContent = `${s.done} / ${s.total}  (${s.pct}%)`;
  const bar = document.querySelector("#view > .bar > span");
  if (bar) bar.style.width = s.pct + "%";
  if (def.groupBy) {
    const groups = new Map();
    for (const it of items) {
      const g = it[def.groupBy] || "—";
      (groups.get(g) || groups.set(g, []).get(g)).push(it);
    }
    for (const [g, gItems] of groups) {
      const el = document.querySelector(`.section-title[data-group="${cssAttr(g)}"] .grp-stats`);
      if (el) { const gs = statsFor(def, gItems, state, camp, tab); el.textContent = `${gs.done}/${gs.total}`; }
    }
  }
}

async function switchCampaign(c) {
  if (c === camp) return;
  camp = c; tab = "dashboard";
  catalog = await loadCatalog(CAMPAIGNS[c].data);
  applyAccent(); renderSwitcher(); renderTabs(); renderView();
}
function switchTab(t) {
  tab = t; renderTabs(); renderView();
}

// ---------- mutations ----------
function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
function doAddRow() {
  const input = document.querySelector('[data-act="new-name"]');
  const name = (input?.value || "").trim();
  if (!name) return;
  const list = customItems(state, camp, tab);
  const id = `cust-${tab}-${slug(name)}-${list.length + 1}`;
  addCustom(state, camp, tab, { id, name });
  markDirty();
  rerender();
}

// ---------- events ----------
document.addEventListener("click", (e) => {
  const gb = e.target.closest("[data-camp]");
  if (gb) return void switchCampaign(gb.dataset.camp);

  const tb = e.target.closest(".tab[data-tab]");
  if (tb) return void switchTab(tb.dataset.tab);

  const goto = e.target.closest('[data-act="goto"]');
  if (goto) return void switchTab(goto.dataset.cat);

  const th = e.target.closest("th[data-sort]");
  if (th) {
    const u = ui(camp, tab);
    const k = th.dataset.sort;
    if (u.sortKey !== k) { u.sortKey = k; u.sortDir = "asc"; }       // new column → asc
    else if (u.sortDir === "asc") { u.sortDir = "desc"; }            // asc → desc
    else { u.sortKey = null; u.sortDir = null; }                     // desc → off (catalog order)
    rerender();
    return;
  }

  if (e.target.closest("#saveBtn")) return void saveNow();

  const stbtn = e.target.closest('button[data-act="field"][data-type="status"]');
  if (stbtn) {
    const n = (Number(stbtn.dataset.val) + 1) % 3;
    setField(state, camp, tab, stbtn.dataset.id, stbtn.dataset.field, n || undefined);
    markDirty(); rerender();
    return;
  }
  const add = e.target.closest('[data-act="add-row"]');
  if (add) return void doAddRow();

  const del = e.target.closest('[data-act="del-row"]');
  if (del) {
    removeCustom(state, camp, tab, del.dataset.id);
    markDirty(); rerender();
    return;
  }

  const gx = e.target.closest('[data-act="gem-expand"]');
  if (gx) {
    const u = ui(camp, tab);
    const set = u.openGems || (u.openGems = new Set());
    set.has(gx.dataset.id) ? set.delete(gx.dataset.id) : set.add(gx.dataset.id);
    rerender();
    return;
  }
});

document.addEventListener("change", (e) => {
  const f = e.target.closest('input[data-act="field"]');
  if (f) {
    const { id, field, type } = f.dataset;
    if (type === "check") setField(state, camp, tab, id, field, f.checked);
    else if (type === "num") setField(state, camp, tab, id, field, f.value === "" ? 0 : Number(f.value));
    markDirty();
    // Big lists (e.g. XC1 fashion gear, thousands of rows) must not rebuild the
    // whole table on every tick: update just the row + stats in place. Fall back
    // to a full re-render for gems (custom view) and when "hide completed" is on
    // (a now-complete row needs to disappear).
    const def = CATEGORY_DEFS[tab];
    if (def.render === "gems" || def.subGroupBy || ui(camp, tab).onlyIncomplete) rerender();
    else incrementalField(f, def);
    return;
  }
  const fi = e.target.closest('[data-act="filter-incomplete"]');
  if (fi) { ui(camp, tab).onlyIncomplete = fi.checked; rerender(); return; }
});

let searchTimer = null;
document.addEventListener("input", (e) => {
  const s = e.target.closest('[data-act="search"]');
  if (s) {
    ui(camp, tab).search = s.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(rerender, 130);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.act === "new-name") {
    e.preventDefault(); doAddRow();
  }
});

// ---------- init ----------
async function init() {
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    state = normalize(await res.json());
    setStatus("loaded", "saved");
  } catch {
    state = blankState();
    setStatus("new", "");
  }
  catalog = await loadCatalog(CAMPAIGNS[camp].data);
  applyAccent();
  renderSwitcher();
  renderTabs();
  renderView();
}
init();
