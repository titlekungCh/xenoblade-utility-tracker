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


# --- Skell armour (Shop_Terminal_(XCX)/Skell_Armor) -------------------------
# The skell shop list is fully systematic: 5 slots × the SAME 19 SKUs, verified
# section-by-section against the wiki. The class (L/M/H) and manufacturer (SA/GG/
# ME) are encoded in each SKU, so the 95 pieces are generated from the confirmed
# template rather than a truncation-prone page dump. (The wiki blocks direct
# fetching; this is the data the page lists.)
SKELL_MFR = {"SA": "Sakuraba Industries", "GG": "Grenada Galactic Group", "ME": "Meredith & Co."}
SKELL_CLASS = {"L": "Light Armor", "M": "Medium Armor", "H": "Heavy Armor"}
SKELL_SLOTS = [("HEAD", "Head"), ("BODY", "Torso"), ("RARM", "Right Arm"), ("LARM", "Left Arm"), ("LEGS", "Legs")]
SKELL_SKUS = [  # name template per slot ({S} = slot infix)
    "SK20SA L-{S}-SPD", "SK20GG L-{S}-DEF", "SK20SA L-{S}-ATK",
    "SK30SA M-{S}-RNG", "SK30SA L-{S}-SPD", "SK30ME H-{S}-ETH", "SK30GG L-{S}-DEF",
    "SK30SA H-{S}-ATK2", "SK30SA M-{S}-MEL", "SK30SA L-{S}-ATK", "SK30SA H-{S}-ATK3",
    "SK50SA H-{S}-ATK3", "SK50SA M-{S}-RNG", "SK50SA L-{S}-SPD", "SK50ME H-{S}-ETH",
    "SK50GG L-{S}-DEF", "SK50SA H-{S}-ATK2", "SK50SA M-{S}-MEL", "SK50SA L-{S}-ATK",
]


SLOT_FROM_CODE = {"HEAD": "Head", "BODY": "Torso", "RARM": "Right Arm", "LARM": "Left Arm", "LEGS": "Legs"}


def build_skell(doc):
    """Skell armour = buyable shop armour (verified template) + drop-pool armour
    (deterministically parsed from the saved skell-drops-pool-N.htm downloads)."""
    items, seen = [], set()

    def add(name, cls, mfr, slot):
        gid = "skell-" + slug(name)
        if gid in seen:
            return False
        seen.add(gid)
        items.append({"id": gid, "name": name, "type": cls, "source": mfr, "group": slot, "dlc": ""})
        return True

    # shop armour (5 slots × 19 SKUs)
    for infix, slot in SKELL_SLOTS:
        for tmpl in SKELL_SKUS:
            name = tmpl.replace("{S}", infix)
            tok = name.split()                      # ["SK20SA", "L-HEAD-SPD"]
            add(name, SKELL_CLASS.get(tok[1][0], ""), SKELL_MFR.get(tok[0][4:6], ""), slot)
    nshop = len(items)

    # drop-pool armour (saved List_of_Skell_armor_drops/1..7 → cache/skell-drops-pool-N.htm)
    ndrop = 0
    for n in range(1, 8):
        p = os.path.join(CACHE, f"skell-drops-pool-{n}.htm")
        if not os.path.isfile(p):
            continue
        html = open(p, encoding="utf-8", errors="replace").read()
        for t in scrape.tables(html, "wikitable"):
            if not t or "name" not in t[0][0].strip().lower():
                continue
            for r in t[2:]:  # skip the 2 header rows (the 2nd holds the Resi sub-cols)
                name = r[0].strip()
                if not name or name.lower() == "name" or name == "Armor":
                    continue
                m = re.search(r"-(HEAD|BODY|RARM|LARM|LEGS)-", name)
                if not m:
                    continue
                cls = r[1].strip() if len(r) > 1 else ""
                mfr = r[2].strip() if len(r) > 2 else ""
                if add(name, cls, mfr, SLOT_FROM_CODE[m.group(1)]):
                    ndrop += 1

    doc["categories"]["skellarmor"] = {"expected": len(items), "partial": True, "items": items}
    return nshop, ndrop


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
    nshop, ndrop = build_skell(doc)
    json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    by_slot = {}
    for it in items:
        by_slot[it["group"]] = by_slot.get(it["group"], 0) + 1
    print(f"XCX ground fashiongear: {len(items)} pieces")
    for s, n in by_slot.items():
        print(f"   {s}: {n}")
    print(f"XCX skellarmor: {nshop + ndrop} pieces ({nshop} shop + {ndrop} drop-pool)")


if __name__ == "__main__":
    main()
