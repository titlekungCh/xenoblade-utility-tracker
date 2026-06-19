# Xenoblade Utility Tracker

A fully-local completion tracker for the **Xenoblade Chronicles** series. One app
with a top-level campaign switcher covering all four games and their DLC:

- **Xenoblade Chronicles 1** + Future Connected
- **Xenoblade Chronicles X** (Definitive Edition)
- **Xenoblade Chronicles 2** + Torna ~ The Golden Country
- **Xenoblade Chronicles 3** + Future Redeemed

No build step, no Node, no framework, no internet needed to run — a tiny Python
stdlib server serves a vanilla-JS frontend, and all progress is saved to a local
JSON file.

## Run

```
python app/server.py        # serves http://localhost:12310 and opens your browser
# or double-click "Run Tracker.bat" on Windows
```

## What it tracks

Per campaign (tabs appear only where the content exists):

| | Tracks |
|---|---|
| **All games** | Unique monsters · Quests · Heart-to-Hearts |
| **XC1** | Skill trees · Skill books · Collectopedia · Fashion gear |
| **Future Connected** | Ponspectors · Collectopedia |
| **XCX** | Classes · Skells · Survey segments · Collectopedia · Fashion gear · Skell armor |
| **XC2** | Blades · Merc missions |
| **Torna** | Community |
| **XC3** | Classes · Soul Hack arts · Ouroboros Soul Tree · Gems (Tier X) |
| **Future Redeemed** | Gems |

Features: searchable + sortable lists, per-category and overall completion %,
custom add-row for anything missing, and a dedicated **Gems** view with a farming
shopping list (which collectibles you still need, and where to farm them).

## Architecture

| Path | Role |
|------|------|
| `app/server.py` | stdlib HTTP server; `GET/POST /api/state` ↔ `data/progress.json` (keeps `.bak`) |
| `app/web/` | frontend: `index.html`, `app.js`, `render.js`, `catalog.js`, `progress.js`, `constants.js`, `style.css` |
| `app/web/data/<game>.json` | **catalogs** — static reference lists, each item with a stable `id` |
| `data/progress.json` | **your save** — checkmarks keyed by catalog id (gitignored) |
| `app/seed/` | data tooling that builds the catalogs |

The **catalog** (the lists of monsters/quests/etc.) is kept separate from your
**progress** (the checkmarks), so catalogs can be regenerated without losing your
ticks.

## Data sources

Catalog data is sourced from [Xeno Series Wiki](https://www.xenoserieswiki.org/)
and the [Xenoblade Wiki](https://xenoblade.fandom.com/), plus community-maintained
gem-crafting spreadsheets. Coverage is best-effort; lists flagged "partial" may be
incomplete, and every tab supports adding missing entries yourself.

This is an unofficial fan project. Xenoblade Chronicles is © Nintendo / Monolith Soft.
