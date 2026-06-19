// Loads + caches per-game catalogs from web/data/<game>.json.
// Catalog shape:
//   { game, name, categories: { <cat>: { expected, partial, items:[{id,name,...}] } } }

const _cache = {};

export async function loadCatalog(game) {
  if (_cache[game]) return _cache[game];
  try {
    const res = await fetch(`data/${game}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    _cache[game] = await res.json();
  } catch (e) {
    // Missing catalog: empty placeholder so the UI still renders (everything partial).
    _cache[game] = { game, name: game, categories: {} };
  }
  return _cache[game];
}

export function catSection(catalog, cat) {
  return (catalog.categories && catalog.categories[cat]) || { items: [], partial: true };
}

export function catalogItems(catalog, cat) {
  return catSection(catalog, cat).items || [];
}

// Items belonging to one campaign: dlc "" = base game, else the expansion tag.
// Items with no dlc field count as base ("").
export function itemsFor(catalog, cat, dlc) {
  return catalogItems(catalog, cat).filter((it) => (it.dlc || "") === dlc);
}
