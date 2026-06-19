"""Fold user-saved fandom HTML (in cache/) into the catalogs.

fandom blocks automated fetching, so these pages were saved from a real browser.
This applies four targeted improvements and leaves everything else untouched:
  1. XC3 monsters  -> full 172 (141 base + 31 Future Redeemed) from the monster page
  2. XC3 soulhack  -> fill `source` from each base monster's Soulhacker art
  3. XC3 classes   -> fill `weapon` from the class page's "Blade" column
  4. XC2 mercmissions -> fill `kind` (Regular/Event) for Leftheria/Indol/Tantal
                        from the Type-column icon alt text on the regional pages

Run:  python app/seed/merge_fandom.py
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


def load(game):
    with open(os.path.join(DATA, f"{game}.json"), encoding="utf-8") as f:
        return json.load(f)


def save(game, doc):
    with open(os.path.join(DATA, f"{game}.json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)


def read_cache(name):
    return open(os.path.join(CACHE, name), encoding="utf-8", errors="replace").read()


def hdr_idx(header, *labels):
    """First column index whose (lowercased) header contains any of labels."""
    low = [c.lower() for c in header]
    for lab in labels:
        for i, c in enumerate(low):
            if lab in c:
                return i
    return None


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "x"


def uniq(prefix, name, seen):
    base = f"{prefix}-{slug(name)}"
    i, out = 2, base
    while out in seen:
        out = f"{base}-{i}"; i += 1
    seen.add(out)
    return out


def strip_suffix(text):
    return re.sub(r"\s*\([^)]*\)\s*$", "", text).strip()


# ---------------------------------------------------------------- 1+2: XC3 mons
def fix_xc3_monsters_and_soulhack(doc):
    html = read_cache("xc3-unique-monsters.html")
    tbs = scrape.tables(html, want_class="xc1")
    monsters, seen, abil2mon = [], set(), {}
    for t in tbs:
        if not t:
            continue
        header = t[0]
        iname = hdr_idx(header, "name")
        ilvl = hdr_idx(header, "level")
        iloc = hdr_idx(header, "location")
        isoul = hdr_idx(header, "soulhacker")
        if iname is None or ilvl is None:
            continue
        is_fr = isoul is None  # the Future Redeemed table has no Soulhacker column
        for row in t[1:]:
            name = row[iname].strip()
            if not name or name.lower() == "name":
                continue
            it = {
                "id": uniq("mon", name, seen),
                "name": name,
                "level": row[ilvl].strip(),
                "location": row[iloc].strip() if iloc is not None else "",
                "dlc": "Future Redeemed" if is_fr else "",
            }
            if isoul is not None:
                art = row[isoul].strip()
                it["soulhack"] = art
                if art:
                    abil2mon[strip_suffix(art).lower()] = name
            monsters.append(it)
    sec = doc["categories"]["monsters"]
    sec["items"] = monsters
    sec["expected"] = 172
    sec["partial"] = False
    # soulhack sources from base monster arts
    filled = 0
    for it in doc["categories"].get("soulhack", {}).get("items", []):
        m = abil2mon.get(it["name"].lower())
        if m:
            it["source"] = m
            filled += 1
    base = sum(1 for m in monsters if m["dlc"] == "")
    fr = len(monsters) - base
    return base, fr, filled


# ---------------------------------------------------------------- 3: XC3 weapons
def fix_xc3_class_weapons(doc):
    html = read_cache("xc3-classes.html")
    tbs = scrape.tables(html, want_class="xc1")
    name2blade = {}
    for t in tbs:
        if not t:
            continue
        ic = hdr_idx(t[0], "class")
        ib = hdr_idx(t[0], "blade")
        if ic is None or ib is None:
            continue
        for row in t[1:]:
            nm = row[ic].strip()
            if nm and nm.lower() != "class":
                name2blade[nm.lower()] = row[ib].strip()
    filled = 0
    for it in doc["categories"].get("classes", {}).get("items", []):
        b = name2blade.get(it["name"].lower())
        if b and not it.get("weapon"):
            it["weapon"] = b
            filled += 1
    return filled


# ---------------------------------------------------------------- 4: merc kind
def fix_xc2_merc_kind(doc):
    pages = {
        "Leftheria": "lefteria-merc-mission.html",
        "Indol": "indol-merc-mission.html",
        "Tantal": "tantal-merc-mission.html",
    }
    updated = 0
    for region, fname in pages.items():
        html = read_cache(fname)
        plain = scrape.tables(html, want_class="xc1")
        alt = scrape.tables(html, want_class="xc1", img_alt=True)
        name2kind = {}
        for tp, ta in zip(plain, alt):
            imn = hdr_idx(tp[0], "mission name")
            ityp = hdr_idx(tp[0], "type")
            if imn is None or ityp is None:
                continue
            for rp, ra in zip(tp[1:], ta[1:]):
                nm = rp[imn].strip()
                if not nm or nm.lower() == "mission name":
                    continue
                a = ra[ityp].lower() if ityp < len(ra) else ""
                kind = "Event" if "event" in a else ("Regular" if "repeat" in a else "")
                if kind and (nm.lower() not in name2kind or not name2kind[nm.lower()]):
                    name2kind[nm.lower()] = kind
        for it in doc["categories"].get("mercmissions", {}).get("items", []):
            if it.get("region", "").lower() == region.lower():
                k = name2kind.get(it["name"].lower())
                if k and it.get("kind", "") != k:
                    it["kind"] = k
                    updated += 1
    return updated


def main():
    xc3 = load("xc3")
    base, fr, sh = fix_xc3_monsters_and_soulhack(xc3)
    wp = fix_xc3_class_weapons(xc3)
    save("xc3", xc3)
    print(f"XC3 monsters: {base} base + {fr} Future Redeemed = {base + fr}")
    print(f"XC3 soulhack sources filled: {sh}")
    print(f"XC3 class weapons filled: {wp}")

    xc2 = load("xc2")
    mk = fix_xc2_merc_kind(xc2)
    save("xc2", xc2)
    print(f"XC2 merc mission kinds set (Leftheria/Indol/Tantal): {mk}")


if __name__ == "__main__":
    main()
