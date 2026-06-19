"""Validate + report on the per-game catalogs in web/data/<game>.json.

The catalogs were seeded from xenoserieswiki.org (see CLAUDE.md / scrape.py for
why this is an assisted step: both wikis block direct local fetching). This tool
is the maintenance pass: it confirms each catalog is well-formed, ids are unique,
and reports counts vs the `expected` totals so coverage gaps stay visible.

Run:
    python app/seed/build_catalog.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "web", "data")
GAMES = ["xc1", "xcx", "xc2", "xc3"]


def check(game):
    path = os.path.join(DATA, f"{game}.json")
    if not os.path.isfile(path):
        print(f"  {game}: MISSING ({path})")
        return False
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)  # raises on invalid JSON
    ok = True
    print(f"\n{game}  ({doc.get('name', game)})")
    for cat, sec in doc.get("categories", {}).items():
        items = sec.get("items", [])
        ids = [it.get("id") for it in items]
        nameless = sum(1 for it in items if not it.get("name"))
        dupes = len(ids) - len(set(ids))
        exp = sec.get("expected")
        partial = sec.get("partial", False)
        flags = []
        if partial:
            flags.append("PARTIAL")
        if exp and len(items) < exp:
            flags.append(f"short {len(items)}/{exp}")
        if dupes:
            flags.append(f"{dupes} DUP IDs"); ok = False
        if nameless:
            flags.append(f"{nameless} NO NAME"); ok = False
        tag = ("  [" + ", ".join(flags) + "]") if flags else ""
        print(f"    {cat:<14} {len(items):>4} items{tag}")
    return ok


def main():
    all_ok = True
    for g in GAMES:
        try:
            all_ok &= check(g)
        except Exception as e:  # invalid JSON etc.
            print(f"  {g}: ERROR {e}")
            all_ok = False
    print("\n" + ("All catalogs valid." if all_ok else "Problems found (see above)."))


if __name__ == "__main__":
    main()
