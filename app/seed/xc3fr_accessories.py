"""Build XC3·Future Redeemed Unique Accessories (the chain-attack Manuals) from the
saved xenoserieswiki "Chain Attack (XC3)" page.

The user saves it (browser → Save HTML Only) as:
  cache/xc3fr-accessories-xenoseries.htm
It contains one Manuals table: Name | Heroic Chain | Completion Bonus, listing all
60 Manuals (Battle / Strategy / Tactics, vol. 1-20 each). Grouped by manual type.

Run:  python app/seed/xc3fr_accessories.py
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


def hdr_idx(header, *labels):
    low = [c.lower() for c in header]
    for lab in labels:
        for i, c in enumerate(low):
            if lab in c:
                return i
    return None


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "x"


def clean_effect(v):
    v = (v or "").strip()
    return "" if v.lower() in ("", "none", "-") else v


def main():
    html = open(os.path.join(CACHE, "xc3fr-accessories-xenoseries.htm"), encoding="utf-8", errors="replace").read()
    # the Manuals table is the wikitable whose header has Name + Heroic Chain
    table = None
    for t in scrape.tables(html, "wikitable"):
        if t and hdr_idx(t[0], "name") is not None and hdr_idx(t[0], "heroic chain") is not None:
            table = t
            break
    if not table:
        print("Manuals table not found in saved page")
        return
    iname = hdr_idx(table[0], "name")
    ihc = hdr_idx(table[0], "heroic chain")
    icb = hdr_idx(table[0], "completion")

    items, seen = [], set()
    for r in table[1:]:
        name = r[iname].strip() if len(r) > iname else ""
        m = re.match(r"(Battle|Strategy|Tactics) Manual", name)
        if not name or not m:
            continue
        gid = "acc-" + slug(name)
        while gid in seen:
            gid += "-2"
        seen.add(gid)
        items.append({
            "id": gid, "name": name, "group": m.group(1) + " Manual",
            "hchain": clean_effect(r[ihc] if len(r) > ihc else ""),
            "cbonus": clean_effect(r[icb] if icb is not None and len(r) > icb else ""),
            "dlc": "Future Redeemed",
        })

    path = os.path.join(DATA, "xc3.json")
    doc = json.load(open(path, encoding="utf-8"))
    doc["categories"]["uniqueaccessory"] = {"expected": 60, "partial": len(items) < 60, "items": items}
    json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    by = {}
    for it in items:
        by[it["group"]] = by.get(it["group"], 0) + 1
    print(f"uniqueaccessory: {len(items)} manuals")
    for g, n in by.items():
        print(f"   {g}: {n}")


if __name__ == "__main__":
    main()
