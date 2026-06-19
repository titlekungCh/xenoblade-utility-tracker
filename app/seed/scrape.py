"""Local wiki fetcher + MediaWiki table/list extractor (stdlib only).

Why local: xenoblade.fandom.com 403s automated tool fetches but answers a
normal browser User-Agent, so seeding lives here and runs on the user's machine.
Fetched HTML is cached under app/seed/cache/ so re-runs don't re-hit the network.

This module is infrastructure; build_catalog.py turns extracted rows into the
per-game catalogs in web/data/<game>.json.
"""
import hashlib
import html as htmllib
import os
import re
import time
import urllib.request
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def fetch(url, force=False, throttle=0.8):
    """GET `url` with a browser UA, caching the body under cache/. Returns text."""
    os.makedirs(CACHE, exist_ok=True)
    key = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
    path = os.path.join(CACHE, key + ".html")
    if not force and os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            return f.read()
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read().decode("utf-8", "replace")
            with open(path, "w", encoding="utf-8") as f:
                f.write(body)
            time.sleep(throttle)
            return body
        except Exception as e:
            if attempt == 2:
                print(f"  ! fetch failed: {url} -> {e}")
                return ""
            time.sleep(1.5 * (attempt + 1))
    return ""


# ---------------------------------------------------------------- table parsing
_TAG_RE = re.compile(r"<[^>]+>")
_REF_RE = re.compile(r"\[\d+\]")
_WS_RE = re.compile(r"\s+")


def clean(text):
    text = text.replace("<br>", " ").replace("<br/>", " ").replace("<br />", " ")
    text = _TAG_RE.sub("", text)
    text = htmllib.unescape(text)
    text = _REF_RE.sub("", text)
    return _WS_RE.sub(" ", text).strip()


class _TableParser(HTMLParser):
    """Collects rows of cells for every <table> whose class matches `want_class`.

    Honors rowspan/colspan so columns stay aligned. Cell value is cleaned text.
    """

    def __init__(self, want_class="wikitable", img_alt=False):
        super().__init__(convert_charrefs=True)
        self.want = want_class
        self.img_alt = img_alt
        self.tables = []          # list of raw-row lists
        self._depth = 0           # table nesting
        self._take = False        # inside a wanted table
        self._rows = None
        self._row = None
        self._cell = None         # [text_buf, colspan, rowspan]
        self._in_cell = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            self._depth += 1
            cls = a.get("class", "")
            if self.want in cls and not self._take:
                self._take = True
                self._table_depth = self._depth
                self._rows = []
        elif self._take and tag == "tr":
            self._row = []
        elif self._take and tag in ("td", "th"):
            self._in_cell = True
            cspan = int(a.get("colspan", 1) or 1)
            rspan = int(a.get("rowspan", 1) or 1)
            self._cell = ["", cspan, rspan]
        elif self._in_cell and tag in ("br",):
            self._cell[0] += " "
        elif self._in_cell and tag == "img" and self.img_alt:
            self._cell[0] += " " + a.get("alt", "") + " "

    def handle_data(self, data):
        if self._in_cell:
            self._cell[0] += data

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._in_cell:
            self._in_cell = False
            self._cell[0] = clean(self._cell[0])
            self._row.append(self._cell)
            self._cell = None
        elif tag == "tr" and self._take and self._row is not None:
            if self._row:
                self._rows.append(self._row)
            self._row = None
        elif tag == "table":
            if self._take and self._depth == getattr(self, "_table_depth", -1):
                self.tables.append(self._rows)
                self._rows = None
                self._take = False
            self._depth -= 1


def _to_grid(raw_rows):
    grid = []
    active = {}  # col -> [text, remaining_rows]
    for cells in raw_rows:
        row = {}
        for col, info in list(active.items()):
            row[col] = info[0]
            info[1] -= 1
            if info[1] <= 0:
                del active[col]
        col = 0
        for (text, cspan, rspan) in cells:
            while col in row:
                col += 1
            for _ in range(cspan):
                row[col] = text
                if rspan > 1:
                    active[col] = [text, rspan - 1]
                col += 1
        maxc = max(row) if row else -1
        grid.append([row.get(i, "") for i in range(maxc + 1)])
    w = max((len(r) for r in grid), default=0)
    return [r + [""] * (w - len(r)) for r in grid]


def tables(html_text, want_class="wikitable", img_alt=False):
    """Return every matching table as a rectangular grid (list of row-lists).

    img_alt=True folds each <img>'s alt text into its cell (e.g. fandom encodes a
    merc mission's Regular/Event/Missable kind as an icon's alt attribute)."""
    p = _TableParser(want_class, img_alt=img_alt)
    p.feed(html_text)
    return [_to_grid(rows) for rows in p.tables if rows]


# ---------------------------------------------------------------- list parsing
class _ContentLinkParser(HTMLParser):
    """Collects the visible text of <li> items inside the article body, plus the
    nearest preceding <h2>/<h3> heading (for region grouping)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items = []           # (heading, text)
        self._heading = ""
        self._cur_h = None
        self._li_depth = 0
        self._buf = ""

    def handle_starttag(self, tag, attrs):
        if tag in ("h2", "h3", "h4"):
            self._cur_h = ""
        elif tag == "li":
            self._li_depth += 1
            if self._li_depth == 1:
                self._buf = ""

    def handle_data(self, data):
        if self._cur_h is not None:
            self._cur_h += data
        elif self._li_depth >= 1:
            self._buf += data

    def handle_endtag(self, tag):
        if tag in ("h2", "h3", "h4") and self._cur_h is not None:
            h = clean(self._cur_h)
            # strip the "[edit]" the wikis append
            self._heading = re.sub(r"\s*edit\s*$", "", h, flags=re.I)
            self._cur_h = None
        elif tag == "li":
            if self._li_depth == 1:
                t = clean(self._buf)
                if t:
                    self.items.append((self._heading, t))
            self._li_depth = max(0, self._li_depth - 1)


def list_items(html_text):
    """Return [(heading, text), …] for <li> items in the page body."""
    p = _ContentLinkParser()
    # Trim to the article body to avoid nav/footer lists when possible.
    m = re.search(r'<div class="mw-parser-output">', html_text)
    body = html_text[m.start():] if m else html_text
    p.feed(body)
    return p.items


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("usage: python scrape.py <url> [tableIndex]")
        raise SystemExit(1)
    htmltext = fetch(sys.argv[1], force="--force" in sys.argv)
    tbs = tables(htmltext)
    print(f"{len(tbs)} wikitable(s)")
    for i, t in enumerate(tbs):
        print(f"--- table {i}: {len(t)} rows x {len(t[0]) if t else 0} cols")
        for row in t[:4]:
            print("   ", " | ".join(c[:22] for c in row))
