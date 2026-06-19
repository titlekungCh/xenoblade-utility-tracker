# CLAUDE.md

Guidance for working in this repo.

## What this is

A **local web app** that tracks completion across the Xenoblade series
(XC1 + Future Connected, XCX Definitive Edition, XC2 + Torna, XC3 + Future
Redeemed). It runs entirely offline: a tiny Python server serves a static
frontend. Modeled on the sibling `Limbus-Utility-Tracker`.

## Run / dev

```
python app/server.py          # serves http://localhost:12310, opens browser
# or double-click "Run Tracker.bat"
```

- **No build step, no Node, no framework.** Plain ES modules + a stdlib Python
  server. Files are served no-cache, so just reload the browser after editing.
- **Stdlib only.** The server and the seed/scraper use only the Python standard
  library (no bs4, no requests) — nothing to `pip install`.

## Architecture

| Path | Role |
|------|------|
| `app/server.py` | stdlib HTTP server; `GET/POST /api/state` ↔ `data/progress.json` (keeps `.bak`); serves `web/` |
| `app/web/data/<game>.json` | **catalog** — static, read-only reference (every monster/quest/blade/…), each entry has a stable `id` |
| `data/progress.json` | **progress** — the user's checkmarks, keyed by catalog `id`; the ONLY file written at runtime |
| `app/web/constants.js` | game metadata, per-game tab configs, accent palettes |
| `app/web/catalog.js` | loads + caches `data/<game>.json` |
| `app/web/progress.js` | get/set helpers over `state.games[game]`, keyed by catalog id |
| `app/web/render.js` | generic checklist/table renderers reused across tabs |
| `app/web/app.js` | game switcher, render orchestration, autosave wiring |
| `app/seed/scrape.py` | local scraper — fetches the wikis with a browser User-Agent, caches HTML under `app/seed/cache/` |
| `app/seed/sources.py` | per-category source URLs + parse rules |
| `app/seed/build_catalog.py` | parse cache → normalized `web/data/<game>.json` (+ count validation) |

### Catalog vs progress (key idea)
The big lists are **catalogs**: regenerable reference data. The user's ticks are
**progress**, a separate small file keyed by the catalog's stable `id`s. This
means a catalog can be re-scraped/expanded without wiping progress. Never store
progress inside `web/data/*.json`, and never store catalog rows inside
`progress.json`.

## Data sourcing

- Catalogs are seeded from **xenoserieswiki.org** (preferred for clean tables)
  and **xenoblade.fandom.com** (fallback). `xenoblade.fandom.com` 403s automated
  tool fetches but responds normally to a local script sending a browser
  `User-Agent` — that's why scraping lives in `app/seed/` and runs locally.
- Wiki coverage is **uneven**. `build_catalog.py` validates each category's row
  count against a known/expected total and **logs shortfalls** (no silent gaps).
  A catalog that falls short is marked `"partial": true`; the UI then shows an
  "add missing entries" affordance. Every tab supports user-added rows, so a
  partial catalog is never a dead end.
- `id`s are deterministic slugs (name + region/index) so re-seeding preserves
  progress.

## Conventions & gotchas

- Re-seeding regenerates `web/data/*.json` only; it never touches
  `data/progress.json`.
- Dashboard percentages are derived at render time from catalog totals × ticked
  progress — not stored.
- Per-game accent colors come from `constants.js` (`GAMES[*].accent`).
