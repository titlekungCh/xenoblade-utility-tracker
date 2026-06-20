// Generic renderers. One powerful checklist table covers every category
// (monsters, quests, classes, blades, soul-hack, survey segments, skill nodes…)
// driven by the category's `fields` + `columns`. Only the dashboard is special.

import { getRow, getField, isDone, itemProgress, statsFor, customItems } from "./progress.js";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const STATUS_LABELS = ["Not started", "In progress", "Done"];
const STATUS_CLS = ["st-0", "st-1", "st-2"];

function progressBar(pct) {
  return `<div class="bar"><span style="width:${pct}%"></span></div>`;
}

// Which metadata columns actually have data across these items?
function activeColumns(def, items) {
  return (def.columns || []).filter((c) => items.some((it) => it[c.key] != null && it[c.key] !== ""));
}

function fieldCell(def, game, cat, item, field, state) {
  const v = getField(state, game, cat, item.id, field.key);
  const base = `data-act="field" data-id="${esc(item.id)}" data-field="${esc(field.key)}" data-type="${field.type}"`;
  if (field.type === "check") {
    return `<td class="fld-check"><input type="checkbox" ${base} ${v ? "checked" : ""}></td>`;
  }
  if (field.type === "num") {
    return `<td class="fld-num"><input type="number" min="0" max="${field.max ?? 99}" ${base} value="${v == null ? "" : esc(v)}" placeholder="0"></td>`;
  }
  if (field.type === "status") {
    const n = Number(v || 0);
    return `<td class="fld-status"><button class="stbtn ${STATUS_CLS[n]}" ${base} data-val="${n}">${STATUS_LABELS[n]}</button></td>`;
  }
  return "<td></td>";
}

function rowHtml(def, cols, game, cat, item, state, isCustom) {
  const p = itemProgress(def, getRow(state, game, cat, item.id));
  const cls = p >= 1 ? "done" : (p > 0 ? "partial" : "");
  const metaTds = cols.map((c) => `<td class="${c.cls || ""}">${esc(item[c.key] ?? "")}</td>`).join("");
  const fldTds = def.fields.map((f) => fieldCell(def, game, cat, item, f, state)).join("");
  const del = isCustom
    ? `<td class="rowdel"><button class="xbtn" data-act="del-row" data-id="${esc(item.id)}" title="Remove custom entry">✕</button></td>`
    : "<td></td>";
  return `<tr class="${cls}"><td class="rowname">${esc(item.name)}${isCustom ? ' <span class="custom-tag">added</span>' : ""}</td>${metaTds}${fldTds}${del}</tr>`;
}

function sortArrow(ui, key) {
  if (ui.sortKey !== key) return ' <span class="sort-ind">↕</span>';
  return ui.sortDir === "desc"
    ? ' <span class="sort-ind on">▼</span>'
    : ' <span class="sort-ind on">▲</span>';
}
function thSort(label, key, ui, cls) {
  return `<th class="sortable ${cls || ""}" data-sort="${esc(key)}">${esc(label)}${sortArrow(ui, key)}</th>`;
}

// Sort a copy of `items` by ui.sortKey/sortDir. Metadata columns sort
// numerically when their values look numeric (e.g. Lv "77", "36-40"), else
// alphabetically; field columns (check/num/status) sort by their tracked value.
// Blank values always sink to the bottom.
function sortItems(items, def, ui, state, game, cat) {
  const dir = ui.sortDir === "desc" ? -1 : 1;
  // build a value-getter for any key (field, name, or metadata column)
  const makeVal = (key) => {
    const fld = def.fields.find((f) => f.key === key);
    return (it) => {
      if (fld) {
        const v = getField(state, game, cat, it.id, key);
        return fld.type === "check" ? (v ? 1 : 0) : Number(v || 0);
      }
      if (key === "name") return it.name || "";
      return it[key] ?? "";
    };
  };
  // compare two non-blank values (numeric-aware: "77", "36-40")
  const cmpCore = (av, bv) => {
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    const fa = parseFloat(av), fb = parseFloat(bv);
    const aNum = /^\s*-?\d/.test(String(av)) && !isNaN(fa);
    const bNum = /^\s*-?\d/.test(String(bv)) && !isNaN(fb);
    return aNum && bNum ? fa - fb : String(av).toLowerCase().localeCompare(String(bv).toLowerCase());
  };
  const primary = makeVal(ui.sortKey);
  // a metadata column may declare a tiebreaker (e.g. Location → Level), always ascending
  const secKey = (def.columns || []).find((c) => c.key === ui.sortKey)?.secondarySort;
  const secondary = secKey ? makeVal(secKey) : null;
  const cmpWithBlanks = (av, bv, d) => {
    if (av === "" && bv !== "") return 1;   // blanks last, regardless of direction
    if (bv === "" && av !== "") return -1;
    return cmpCore(av, bv) * d;
  };
  return items.slice().sort((a, b) => {
    let c = cmpWithBlanks(primary(a), primary(b), dir);
    if (c === 0 && secondary) c = cmpWithBlanks(secondary(a), secondary(b), 1);
    return c;
  });
}

function tableHtml(def, cols, game, cat, items, state, customSet, ui) {
  const head =
    thSort("Name", "name", ui, "rowname") +
    cols.map((c) => thSort(c.label, c.key, ui, c.cls)).join("") +
    def.fields.map((f) => thSort(f.label, f.key, ui)).join("") +
    `<th></th>`;
  const body = items.map((it) => rowHtml(def, cols, game, cat, it, state, customSet.has(it.id))).join("");
  return `<div class="table-wrap"><table class="sheet checklist"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// ctx: { def, catKey, camp, section, baseItems, state, ui }
//   camp      — campaign id, used as the progress key
//   baseItems — catalog items already filtered to this campaign's dlc
export function renderCategory(ctx) {
  const { def, catKey: cat, camp: game, section, baseItems, state, ui } = ctx;
  const custom = customItems(state, game, cat);
  const customSet = new Set(custom.map((c) => c.id));
  let items = baseItems.concat(custom);

  // filter
  const q = (ui.search || "").trim().toLowerCase();
  if (q) {
    items = items.filter((it) =>
      [it.name, ...(def.columns || []).map((c) => it[c.key])]
        .some((v) => String(v ?? "").toLowerCase().includes(q)));
  }
  if (ui.onlyIncomplete) {
    items = items.filter((it) => !isDone(def, getRow(state, game, cat, it.id)));
  }
  if (ui.sortKey) items = sortItems(items, def, ui, state, game, cat);

  const allItems = baseItems.concat(custom);
  const stats = statsFor(def, allItems, state, game, cat);
  const cols = activeColumns(def, allItems);

  const partialNote = section.partial
    ? `<div class="hint partial">⚠ This list may be incomplete (wiki coverage was partial). Add any missing entries below.</div>`
    : "";

  const controls = `
    <div class="cat-head">
      <div class="cat-title">${def.icon || ""} ${esc(def.label)}</div>
      <div class="cat-stats">${stats.done} / ${stats.total} &nbsp;(${stats.pct}%)</div>
    </div>
    ${progressBar(stats.pct)}
    <div class="list-controls">
      <input type="text" data-act="search" placeholder="Search ${esc(def.label.toLowerCase())}…" value="${esc(ui.search || "")}">
      <label class="chk-inline"><input type="checkbox" data-act="filter-incomplete" ${ui.onlyIncomplete ? "checked" : ""}> Hide completed</label>
      <span class="count">${items.length} shown</span>
    </div>
    ${partialNote}`;

  // grouped or flat (a sort flattens the view so the whole list orders together)
  const groupOf = (list, key) => {
    const m = new Map();
    for (const it of list) {
      const g = it[key] || "—";
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(it);
    }
    return m;
  };
  let tables;
  if (def.groupBy && !q && !ui.onlyIncomplete && !ui.sortKey) {
    // columns shown in the table drop the keys that are now section headers
    const gCols = cols.filter((c) => c.key !== def.groupBy && c.key !== def.subGroupBy);
    tables = [...groupOf(items, def.groupBy).entries()].map(([g, gItems]) => {
      const gs = statsFor(def, gItems, state, game, cat);
      let inner;
      if (def.subGroupBy) {
        inner = [...groupOf(gItems, def.subGroupBy).entries()].map(([sg, sgItems]) => {
          const ss = statsFor(def, sgItems, state, game, cat);
          return `<div class="subsection-title" data-group="${esc(g)}" data-subgroup="${esc(sg)}">${esc(sg)} <span class="grp-stats">${ss.done}/${ss.total}</span></div>
            ${tableHtml(def, gCols, game, cat, sgItems, state, customSet, ui)}`;
        }).join("");
      } else {
        inner = tableHtml(def, gCols, game, cat, gItems, state, customSet, ui);
      }
      return `<div class="section-title ${def.subGroupBy ? "area-title" : ""}" data-group="${esc(g)}">${esc(g)} <span class="grp-stats">${gs.done}/${gs.total}</span></div>${inner}`;
    }).join("");
  } else {
    tables = tableHtml(def, cols, game, cat, items, state, customSet, ui);
  }

  const adder = `
    <div class="add-row">
      <input type="text" data-act="new-name" placeholder="Add a missing ${esc(def.label.replace(/s$/, "").toLowerCase())}…">
      <button class="btn-add" data-act="add-row">+ Add</button>
    </div>`;

  return controls + tables + adder;
}

// ---- Gems (custom renderer) ----
// Each Tier X gem: a "crafted" toggle + an expandable list of its required
// collectibles (each with a "got it" toggle + farm location). A farming shopping
// list aggregates everything still needed across gems not yet crafted.
const gemCrafted = (state, camp, id) => !!getField(state, camp, "gems", id, "crafted");
const resGot = (state, camp, gemId, slug) => !!getField(state, camp, "gems", gemId, "res:" + slug);

function gemResourceTable(g, state, camp) {
  const rows = (g.resources || []).map((r) => {
    const got = resGot(state, camp, g.id, r.slug);
    const farm = [r.location, r.enemy && `enemy: ${r.enemy}`, r.teleport && `near: ${r.teleport}`]
      .filter(Boolean).map(esc).join(" · ");
    return `<tr class="${got ? "got" : ""}">
      <td class="fld-check"><input type="checkbox" data-act="field" data-id="${esc(g.id)}" data-field="res:${esc(r.slug)}" data-type="check" ${got ? "checked" : ""}></td>
      <td>${esc(r.item)}${r.rarity ? ` <span class="rar">★${esc(r.rarity)}</span>` : ""}</td>
      <td class="farm">${farm}</td></tr>`;
  }).join("");
  return `<table class="sheet gem-res"><thead><tr><th>Got</th><th>Collectible</th><th>Where to farm</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderGems(ctx) {
  const { camp, baseItems, state, ui } = ctx;
  const open = ui.openGems || (ui.openGems = new Set());

  const total = baseItems.length;
  const done = baseItems.filter((g) => gemCrafted(state, camp, g.id)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  if (!total) {
    return `<div class="cat-head"><div class="cat-title">💎 Gems (Tier X)</div></div>
      <div class="hint partial">No gem data for this campaign yet.</div>`;
  }

  // filter
  const q = (ui.search || "").trim().toLowerCase();
  let gems = baseItems;
  if (q) gems = gems.filter((g) => [g.name, g.category, g.effect].some((v) => String(v || "").toLowerCase().includes(q)));
  if (ui.onlyIncomplete) gems = gems.filter((g) => !gemCrafted(state, camp, g.id));

  // farming shopping list: uncollected resources across not-yet-crafted gems
  const need = new Map();
  for (const g of baseItems) {
    if (gemCrafted(state, camp, g.id)) continue;
    for (const r of g.resources || []) {
      if (resGot(state, camp, g.id, r.slug)) continue;
      let e = need.get(r.item);
      if (!e) { e = { rarity: r.rarity, location: r.location, enemy: r.enemy, gems: new Set() }; need.set(r.item, e); }
      e.gems.add(g.name);
    }
  }
  const needRows = [...need.entries()].sort((a, b) => b[1].gems.size - a[1].gems.size)
    .map(([item, e]) => `<tr>
      <td>${esc(item)}${e.rarity ? ` <span class="rar">★${esc(e.rarity)}</span>` : ""}</td>
      <td class="num">${e.gems.size}</td>
      <td class="farm">${[e.location, e.enemy && `enemy: ${e.enemy}`].filter(Boolean).map(esc).join(" · ")}</td></tr>`).join("");
  const shopping = need.size
    ? `<details class="shop" open><summary>🧭 Farming shopping list — ${need.size} collectibles still needed</summary>
        <table class="sheet"><thead><tr><th>Collectible</th><th>Gems</th><th>Where to farm</th></tr></thead><tbody>${needRows}</tbody></table></details>`
    : `<div class="hint">All required collectibles obtained for un-crafted gems. 🎉</div>`;

  const cards = gems.map((g) => {
    const crafted = gemCrafted(state, camp, g.id);
    const isOpen = open.has(g.id);
    const resTotal = (g.resources || []).length;
    const gotN = (g.resources || []).filter((r) => resGot(state, camp, g.id, r.slug)).length;
    const cat = (g.category || "").toLowerCase();
    return `<div class="gem ${crafted ? "crafted" : ""}">
      <div class="gem-head">
        <button class="gem-expand" data-act="gem-expand" data-id="${esc(g.id)}" title="Show resources">${isOpen ? "▾" : "▸"}</button>
        <input type="checkbox" class="gem-craftbox" data-act="field" data-id="${esc(g.id)}" data-field="crafted" data-type="check" ${crafted ? "checked" : ""} title="Tier X crafted">
        <span class="gem-name">${esc(g.name)}</span>
        <span class="gem-cat ${cat}">${esc(g.category || "")}</span>
        <span class="gem-eff">${esc(g.effect || "")}</span>
        <span class="gem-resprog">${gotN}/${resTotal} mats</span>
      </div>
      ${isOpen ? gemResourceTable(g, state, camp) : ""}
    </div>`;
  }).join("");

  return `
    <div class="cat-head">
      <div class="cat-title">💎 Gems · Tier X</div>
      <div class="cat-stats">${done} / ${total} crafted (${pct}%)</div>
    </div>
    ${progressBar(pct)}
    <div class="list-controls">
      <input type="text" data-act="search" placeholder="Search gems…" value="${esc(ui.search || "")}">
      <label class="chk-inline"><input type="checkbox" data-act="filter-incomplete" ${ui.onlyIncomplete ? "checked" : ""}> Hide crafted</label>
      <span class="count">${gems.length} shown</span>
    </div>
    ${shopping}
    <div class="gem-list">${cards}</div>`;
}

// ---- Dashboard ----
// cards: [{cat, label, icon, stats:{done,total,pct}}]
export function renderDashboard(game, gameName, cards) {
  const overallDone = cards.reduce((a, c) => a + c.stats.done, 0);
  const overallTotal = cards.reduce((a, c) => a + c.stats.total, 0);
  const overallPct = overallTotal ? Math.round((overallDone / overallTotal) * 100) : 0;

  const cardHtml = cards.map((c) => `
    <div class="card dash-card" data-act="goto" data-cat="${esc(c.cat)}">
      <h2>${c.icon || ""} ${esc(c.label)}</h2>
      <div class="body">
        <div class="dash-pct">${c.stats.pct}%</div>
        <div class="bar"><span style="width:${c.stats.pct}%"></span></div>
        <div class="bar-label">${c.stats.done} / ${c.stats.total} complete</div>
      </div>
    </div>`).join("");

  return `
    <div class="dash-hero">
      <div class="dash-hero-name">${esc(gameName)}</div>
      <div class="dash-hero-pct">${overallPct}%</div>
      <div class="bar big"><span style="width:${overallPct}%"></span></div>
      <div class="bar-label">${overallDone} / ${overallTotal} tracked items complete</div>
    </div>
    <div class="grid">${cardHtml}</div>`;
}
