"""Build XCX ground (player) Fashion Gear from the saved shop-armour HTML.

The user saves these xenoserieswiki pages (browser → Save as HTML Only) into cache/:
  xcx-shop-armor.html  = Shop_Terminal_(XCX)/Armor  (ground/player armour, the data)
  xcx-ground-armor.html / xcx-skell-armor.html = navbox pages (links only, no data)

Ground armour is what the player character wears; Skell armour (the mech's armour)
is a SEPARATE category. The skell pieces aren't in the saved pages (they live on
unsaved /1../9 drop sub-pages or a skell shop page), so this only builds ground
`fashiongear`. Run again with skell data later to fill `skellarmor`.

The shop page has 6 wikitables in slot order:
  Headwear, Torso, Right Arm, Left Arm, Legwear, Definitive Edition-exclusive
Columns: Name, Price, Category(=armour class), Manufacturer, ... (DE table prepends
a "Condition" column). We keep name + class + manufacturer + slot.

Run:  python app/seed/xcx_armor.py
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import scrape  # noqa: E402

CACHE = os.path.join(HERE, "cache")
DATA = os.path.join(os.path.dirname(HERE), "web", "data")
SLOTS = ["Headwear", "Torso", "Right Arm", "Left Arm", "Legwear", "DE-Exclusive"]


def hdr_idx(header, *labels):
    low = [c.lower() for c in header]
    for lab in labels:
        for i, c in enumerate(low):
            if lab in c:
                return i
    return None


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "x"


def main():
    html = open(os.path.join(CACHE, "xcx-shop-armor.html"), encoding="utf-8", errors="replace").read()
    tbs = scrape.tables(html, "wikitable")
    items, seen = [], set()
    for ti, t in enumerate(tbs):
        if not t:
            continue
        header = t[0]
        iname = hdr_idx(header, "name")
        icat = hdr_idx(header, "category")
        iman = hdr_idx(header, "manufacturer")
        if iname is None:
            continue
        slot = SLOTS[ti] if ti < len(SLOTS) else "Other"
        for r in t[1:]:
            name = r[iname].strip() if len(r) > iname else ""
            if not name or name.lower() == "name":
                continue
            gid = "fash-" + slug(name)
            while gid in seen:
                gid += "-2"
            seen.add(gid)
            items.append({
                "id": gid, "name": name,
                "type": (r[icat].strip() if icat is not None and len(r) > icat else ""),
                "source": (r[iman].strip() if iman is not None and len(r) > iman else ""),
                "group": slot, "dlc": "",
            })

    path = os.path.join(DATA, "xcx.json")
    doc = json.load(open(path, encoding="utf-8"))
    # shop armour only — drop-exclusive ground armour isn't in the saved pages
    doc["categories"]["fashiongear"] = {"expected": len(items), "partial": True, "items": items}
    json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    by_slot = {}
    for it in items:
        by_slot[it["group"]] = by_slot.get(it["group"], 0) + 1
    print(f"XCX ground fashiongear: {len(items)} pieces")
    for s, n in by_slot.items():
        print(f"   {s}: {n}")


if __name__ == "__main__":
    main()
