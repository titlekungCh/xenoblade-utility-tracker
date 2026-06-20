// Helpers over the progress document (state). Progress is keyed by catalog id:
//   state.games[game][cat][id] = { <field>: value, ... }
//   state.custom[game][cat]    = [ {id, name, ...catalog-shaped...} ]  (user rows)

export function blankState() {
  return { version: 1, games: {}, custom: {} };
}

// Normalize a loaded document so every access path exists.
export function normalize(state) {
  if (!state || typeof state !== "object") state = blankState();
  if (!state.games || typeof state.games !== "object") state.games = {};
  if (!state.custom || typeof state.custom !== "object") state.custom = {};
  state.version = 1;
  return state;
}

function gameBag(state, game) {
  return (state.games[game] || (state.games[game] = {}));
}
function catBag(state, game, cat) {
  const g = gameBag(state, game);
  return (g[cat] || (g[cat] = {}));
}

export function getRow(state, game, cat, id) {
  const c = state.games[game] && state.games[game][cat];
  return (c && c[id]) || null;
}

export function getField(state, game, cat, id, field) {
  const row = getRow(state, game, cat, id);
  return row ? row[field] : undefined;
}

export function setField(state, game, cat, id, field, value) {
  const c = catBag(state, game, cat);
  let row = c[id];
  const isDefault = value === false || value === 0 || value === undefined || value === "" || value === null;
  if (!row) {
    if (isDefault) return; // nothing to store
    row = c[id] = {};
  }
  if (isDefault) delete row[field];
  else row[field] = value;
  if (row && Object.keys(row).length === 0) delete c[id];
}

// Is a single item fully "done" per its category definition?
// `progressMode: "fields"` means every check-field must be ticked (e.g. Soul Hack
// arts need both Acquired AND Upgraded); otherwise the single `doneKey` decides.
export function isDone(def, row) {
  if (def.progressMode === "fields") {
    const checks = def.fields.filter((f) => f.type === "check");
    return checks.length ? checks.every((f) => row && !!row[f.key]) : false;
  }
  if (!row) return false;
  const v = row[def.doneKey];
  if (def.fields.find((f) => f.key === def.doneKey)?.type === "status") {
    return Number(v) >= (def.doneAt ?? 2);
  }
  if (def.doneAt !== undefined) return Number(v || 0) >= def.doneAt;
  return !!v;
}

// Fractional completion of one item, 0..1. In "fields" mode it's the share of
// check-fields ticked (so Acquired-only = 0.5); otherwise it's 0 or 1.
export function itemProgress(def, row) {
  if (def.progressMode === "fields") {
    const checks = def.fields.filter((f) => f.type === "check");
    if (!checks.length) return 0;
    const got = row ? checks.filter((f) => !!row[f.key]).length : 0;
    return got / checks.length;
  }
  return isDone(def, row) ? 1 : 0;
}

// {done, total, pct} — `done` counts fully-complete items; `pct` credits partials.
export function statsFor(def, items, state, game, cat) {
  let done = 0, prog = 0;
  for (const it of items) {
    const p = itemProgress(def, getRow(state, game, cat, it.id));
    prog += p;
    if (p >= 1) done++;
  }
  const total = items.length;
  return { done, total, pct: total ? Math.round((prog / total) * 100) : 0 };
}

// ---- user-added rows ----
export function customItems(state, game, cat) {
  const g = state.custom[game];
  return (g && g[cat]) || [];
}
export function addCustom(state, game, cat, item) {
  if (!state.custom[game]) state.custom[game] = {};
  if (!state.custom[game][cat]) state.custom[game][cat] = [];
  state.custom[game][cat].push(item);
}
export function removeCustom(state, game, cat, id) {
  const list = customItems(state, game, cat);
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) list.splice(i, 1);
  // also drop its progress
  const c = state.games[game] && state.games[game][cat];
  if (c) delete c[id];
}
