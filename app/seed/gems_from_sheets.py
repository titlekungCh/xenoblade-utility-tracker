"""Build the XC3 Tier-X gems catalog + craft prefill from two Google Sheets.

Both sheets share one layout (one block per gem; the gem name sits in col A of the
block's first row, blank on continuation rows; col B = "Item (rarity)", C location,
D landmark, E teleport, F target enemy, G unique-monster drop):
  Sheet 1 (resources)  12QXhmv__nVelFujaYCaT4ux_Y6meiMaOrItOHk4B2J8  -> catalog
  Sheet 2 (prefill)    1zSP2cIYo25Jc4iVParl9Tk_f9vEeLzSMUGX54G2lJ80  -> crafted flags
In sheet 2 the user marks a crafted gem by putting a lone "a" in col A somewhere in
that gem's block.

Writes:
  app/web/data/xc3.json   -> categories.gems  (20 gems, dlc="")
  data/progress.json      -> state.games.xc3.gems[*]  (crafted + res:* for crafted gems)

Run:  python app/seed/gems_from_sheets.py
"""
import csv
import io
import json
import os
import re
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "web", "data")
PROGRESS = os.path.join(os.path.dirname(os.path.dirname(HERE)), "data", "progress.json")

SHEET_RESOURCES = "12QXhmv__nVelFujaYCaT4ux_Y6meiMaOrItOHk4B2J8"
SHEET_PREFILL = "1zSP2cIYo25Jc4iVParl9Tk_f9vEeLzSMUGX54G2lJ80"

# Category + effect from xenoserieswiki Gem_(XC3); keyed by proper-case name.
GEM_INFO = {
    "Tailwind": ("Defender", "Increases Agility"),
    "Steel Protection": ("Defender", "Increases Block Rate"),
    "Ultimate Counter": ("Defender", "Deals damage when you take damage"),
    "Brimming Spirit": ("Defender", "Boosts aggro generated when using Arts"),
    "Perilous Presence": ("Defender", "Start each battle with aggro"),
    "Steelcleaver": ("Attacker", "Increases Attack"),
    "Accurate Grace": ("Attacker", "Increases Dexterity"),
    "Analyze Weakness": ("Attacker", "Increases critical hit damage bonus"),
    "Swelling Scourge": ("Attacker", "Boosts power of debuffs applied to enemies"),
    "Refined Incantation": ("Attacker", "Extends duration of debuffs applied to enemies"),
    "Lifebearer": ("Healer", "Increases Healing"),
    "Soothing Breath": ("Healer", "Revives allies with more HP; also raises Healing"),
    "Lifesaving Expertise": ("Healer", "Boosts speed of ally revival and raises Healing"),
    "Swelling Blessing": ("Healer", "Boosts power of buff effects issued by self"),
    "Refined Blessing": ("Healer", "Extends duration of buff effects issued by self"),
    "Ironclad": ("Specialty", "Increases maximum HP"),
    "Steady Striker": ("Specialty", "Shortens auto-attack interval"),
    "Doublestrike": ("Specialty", "Adds a chance to strike twice per auto-attack"),
    "Empowered Combo": ("Specialty", "When canceling, boosts damage dealt"),
    "Disperse Bloodlust": ("Specialty", "Reduces aggro generated when using Arts"),
}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "x"


def fetch_csv(sid):
    url = f"https://docs.google.com/spreadsheets/d/{sid}/export?format=csv&gid=0"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        text = r.read().decode("utf-8", "replace")
    return list(csv.reader(io.StringIO(text)))


def col(row, i):
    return (row[i].strip() if len(row) > i else "")


def parse_blocks(rows):
    """-> list of {name, crafted, resources:[{item,rarity,slug,location,landmark,teleport,enemy,umDrop}]}"""
    gems, cur = [], None
    for row in rows[1:]:
        a = col(row, 0)
        if a and a.lower() != "a" and a.upper().endswith("X"):
            name = re.sub(r"\s+X$", "", a, flags=re.I).strip().title()
            cur = {"name": name, "crafted": False, "resources": []}
            gems.append(cur)
        elif a.lower() == "a" and cur:
            cur["crafted"] = True
        if cur:
            item_raw = col(row, 1)
            if item_raw:
                m = re.match(r"^(.*?)\s*\((\d)\)\s*$", item_raw)
                item = (m.group(1) if m else item_raw).strip()
                rarity = m.group(2) if m else ""
                cur["resources"].append({
                    "item": item, "rarity": rarity, "slug": slug(item),
                    "location": col(row, 2), "landmark": col(row, 3),
                    "teleport": col(row, 4), "enemy": col(row, 5), "umDrop": col(row, 6),
                })
    return gems


def main():
    res_gems = parse_blocks(fetch_csv(SHEET_RESOURCES))
    pre_gems = parse_blocks(fetch_csv(SHEET_PREFILL))
    crafted_names = {g["name"] for g in pre_gems if g["crafted"]}

    items, seen = [], set()
    for g in res_gems:
        gid = "gem-" + slug(g["name"])
        while gid in seen:
            gid += "-2"
        seen.add(gid)
        cat, eff = GEM_INFO.get(g["name"], ("", ""))
        items.append({
            "id": gid, "name": g["name"], "category": cat, "effect": eff,
            "tier": "X", "dlc": "", "resources": g["resources"],
        })

    # Future Redeemed uses the same gems with different (currently unknown) recipes.
    # Mirror the 20 gems tagged FR with empty resources so the FR campaign shows a
    # Gems tab (crafted toggles); resources can be filled later from an FR source.
    fr_items = []
    for it in items:
        fr_items.append({
            "id": "gem-fr-" + it["id"][len("gem-"):], "name": it["name"],
            "category": it["category"], "effect": it["effect"], "tier": "X",
            "dlc": "Future Redeemed", "resources": [],
        })
    items = items + fr_items

    # write catalog
    path = os.path.join(DATA, "xc3.json")
    doc = json.load(open(path, encoding="utf-8"))
    doc["categories"]["gems"] = {"expected": len(items), "partial": True, "items": items}
    json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # write craft prefill into progress.json (merge, don't clobber other progress)
    if os.path.isfile(PROGRESS):
        prog = json.load(open(PROGRESS, encoding="utf-8"))
    else:
        prog = {"version": 1, "games": {}, "custom": {}}
    prog.setdefault("games", {}).setdefault("xc3", {}).setdefault("gems", {})
    bag = prog["games"]["xc3"]["gems"]
    pre = 0
    for it in items:
        if it["name"] in crafted_names and it.get("dlc", "") == "":  # base gems only; Sheet 2 is base XC3
            row = {"crafted": True}
            for r in it["resources"]:
                row["res:" + r["slug"]] = True
            bag[it["id"]] = row
            pre += 1
    os.makedirs(os.path.dirname(PROGRESS), exist_ok=True)
    json.dump(prog, open(PROGRESS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    print(f"gems: {len(items)} written to xc3.json")
    print(f"prefilled crafted: {pre} ({', '.join(sorted(crafted_names))})")


if __name__ == "__main__":
    main()
