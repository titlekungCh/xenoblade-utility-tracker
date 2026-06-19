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

// Is a single item "done" per its category definition?
export function isDone(def, row) {
  if (!row) return false;
  const v = row[def.doneKey];
  if (def.fields.find((f) => f.key === def.doneKey)?.type === "status") {
    return Number(v) >= (def.doneAt ?? 2);
  }
  if (def.doneAt !== undefined) return Number(v || 0) >= def.doneAt;
  return !!v;
}

// {done, total, pct} for a category given its merged item list.
export function statsFor(def, items, state, game, cat) {
  let done = 0;
  for (const it of items) {
    if (isDone(def, getRow(state, game, cat, it.id))) done++;
  }
  const total = items.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
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
